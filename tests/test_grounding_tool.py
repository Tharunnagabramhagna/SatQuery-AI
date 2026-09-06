"""Deterministic unit tests for Gemini Multimodal Visual Grounding Tool.

All tests in this suite mock the google-genai SDK to ensure:
  1. Deterministic execution without live Gemini API dependencies.
  2. Complete coverage of grounding scenarios (valid image, multiple objects, missing image, corrupt image, TIFF).
  3. Strict server-side bounding box validation (normalized [ymin, xmin, ymax, xmax], tiny clamping, discarding invalid).
  4. Strict failure containment (HTTP 429 without retry, timeout, API error, malformed output, missing API key).
  5. Separation of Grounding localization confidence from query-understanding confidence.
  6. Execution trace attribution ([provider: gemini, model: gemini-3.6-flash]).
  7. Genuine overlay visualization generation without fabricated geographic coordinates.
"""

from __future__ import annotations

import asyncio
import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.tools.executor import ToolExecutor
from backend.agents.tools.grounding.models import (
    GroundingObject,
    GroundingOutputSchema,
    validate_and_normalize_bbox,
)
from backend.agents.tools.grounding.tool import GroundingTool
from backend.agents.tools.registry import ToolRegistry
from backend.main import app
from backend.schemas.tool import ToolResult, ToolStatus


def _create_test_image_bytes(format: str = "JPEG", size: tuple = (120, 120), color: str = "blue") -> bytes:
    """Helper to generate in-memory image bytes."""
    img = Image.new("RGB", size, color=color)
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


def _create_mock_gemini_response(schema: GroundingOutputSchema) -> MagicMock:
    """Helper to create a mocked Gemini response with populated .parsed attribute."""
    mock_resp = MagicMock()
    mock_resp.parsed = schema
    mock_resp.text = schema.model_dump_json()
    return mock_resp


# ─── 1. Bounding Box Validation Unit Tests ────────────────────────────────────


def test_validate_and_normalize_bbox_valid():
    """Verify strictly valid normalized coordinates are preserved."""
    raw = [0.10, 0.20, 0.50, 0.80]
    validated = validate_and_normalize_bbox(raw)
    assert validated == [0.10, 0.20, 0.50, 0.80]


def test_validate_and_normalize_bbox_tiny_clamping():
    """Verify tiny boundary overshoots caused by precision (-0.001 -> 0.0, 1.001 -> 1.0) are clamped."""
    raw = [-0.001, 0.05, 0.95, 1.001]
    validated = validate_and_normalize_bbox(raw)
    assert validated == [0.0, 0.05, 0.95, 1.0]


def test_validate_and_normalize_bbox_discards_arbitrary_out_of_range():
    """Verify arbitrary out-of-range coordinates (-0.4, 1.7, NaN, inf, bools) are rejected."""
    assert validate_and_normalize_bbox([-0.4, 0.1, 0.5, 0.8]) is None
    assert validate_and_normalize_bbox([0.1, 0.2, 1.7, 0.8]) is None
    assert validate_and_normalize_bbox([float("nan"), 0.1, 0.5, 0.8]) is None
    assert validate_and_normalize_bbox([0.1, float("inf"), 0.5, 0.8]) is None
    assert validate_and_normalize_bbox([0.1, float("-inf"), 0.5, 0.8]) is None
    assert validate_and_normalize_bbox([True, 0.1, 0.5, 0.8]) is None
    assert validate_and_normalize_bbox([0.1, False, 0.5, 0.8]) is None


def test_validate_and_normalize_bbox_discards_inverted_or_collapsed():
    """Verify inverted (ymin >= ymax, xmin >= xmax) or collapsed boxes are rejected."""
    # Inverted y: ymin > ymax
    assert validate_and_normalize_bbox([0.60, 0.20, 0.40, 0.80]) is None
    # Inverted x: xmin > xmax
    assert validate_and_normalize_bbox([0.10, 0.80, 0.50, 0.20]) is None
    # Collapsed ymin == ymax
    assert validate_and_normalize_bbox([0.30, 0.20, 0.30, 0.80]) is None
    # Collapsed xmin == xmax
    assert validate_and_normalize_bbox([0.10, 0.40, 0.50, 0.40]) is None
    # Invalid length
    assert validate_and_normalize_bbox([0.10, 0.20, 0.30]) is None
    assert validate_and_normalize_bbox("not_a_list") is None


# ─── 2. Execution & Localization Tests ────────────────────────────────────────


