"""Deterministic unit tests for Gemini Multimodal Visual Question Answering (VQA) Tool.

All tests in this suite mock the google-genai SDK to ensure:
  1. Deterministic execution without live Gemini API dependencies.
  2. Complete coverage of multimodal VQA scenarios (valid image, missing image, corrupt image, TIFF).
  3. Strict failure containment (HTTP 429 without retry, timeout, API error, malformed output, missing API key).
  4. Separation of VQA visual confidence from query-classification confidence.
  5. Execution trace attribution ([provider: gemini, model: gemini-3.6-flash]).
  6. Zero fabricated coordinates, bounding boxes, or masks in VQA results.
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
from pydantic import ValidationError

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.router.agent_router import AgentRouter
from backend.agents.tools.executor import ToolExecutor
from backend.agents.tools.registry import ToolRegistry
from backend.agents.tools.vqa.models import VQAOutputSchema
from backend.agents.tools.vqa.tool import VQATool
from backend.main import app
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus


def _create_test_image_bytes(format: str = "JPEG", size: tuple = (100, 100), color: str = "green") -> bytes:
    """Helper to generate in-memory image bytes."""
    img = Image.new("RGB", size, color=color)
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


def _create_mock_gemini_response(schema: VQAOutputSchema) -> MagicMock:
    """Helper to create a mocked Gemini response with populated .parsed attribute."""
    mock_resp = MagicMock()
    mock_resp.parsed = schema
    mock_resp.text = schema.model_dump_json()
    return mock_resp


# ─── 1. Basic VQA Multimodal Execution Tests ──────────────────────────────────


@pytest.mark.anyio
async def test_vqa_valid_image_and_question_success(tmp_path: Path):
    """Test A & D: Valid satellite image + visual question produces successful ToolResult."""
    # Create temporary test image
    img_path = tmp_path / "test_satellite.jpg"
    img_path.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            VQAOutputSchema(
                answer="The scene depicts a mixed urban-industrial area with commercial buildings and paved transit corridors.",
                confidence=0.88,
                observations=["Rectilinear warehouse rooftops", "Multi-lane roadway network", "Paved surface parking"],
                detected_objects=["buildings", "roads", "vehicles"],
                land_use=["urban", "industrial"],
                warnings=[],
            )
        )
    )

    tool = VQATool(api_key="mock-key", client=mock_client)
    params = {
        "before_image": str(img_path),
        "query": "Describe this satellite scene and identify the land use.",
    }

    result = await tool.execute(params)

    assert isinstance(result, ToolResult)
    assert result.status == ToolStatus.SUCCESS.value
    assert "mixed urban-industrial" in result.answer
    assert len(result.evidence) == 5  # 3 visual observations + 1 detected_objects + 1 land_use
    assert len([e for e in result.evidence if e.type == "visual_observation"]) == 3
    assert any(e.type == "detected_objects" for e in result.evidence)
    assert any(e.type == "land_use" for e in result.evidence)
    assert result.metadata.get("capability") == "VQA"
    assert result.metadata.get("provider") == "gemini"
    assert result.metadata.get("model") == "gemini-3.6-flash"
    assert "100x100" in result.metadata.get("image_dimensions")


@pytest.mark.anyio
async def test_vqa_missing_image_returns_input_required():
    """Test B: Missing image input returns ToolStatus.INPUT_REQUIRED without calling Gemini."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock()

    tool = VQATool(api_key="mock-key", client=mock_client)
    params = {"query": "Describe this satellite scene."}

    result = await tool.execute(params)

    assert result.status == ToolStatus.INPUT_REQUIRED.value
    assert "requires a satellite image" in result.answer.lower()
    assert result.confidence is None
    assert mock_client.aio.models.generate_content.call_count == 0


@pytest.mark.anyio
async def test_vqa_invalid_corrupted_image_controlled_error(tmp_path: Path):
    """Test C: Non-existent or corrupted image path produces controlled error."""
    mock_client = MagicMock()
    tool = VQATool(api_key="mock-key", client=mock_client)

    # 1. Non-existent path
    result_missing = await tool.execute({"before_image": "non_existent_file_9876.jpg"})
    assert result_missing.status == ToolStatus.ERROR.value
    assert result_missing.confidence == 0.0
    assert result_missing.metadata.get("error_type") == "image_validation_error"

    # 2. Corrupted file content
    corrupt_path = tmp_path / "corrupt.jpg"
    corrupt_path.write_bytes(b"NOT_A_VALID_IMAGE_BYTE_STREAM")
    result_corrupt = await tool.execute({"before_image": str(corrupt_path)})
    assert result_corrupt.status == ToolStatus.ERROR.value
    assert result_corrupt.confidence == 0.0
    assert result_corrupt.metadata.get("error_type") == "image_validation_error"