@pytest.mark.anyio
async def test_grounding_successful_single_object(tmp_path: Path):
    """Verify single localized object produces valid ToolResult and overlay visualization."""
    img_path = tmp_path / "runway.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="One primary asphalt runway is localized in the center of the airfield.",
                confidence=0.92,
                objects=[
                    GroundingObject(
                        label="runway",
                        confidence=0.94,
                        bbox=[0.30, 0.15, 0.70, 0.85],
                    )
                ],
                warnings=[],
            )
        )
    )

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({
        "before_image": str(img_path),
        "query": "Where is the runway?",
    })

    assert isinstance(res, ToolResult)
    assert res.status == ToolStatus.SUCCESS.value
    assert res.confidence == 0.92
    assert "runway is localized" in res.answer
    assert res.metadata["localized_objects_count"] == 1
    assert res.metadata["coordinate_format"] == "normalized [ymin, xmin, ymax, xmax]"
    assert res.metadata["provider"] == "gemini"
    assert res.metadata["model"] == "gemini-3.6-flash"

    # Verify visualizations contain overlay mask and structured bounding box
    viz_types = [v.type for v in res.visualizations]
    assert "mask" in viz_types
    assert "bounding_box" in viz_types
    bbox_viz = next(v for v in res.visualizations if v.type == "bounding_box")
    assert bbox_viz.data["box_2d"] == [0.30, 0.15, 0.70, 0.85]
    assert bbox_viz.data["label"] == "runway"


@pytest.mark.anyio
async def test_grounding_successful_multiple_objects(tmp_path: Path):
    """Verify multiple localized objects are properly handled and filtered."""
    img_path = tmp_path / "airplanes.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="Three commercial aircraft are localized parked along the apron.",
                confidence=0.89,
                objects=[
                    GroundingObject(label="airplane", confidence=0.91, bbox=[0.20, 0.25, 0.35, 0.40]),
                    GroundingObject(label="airplane", confidence=0.88, bbox=[0.22, 0.45, 0.37, 0.60]),
                    GroundingObject(label="airplane", confidence=0.87, bbox=[0.25, 0.65, 0.40, 0.80]),
                ],
                warnings=[],
            )
        )
    )

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({
        "before_image": str(img_path),
        "query": "Where are the airplanes parked?",
    })

    assert res.status == ToolStatus.SUCCESS.value
    assert res.metadata["localized_objects_count"] == 3
    # 1 summary + 3 bounding box evidence items = 4
    assert len(res.evidence) == 4
    # 1 mask overlay + 3 bounding box viz items = 4
    assert len(res.visualizations) == 4


@pytest.mark.anyio
async def test_grounding_discards_invalid_bboxes(tmp_path: Path):
    """Verify invalid bounding boxes from model are safely filtered out and noted in warnings."""
    img_path = tmp_path / "test.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="Localized features.",
                confidence=0.80,
                objects=[
                    GroundingObject(label="valid_building", confidence=0.85, bbox=[0.1, 0.1, 0.4, 0.4]),
                    GroundingObject(label="inverted_box", confidence=0.70, bbox=[0.8, 0.2, 0.2, 0.5]),  # Inverted ymin > ymax
                    GroundingObject(label="out_of_bounds", confidence=0.60, bbox=[-0.5, 0.1, 0.4, 0.4]),  # Wild out of range
                ],
                warnings=[],
            )
        )
    )

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(img_path), "query": "Locate buildings."})

    assert res.status == ToolStatus.SUCCESS.value
    assert res.metadata["localized_objects_count"] == 1
    assert res.metadata["discarded_invalid_boxes_count"] == 2
    assert any("discarded due to invalid coordinate geometry" in w for w in res.warnings)


@pytest.mark.anyio
async def test_grounding_missing_image_returns_input_required():
    """Verify missing image returns INPUT_REQUIRED without calling Gemini."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock()

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"query": "Where are the airplanes?"})

    assert res.status == ToolStatus.INPUT_REQUIRED.value
    assert res.confidence is None
    assert "requires a satellite image" in res.answer.lower()
    assert mock_client.aio.models.generate_content.call_count == 0


@pytest.mark.anyio
async def test_grounding_corrupted_image_controlled_error(tmp_path: Path):
    """Verify missing or corrupted image paths produce controlled error."""
    mock_client = MagicMock()
    tool = GroundingTool(api_key="mock-key", client=mock_client)

    res_missing = await tool.execute({"before_image": "non_existent_sat_image.jpg"})
    assert res_missing.status == ToolStatus.ERROR.value
    assert res_missing.confidence == 0.0

    corrupt_file = tmp_path / "corrupt.png"
    corrupt_file.write_bytes(b"NOT_A_VALID_PNG")
    res_corrupt = await tool.execute({"before_image": str(corrupt_file)})
    assert res_corrupt.status == ToolStatus.ERROR.value
    assert res_corrupt.confidence == 0.0


@pytest.mark.anyio
async def test_grounding_tiff_image_support(tmp_path: Path):
    """Verify TIFF format (.tif/.tiff) is successfully ingested."""
    tiff_path = tmp_path / "sat.tif"
    tiff_path.write_bytes(_create_test_image_bytes("TIFF", size=(90, 90)))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="Storage tanks localized in the industrial sector.",
                confidence=0.86,
                objects=[
                    GroundingObject(label="storage_tank", confidence=0.88, bbox=[0.2, 0.2, 0.35, 0.35])
                ],
            )
        )
    )

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(tiff_path), "query": "Find storage tanks."})

    assert res.status == ToolStatus.SUCCESS.value
    assert res.metadata["localized_objects_count"] == 1


# ─── 3. Failure Containment & Rate Limiting Tests ─────────────────────────────


@pytest.mark.anyio
async def test_grounding_gemini_429_rate_limit_no_retry(tmp_path: Path):
    """Verify HTTP 429 rate limit immediately halts with exactly 1 call and returns controlled error."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_generate = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource Exhausted"}})
    )
    mock_client.aio.models.generate_content = mock_generate

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(img_path), "query": "Where are the airplanes?"})

    # Exactly 1 call (no retry on 429)
    assert mock_generate.call_count == 1
    assert res.status == ToolStatus.ERROR.value
    assert res.confidence == 0.0
    assert res.metadata["error_type"] == "rate_limit_exceeded"
    assert any("rate limit exceeded" in w.lower() for w in res.warnings)


@pytest.mark.anyio
async def test_grounding_timeout_controlled_error(tmp_path: Path):
    """Verify timeout safely produces controlled error after bounded retry."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()

    async def _hang(*args, **kwargs):
        await asyncio.sleep(1.0)

    mock_client.aio.models.generate_content = AsyncMock(side_effect=_hang)

    tool = GroundingTool(api_key="mock-key", client=mock_client, timeout=0.05)
    res = await tool.execute({"before_image": str(img_path), "query": "Where are the airplanes?"})

    assert res.status == ToolStatus.ERROR.value
    assert res.confidence == 0.0
    assert res.metadata["error_type"] == "timeout"


@pytest.mark.anyio
async def test_grounding_malformed_structured_output(tmp_path: Path):
    """Verify malformed JSON produces controlled error without crashing."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    bad_resp = MagicMock()
    bad_resp.parsed = None
    bad_resp.text = '{"answer": "Missing confidence"}'

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(return_value=bad_resp)

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(img_path), "query": "Where are the airplanes?"})

    assert res.status == ToolStatus.ERROR.value
    assert res.confidence == 0.0
    assert res.metadata["error_type"] == "invalid_structured_output"


@pytest.mark.anyio
async def test_grounding_api_error_controlled_error(tmp_path: Path):
    """Verify 500/503 API error returns controlled error."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(500, {"error": {"message": "Internal error"}})
    )

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(img_path), "query": "Where are the airplanes?"})

    assert res.status == ToolStatus.ERROR.value
    assert res.confidence == 0.0
    assert res.metadata["error_type"] == "api_error"


@pytest.mark.anyio
async def test_grounding_missing_api_key_controlled_error(tmp_path: Path):
    """Verify missing API key produces controlled error before network call."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    tool = GroundingTool(api_key="", client=None)
    res = await tool.execute({"before_image": str(img_path), "query": "Where are the airplanes?"})

    assert res.status == ToolStatus.ERROR.value
    assert res.confidence == 0.0
    assert res.metadata["error_type"] == "missing_api_key"


# ─── 4. Orchestrator Integration & Geographic Coordinates Rule ────────────────