@pytest.mark.anyio
async def test_vqa_tiff_image_support(tmp_path: Path):
    """Verify TIFF format (.tif/.tiff) is successfully decoded and converted for Gemini."""
    tiff_path = tmp_path / "test_satellite.tif"
    tiff_path.write_bytes(_create_test_image_bytes("TIFF", size=(80, 80)))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            VQAOutputSchema(
                answer="TIFF image analysis indicates agricultural fields with rectangular plots.",
                confidence=0.85,
                observations=["Rectangular field boundaries", "Vegetative index variations"],
                detected_objects=["crop_fields"],
                land_use=["agricultural"],
                warnings=[],
            )
        )
    )

    tool = VQATool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(tiff_path), "query": "Identify land use."})

    assert result.status == ToolStatus.SUCCESS.value
    assert result.confidence == 0.85
    assert mock_client.aio.models.generate_content.call_count == 1


# ─── 2. Failure Containment & Rate Limiting Tests ─────────────────────────────


@pytest.mark.anyio
async def test_vqa_gemini_429_rate_limit_no_retry(tmp_path: Path):
    """Test G: HTTP 429 immediately aborts without retry and returns controlled error."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_generate = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource Exhausted"}})
    )
    mock_client.aio.models.generate_content = mock_generate

    tool = VQATool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(img_path), "query": "What is visible?"})

    # Assert exactly 1 attempt: NO RETRY on 429
    assert mock_generate.call_count == 1
    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "rate_limit_exceeded"
    assert any("rate limit exceeded" in w.lower() for w in result.warnings)


@pytest.mark.anyio
async def test_vqa_gemini_timeout_controlled_error(tmp_path: Path):
    """Test F: Timeout error returns controlled error after bounded attempt."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()

    async def _hang(*args, **kwargs):
        await asyncio.sleep(1.0)

    mock_client.aio.models.generate_content = AsyncMock(side_effect=_hang)

    tool = VQATool(api_key="mock-key", client=mock_client, timeout=0.05)
    result = await tool.execute({"before_image": str(img_path), "query": "What is visible?"})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "timeout"
    assert any("timed out" in w.lower() for w in result.warnings)


@pytest.mark.anyio
async def test_vqa_gemini_malformed_response_controlled_error(tmp_path: Path):
    """Test E: Malformed JSON output triggers controlled error without crash."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    bad_resp = MagicMock()
    bad_resp.parsed = None
    bad_resp.text = '{"answer": "Missing required confidence field"}'

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(return_value=bad_resp)

    tool = VQATool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(img_path), "query": "What is visible?"})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "invalid_structured_output"


@pytest.mark.anyio
async def test_vqa_gemini_api_error_controlled_error(tmp_path: Path):
    """Test H: Generic 500/503 API error returns controlled error."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(503, {"error": {"message": "Service Unavailable"}})
    )

    tool = VQATool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(img_path), "query": "What is visible?"})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "api_error"


@pytest.mark.anyio
async def test_vqa_missing_api_key_controlled_error(tmp_path: Path):
    """Test I: Missing API key safely halts before calling network."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    tool = VQATool(api_key="", client=None)
    result = await tool.execute({"before_image": str(img_path), "query": "What is visible?"})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "missing_api_key"


# ─── 3. Orchestration, Trace, & Confidence Semantics ──────────────────────────


@pytest.mark.anyio
async def test_vqa_confidence_is_visual_answer_confidence(tmp_path: Path):
    """Test J: Top-level response confidence reflects specialist visual confidence."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            VQAOutputSchema(
                answer="Dense forest canopy with river corridor.",
                confidence=0.83,  # Visual confidence
                observations=["Uniform tree canopy", "Winding water feature"],
                land_use=["forested", "water"],
            )
        )
    )

    vqa_tool = VQATool(api_key="mock-key", client=mock_client)
    registry = ToolRegistry()
    registry.register(vqa_tool)
    executor = ToolExecutor(registry=registry)
    orch = AgentOrchestrator(tool_executor=executor)

    res = await orch.process_query(
        query="Describe this satellite scene and identify the land use.",
        before_image=str(img_path),
    )

    # Classification confidence was tentatively high (e.g. 0.95 or 1.0 from Gemini/rule-based),
    # but top-level confidence must prioritize specialist visual confidence (0.83)
    assert res["confidence"] == 0.83
    assert res["task"] == "VQA"
    assert res["tool_result"].status == "success"