@pytest.mark.anyio
async def test_grounding_confidence_is_localization_confidence(tmp_path: Path):
    """Verify top-level response confidence prioritizes Grounding specialist confidence."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="Localized 2 storage tanks.",
                confidence=0.84,  # Specialist localization confidence
                objects=[
                    GroundingObject(label="tank", confidence=0.85, bbox=[0.1, 0.1, 0.3, 0.3]),
                ],
            )
        )
    )

    grounding_tool = GroundingTool(api_key="mock-key", client=mock_client)
    registry = ToolRegistry()
    registry.register(grounding_tool)
    executor = ToolExecutor(registry=registry)
    orch = AgentOrchestrator(tool_executor=executor)

    res = await orch.process_query(
        query="Where are the airplanes parked?",  # Routed to GROUNDING
        before_image=str(img_path),
    )

    # Top-level confidence should be specialist visual confidence (0.84), not classification confidence
    assert res["confidence"] == 0.84
    assert res["task"] == "GROUNDING"
    assert res["tool_result"].status == "success"


@pytest.mark.anyio
async def test_grounding_no_fabricated_geographic_coordinates(tmp_path: Path):
    """Verify no latitude, longitude, or map coordinates are fabricated in evidence/metadata."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="Aircraft localized in image pixel-space.",
                confidence=0.90,
                objects=[
                    GroundingObject(label="airplane", confidence=0.91, bbox=[0.2, 0.2, 0.4, 0.4])
                ],
            )
        )
    )

    tool = GroundingTool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(img_path), "query": "Where are the airplanes?"})

    # Assert strictly normalized 2D image coordinates only
    assert res.metadata["coordinate_format"] == "normalized [ymin, xmin, ymax, xmax]"
    assert "latitude" not in res.metadata
    assert "longitude" not in res.metadata

    for e in res.evidence:
        assert "°N" not in e.description
        assert "°E" not in e.description
        assert "°W" not in e.description
        assert "°S" not in e.description


@pytest.mark.anyio
async def test_grounding_execution_trace_records_tool_provider_model(tmp_path: Path):
    """Verify Step 3 trace records GROUNDING_TOOL, provider: gemini, and model: gemini-3.6-flash."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            GroundingOutputSchema(
                answer="Localized features.",
                confidence=0.91,
                objects=[
                    GroundingObject(label="building", confidence=0.91, bbox=[0.1, 0.1, 0.3, 0.3])
                ],
            )
        )
    )

    grounding_tool = GroundingTool(api_key="mock-key", client=mock_client, model="gemini-3.6-flash")
    registry = ToolRegistry()
    registry.register(grounding_tool)
    executor = ToolExecutor(registry=registry)
    orch = AgentOrchestrator(tool_executor=executor)

    res = await orch.process_query(
        query="Where are the airplanes parked?",
        before_image=str(img_path),
    )

    step3 = res["execution_trace"][2]
    assert step3.step == 3
    assert step3.action == "Tool Execution"
    assert "GROUNDING_TOOL" in step3.detail
    assert "provider: gemini" in step3.detail
    assert "gemini-3.6-flash" in step3.detail
    assert step3.status == "completed"


# ─── 5. End-to-End API Integration Tests ──────────────────────────────────────


def test_grounding_api_query_end_to_end(tmp_path: Path):
    """Test POST /api/query end-to-end with mocked Grounding specialist."""
    img_path = tmp_path / "grounding_e2e.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    client = TestClient(app)

    with patch("backend.agents.tools.grounding.tool.GroundingTool._call_gemini_multimodal") as mock_call:
        mock_call.return_value = (
            GroundingOutputSchema(
                answer="Four hangar buildings are localized across the western apron.",
                confidence=0.93,
                objects=[
                    GroundingObject(label="hangar", confidence=0.95, bbox=[0.15, 0.10, 0.30, 0.25]),
                    GroundingObject(label="hangar", confidence=0.94, bbox=[0.35, 0.10, 0.50, 0.25]),
                ],
            ),
            None,
            None,
        )

        response = client.post(
            "/api/query",
            json={
                "query": "Where are the airplanes parked?",
                "before_image": str(img_path),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["task"] == "GROUNDING"
        assert data["confidence"] == 0.93
        assert data["tool_result"]["status"] == "success"
        assert data["tool_result"]["metadata"]["capability"] == "GROUNDING"
        assert data["tool_result"]["metadata"]["provider"] == "gemini"
        assert data["tool_result"]["metadata"]["localized_objects_count"] == 2


def test_grounding_api_query_missing_image():
    """Test POST /api/query for Grounding without image returns INPUT_REQUIRED."""
    client = TestClient(app)

    response = client.post(
        "/api/query",
        json={"query": "Where are the airplanes parked?"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["task"] == "GROUNDING"
    assert data["tool_result"]["status"] == "input_required"
    assert data["confidence"] is not None
    assert "requires a satellite image" in data["answer"].lower()