@pytest.mark.anyio
async def test_vqa_execution_trace_records_tool_provider_model(tmp_path: Path):
    """Test K: Step 3 trace attributes VQA tool, Gemini provider, and model."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            VQAOutputSchema(
                answer="Urban development pattern.",
                confidence=0.90,
                observations=["Commercial structures"],
                land_use=["urban"],
            )
        )
    )

    vqa_tool = VQATool(api_key="mock-key", client=mock_client, model="gemini-3.6-flash")
    registry = ToolRegistry()
    registry.register(vqa_tool)
    executor = ToolExecutor(registry=registry)
    orch = AgentOrchestrator(tool_executor=executor)

    res = await orch.process_query(
        query="Describe this satellite scene.",
        before_image=str(img_path),
    )

    step3 = res["execution_trace"][2]
    assert step3.step == 3
    assert step3.action == "Tool Execution"
    assert "VQA_TOOL" in step3.detail
    assert "provider: gemini" in step3.detail
    assert "gemini-3.6-flash" in step3.detail
    assert step3.status == "completed"


@pytest.mark.anyio
async def test_vqa_no_fabricated_visualizations(tmp_path: Path):
    """Test L: Strict assertion that VQA returns zero fabricated bounding boxes or masks."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            VQAOutputSchema(
                answer="Airport infrastructure with parallel runways and terminal structures.",
                confidence=0.94,
                observations=["Two asphalt runways", "Central passenger terminal", "Taxiway network"],
                detected_objects=["runways", "terminals", "airplanes"],
                land_use=["airport", "transportation"],
            )
        )
    )

    tool = VQATool(api_key="mock-key", client=mock_client)
    res = await tool.execute({"before_image": str(img_path), "query": "What is visible around the airport?"})

    # Strictly empty visualization list (no fabricated graphics)
    assert res.visualizations == []
    # Grounded evidence items
    evidence_types = [e.type for e in res.evidence]
    assert "visual_observation" in evidence_types
    assert "detected_objects" in evidence_types
    assert "land_use" in evidence_types


# ─── 4. End-to-End API Integration Tests ──────────────────────────────────────


def test_vqa_api_query_end_to_end(tmp_path: Path):
    """Test POST /api/query end-to-end with mocked VQA specialist."""
    img_path = tmp_path / "api_test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    client = TestClient(app)

    with patch("backend.agents.tools.vqa.tool.VQATool._call_gemini_multimodal") as mock_vqa_call:
        mock_vqa_call.return_value = (
            VQAOutputSchema(
                answer="Dense coastal port facility with container terminals and shipping channels.",
                confidence=0.91,
                observations=["Deep-water shipping channel", "Container storage yards", "Docking piers"],
                detected_objects=["cargo_ships", "cranes", "containers"],
                land_use=["industrial", "port", "water"],
            ),
            None,
            None,
        )

        response = client.post(
            "/api/query",
            json={
                "query": "Describe this satellite scene and identify the land use.",
                "before_image": str(img_path),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "received"
        assert data["task"] == "VQA"
        assert data["confidence"] == 0.91
        assert "coastal port facility" in data["answer"]
        assert data["tool_result"]["status"] == "success"
        assert data["tool_result"]["metadata"]["capability"] == "VQA"
        assert data["tool_result"]["metadata"]["provider"] == "gemini"


def test_vqa_api_query_missing_image():
    """Test POST /api/query for VQA without image returns INPUT_REQUIRED."""
    client = TestClient(app)

    response = client.post(
        "/api/query",
        json={"query": "Describe this satellite scene and identify the land use."},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["task"] == "VQA"
    assert data["tool_result"]["status"] == "input_required"
    assert data["confidence"] is not None
    assert "requires a satellite image" in data["answer"].lower()
