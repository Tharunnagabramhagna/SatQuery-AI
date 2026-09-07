"""Deterministic unit tests for Gemini Multimodal Image Comparison Specialist Tool.

All tests in this suite mock the google-genai SDK to ensure:
  1. Deterministic execution without live Gemini API dependencies.
  2. Complete coverage of multimodal comparison scenarios (valid dual images, missing image A/B/both, corrupt image A/B, TIFF, base64).
  3. Modality awareness: Optical+Optical, SAR+SAR, Optical+SAR (cross-modal), Unknown, and Mixed modalities.
  4. Strict failure containment (HTTP 429 without retry, timeout with at most 1 retry, 401/403 auth error, malformed output, missing API key).
  5. Confidence semantics (specialist confidence on success, 0.0 on error, None on input_required).
  6. Zero fabricated coordinates, bounding boxes, or quantitative metrics in results.
  7. End-to-end integration through ToolExecutor, AgentRouter, /api/query, and /api/analysis.
"""

from __future__ import annotations

import asyncio
import base64
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
from backend.agents.tools.comparison.models import ComparisonOutputSchema, ImageValidationError
from backend.agents.tools.comparison.tool import ComparisonTool
from backend.agents.tools.executor import ToolExecutor
from backend.agents.tools.registry import ToolRegistry
from backend.main import app
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

client = TestClient(app)


def _create_test_image_bytes(format: str = "JPEG", size: tuple = (100, 100), color: str = "green") -> bytes:
    """Helper to generate in-memory image bytes."""
    img = Image.new("RGB", size, color=color)
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


def _create_mock_gemini_response(schema: ComparisonOutputSchema) -> MagicMock:
    """Helper to create a mocked Gemini response with populated .parsed and .text attributes."""
    mock_resp = MagicMock()
    mock_resp.parsed = schema
    mock_resp.text = schema.model_dump_json()
    return mock_resp


# ─── 1. Basic Dual-Image Comparison & Input Validation ─────────────────────────


@pytest.mark.anyio
async def test_comparison_valid_images_success(tmp_path: Path):
    """Test 1: Valid Image A and Image B produces successful ToolResult with structured evidence."""
    path_a = tmp_path / "sat_a.jpg"
    path_b = tmp_path / "sat_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG", color="blue"))
    path_b.write_bytes(_create_test_image_bytes("JPEG", color="green"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Image A depicts open water while Image B shows vegetated shoreline expansion.",
                confidence=0.88,
                similarities=["Both scenes share identical coastal boundary geometry"],
                differences=["Image B exhibits dense vegetation cover absent in Image A"],
                observations=["Clear atmospheric conditions", "High contrast coastal interface"],
                warnings=[],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    params = {
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Compare these two satellite images.",
    }

    result = await tool.execute(params)

    assert isinstance(result, ToolResult)
    assert result.status == ToolStatus.SUCCESS.value
    assert "Image A depicts open water" in result.answer
    assert result.confidence == 0.88
    assert len(result.evidence) == 4  # 1 similarity + 1 difference + 2 observations
    assert any(e.type == "similarity" for e in result.evidence)
    assert any(e.type == "difference" for e in result.evidence)
    assert any(e.type == "visual_observation" for e in result.evidence)
    assert result.metadata.get("capability") == "COMPARISON"
    assert result.metadata.get("provider") == "gemini"
    assert result.metadata.get("model") == "gemini-3.6-flash"
    assert result.visualizations == []  # Zero fabricated visualizations


@pytest.mark.anyio
async def test_comparison_missing_first_image(tmp_path: Path):
    """Test 2: Missing first image (before_image) returns INPUT_REQUIRED without calling Gemini."""
    path_b = tmp_path / "sat_b.jpg"
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock()

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    params = {"after_image": str(path_b), "query": "Compare images."}

    result = await tool.execute(params)

    assert result.status == ToolStatus.INPUT_REQUIRED.value
    assert result.confidence is None
    assert "requires two satellite images" in result.answer.lower()
    assert mock_client.aio.models.generate_content.call_count == 0


@pytest.mark.anyio
async def test_comparison_missing_second_image(tmp_path: Path):
    """Test 3: Missing second image (after_image) returns INPUT_REQUIRED without calling Gemini."""
    path_a = tmp_path / "sat_a.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock()

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    params = {"before_image": str(path_a), "query": "Compare images."}

    result = await tool.execute(params)

    assert result.status == ToolStatus.INPUT_REQUIRED.value
    assert result.confidence is None
    assert "requires two satellite images" in result.answer.lower()
    assert mock_client.aio.models.generate_content.call_count == 0


@pytest.mark.anyio
async def test_comparison_both_images_missing():
    """Test 4: Both images missing returns INPUT_REQUIRED without calling Gemini."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock()

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    params = {"query": "Compare images."}

    result = await tool.execute(params)

    assert result.status == ToolStatus.INPUT_REQUIRED.value
    assert result.confidence is None
    assert mock_client.aio.models.generate_content.call_count == 0


@pytest.mark.anyio
async def test_comparison_corrupt_first_image(tmp_path: Path):
    """Test 5: Corrupt first image returns controlled ToolStatus.ERROR with confidence=0.0."""
    bad_file = tmp_path / "corrupt_a.jpg"
    bad_file.write_bytes(b"NOT_A_VALID_IMAGE_BYTES_12345")
    good_file = tmp_path / "good_b.jpg"
    good_file.write_bytes(_create_test_image_bytes("JPEG"))

    tool = ComparisonTool(api_key="mock-key", client=MagicMock())
    result = await tool.execute({"before_image": str(bad_file), "after_image": str(good_file)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "image_validation_error"
    assert result.metadata.get("target_image") == "image_a"
    assert len(result.warnings) >= 1


@pytest.mark.anyio
async def test_comparison_corrupt_second_image(tmp_path: Path):
    """Test 6: Corrupt second image returns controlled ToolStatus.ERROR with confidence=0.0."""
    good_file = tmp_path / "good_a.jpg"
    good_file.write_bytes(_create_test_image_bytes("JPEG"))
    bad_file = tmp_path / "corrupt_b.jpg"
    bad_file.write_bytes(b"NOT_A_VALID_IMAGE_BYTES_12345")

    tool = ComparisonTool(api_key="mock-key", client=MagicMock())
    result = await tool.execute({"before_image": str(good_file), "after_image": str(bad_file)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "image_validation_error"
    assert result.metadata.get("target_image") == "image_b"
    assert len(result.warnings) >= 1


@pytest.mark.anyio
async def test_comparison_unsupported_file_type(tmp_path: Path):
    """Test 7: Unsupported file type returns controlled ToolStatus.ERROR."""
    bmp_file = tmp_path / "unsupported.bmp"
    bmp_file.write_bytes(b"BMP_HEADER_DATA")
    good_file = tmp_path / "good.jpg"
    good_file.write_bytes(_create_test_image_bytes("JPEG"))

    tool = ComparisonTool(api_key="mock-key", client=MagicMock())
    result = await tool.execute({"before_image": str(bmp_file), "after_image": str(good_file)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert "Unsupported image extension" in result.warnings[0]


# ─── 2. Gemini Response Handling & Failure Containment ────────────────────────


@pytest.mark.anyio
async def test_comparison_successful_structured_response(tmp_path: Path):
    """Test 8: Successful structured Gemini response parsed cleanly."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Structural road network remains intact; significant commercial development added.",
                confidence=0.92,
                similarities=["Identical highway interchange layout"],
                differences=["New warehouse complex in southwest quadrant"],
                observations=["Clear atmospheric visibility across both acquisitions"],
                warnings=["Slight sun-angle illumination variation observed"],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.SUCCESS.value
    assert result.confidence == 0.92
    assert len(result.evidence) == 3
    assert result.warnings == ["Slight sun-angle illumination variation observed"]


@pytest.mark.anyio
async def test_comparison_malformed_gemini_response(tmp_path: Path):
    """Test 9: Malformed JSON output returns controlled ToolStatus.ERROR with confidence=0.0."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_resp = MagicMock()
    mock_resp.parsed = None
    mock_resp.text = "NOT_A_VALID_JSON_OBJECT"

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_resp)

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "invalid_structured_output"


@pytest.mark.anyio
async def test_comparison_gemini_429_rate_limit(tmp_path: Path):
    """Test 10: Gemini 429 produces controlled error with NO retry."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Rate limit exceeded"}})
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "rate_limit_exceeded"
    # STRICT: exactly 1 call, zero retry on 429
    assert mock_client.aio.models.generate_content.call_count == 1


@pytest.mark.anyio
async def test_comparison_gemini_timeout(tmp_path: Path):
    """Test 11: Gemini timeout allows at most 1 controlled retry (total 2 attempts)."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=asyncio.TimeoutError())

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "timeout"
    # STRICT: exactly 2 attempts (1 initial + 1 retry)
    assert mock_client.aio.models.generate_content.call_count == 2


@pytest.mark.anyio
async def test_comparison_gemini_401_403_auth_error(tmp_path: Path):
    """Test 12: Gemini 401/403 authentication failure halts immediately without retry."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(403, {"error": {"message": "Permission denied / Invalid API key"}})
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "authentication_error"
    assert mock_client.aio.models.generate_content.call_count == 1


@pytest.mark.anyio
async def test_comparison_missing_api_key(tmp_path: Path):
    """Test 13: Missing API key returns controlled configuration error without calling Gemini."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    tool = ComparisonTool(api_key="", client=None)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("error_type") == "missing_api_key"


# ─── 3. Confidence Semantics & Warnings Preservation ──────────────────────────


@pytest.mark.anyio
async def test_comparison_confidence_propagation_on_success(tmp_path: Path):
    """Test 14: Top-level confidence matches specialist model confidence on success."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Clear differences observed in land cover.",
                confidence=0.8456,
                similarities=["Similar topography"],
                differences=["Deforestation in east sector"],
                observations=[],
                warnings=[],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.confidence == 0.8456


@pytest.mark.anyio
async def test_comparison_confidence_zero_on_actual_error(tmp_path: Path):
    """Test 15: On actual error, confidence is strictly 0.0."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=RuntimeError("Internal API failure"))

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0


@pytest.mark.anyio
async def test_comparison_warnings_preserved(tmp_path: Path):
    """Test 16: Model warnings are preserved in ToolResult.warnings."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    warnings = [
        "Partial cloud shadow affects southern quadrant of Image B.",
        "Slight resolution discrepancy between sensor acquisitions.",
    ]

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Comparison completed with caveats.",
                confidence=0.65,
                similarities=[],
                differences=[],
                observations=[],
                warnings=warnings,
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(path_a), "after_image": str(path_b)})

    assert result.warnings == warnings


# ─── 4. ToolExecutor & AgentRouter Integration ────────────────────────────────


@pytest.mark.anyio
async def test_tool_executor_invokes_comparison_tool(tmp_path: Path):
    """Test 17: ToolExecutor properly invokes ComparisonTool when routed."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Executor test comparison response.",
                confidence=0.91,
                similarities=["Road network alignment"],
                differences=[],
                observations=[],
                warnings=[],
            )
        )
    )

    registry = ToolRegistry()
    real_tool = ComparisonTool(api_key="mock-key", client=mock_client)
    registry.register(real_tool)
    executor = ToolExecutor(registry=registry)

    rd = RoutingDecision(
        selected_tool=ToolIdentifier.COMPARISON_TOOL,
        intent=QueryIntent.COMPARISON,
        routing_confidence=0.88,
        reason="Comparison test",
        requires_clarification=False,
        parameters={"before_image": str(path_a), "after_image": str(path_b)},
    )

    result = await executor.execute(rd)

    assert result.status == ToolStatus.SUCCESS.value
    assert "Executor test comparison response" in result.answer
    assert result.tool_name == ToolIdentifier.COMPARISON_TOOL.value


@pytest.mark.anyio
async def test_agent_router_routes_comparison():
    """Test 18: AgentRouter routes QueryIntent.COMPARISON to ToolIdentifier.COMPARISON_TOOL."""
    router = AgentRouter()
    structured = StructuredQuery(
        original_query="Compare the land use between these two satellite images.",
        intent=QueryIntent.COMPARISON,
        confidence=0.92,
        is_ambiguous=False,
    )

    decision = await router.route(structured)

    assert decision.selected_tool == ToolIdentifier.COMPARISON_TOOL
    assert decision.intent == QueryIntent.COMPARISON
    assert not decision.requires_clarification


# ─── 5. Format Support (Base64 & TIFF) ─────────────────────────────────────────


@pytest.mark.anyio
async def test_comparison_base64_inputs():
    """Test 19: Base64-encoded Image A and Image B inputs are properly decoded and processed."""
    raw_a = _create_test_image_bytes("JPEG", color="red")
    raw_b = _create_test_image_bytes("JPEG", color="blue")
    b64_a = f"data:image/jpeg;base64,{base64.b64encode(raw_a).decode('ascii')}"
    b64_b = base64.b64encode(raw_b).decode("ascii")

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Base64 input comparison successful.",
                confidence=0.90,
                similarities=["Structural symmetry"],
                differences=["Color contrast shift"],
                observations=[],
                warnings=[],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": b64_a, "after_image": b64_b})

    assert result.status == ToolStatus.SUCCESS.value
    assert "Base64 input comparison successful" in result.answer


@pytest.mark.anyio
async def test_comparison_tiff_inputs(tmp_path: Path):
    """Test 20: TIFF format inputs are converted to JPEG in memory and sent to Gemini."""
    tiff_a = tmp_path / "scene_a.tif"
    tiff_b = tmp_path / "scene_b.tiff"
    tiff_a.write_bytes(_create_test_image_bytes("TIFF", color="cyan"))
    tiff_b.write_bytes(_create_test_image_bytes("TIFF", color="magenta"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="TIFF dual image comparison successful.",
                confidence=0.87,
                similarities=["Co-registered coastline"],
                differences=["Water body surface area reduced"],
                observations=[],
                warnings=[],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({"before_image": str(tiff_a), "after_image": str(tiff_b)})

    assert result.status == ToolStatus.SUCCESS.value
    assert "TIFF dual image comparison successful" in result.answer


# ─── 6. First-Class Modality-Aware Comparison Tests ────────────────────────────


@pytest.mark.anyio
async def test_comparison_optical_optical_modality(tmp_path: Path):
    """Test 21: Optical + Optical comparison passes modality metadata and formats prompt accordingly."""
    path_a = tmp_path / "opt_a.jpg"
    path_b = tmp_path / "opt_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    captured_prompt = None

    async def mock_generate(model, contents, config):
        nonlocal captured_prompt
        # The prompt string is the last element in contents
        captured_prompt = contents[-1]
        return _create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Optical-to-optical comparison shows green canopy reduction.",
                confidence=0.91,
                similarities=["Unchanged road alignments"],
                differences=["Vegetation canopy loss in north sector"],
                observations=["True-color RGB imagery"],
                warnings=[],
            )
        )

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=mock_generate)

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "image_a_modality": "optical",
        "image_b_modality": "optical",
        "query": "Compare vegetation health.",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("modality_a") == "optical"
    assert result.metadata.get("modality_b") == "optical"
    assert result.metadata.get("is_cross_modal") is False
    assert "Both images are Optical imagery" in captured_prompt
    assert "OPTICAL" in captured_prompt


@pytest.mark.anyio
async def test_comparison_sar_sar_modality(tmp_path: Path):
    """Test 22: SAR + SAR comparison passes modality metadata and formats radar-specific prompt."""
    path_a = tmp_path / "sar_a.png"
    path_b = tmp_path / "sar_b.png"
    path_a.write_bytes(_create_test_image_bytes("PNG"))
    path_b.write_bytes(_create_test_image_bytes("PNG"))

    captured_prompt = None

    async def mock_generate(model, contents, config):
        nonlocal captured_prompt
        captured_prompt = contents[-1]
        return _create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="SAR comparison reveals enhanced double-bounce backscatter indicating new structures.",
                confidence=0.86,
                similarities=["Consistent calm water specular reflectance in harbor"],
                differences=["High-intensity backscatter cluster in dock area"],
                observations=["Radar backscatter intensity variations observed"],
                warnings=["Speckle noise is present across both acquisitions"],
            )
        )

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=mock_generate)

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "before_image_modality": "sar",
        "after_image_modality": "sar",
        "query": "Compare SAR backscatter signatures.",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("modality_a") == "sar"
    assert result.metadata.get("modality_b") == "sar"
    assert result.metadata.get("is_cross_modal") is False
    assert "Both images are SAR" in captured_prompt
    assert "radar backscatter" in captured_prompt.lower()


@pytest.mark.anyio
async def test_comparison_optical_sar_cross_modal(tmp_path: Path):
    """Test 23: Optical + SAR comparison formats cross-modal prompt instructing model not to confuse sensor physics with physical change."""
    path_a = tmp_path / "optical.jpg"
    path_b = tmp_path / "sar.png"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("PNG"))

    captured_prompt = None

    async def mock_generate(model, contents, config):
        nonlocal captured_prompt
        captured_prompt = contents[-1]
        return _create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Cross-modal analysis correlates optical vegetation areas with lower radar backscatter, while urban structures exhibit strong double-bounce signatures.",
                confidence=0.83,
                similarities=["Geometric coastline boundaries match between optical reflectance and radar water-land interface"],
                differences=["Optical highlights spectral color variances while SAR captures structural roughness"],
                observations=["Complementary sensing modalities provide multi-aspect ground understanding"],
                warnings=["Images represent fundamentally different sensing modalities (Optical vs SAR). Visual differences reflect sensor physics rather than temporal change."],
            )
        )

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=mock_generate)

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "image_a_modality": "optical",
        "image_b_modality": "sar",
        "query": "Compare the optical and SAR imagery.",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("modality_a") == "optical"
    assert result.metadata.get("modality_b") == "sar"
    assert result.metadata.get("is_cross_modal") is True
    # CRITICAL: Verify cross-modal rules in prompt
    assert "CROSS-MODAL COMPARISON (Optical vs. SAR)" in captured_prompt
    assert "Do NOT treat differences in color, brightness, tone, or visual texture" in captured_prompt
    assert len(result.warnings) >= 1
    assert "different sensing modalities" in result.warnings[0].lower()


@pytest.mark.anyio
async def test_comparison_unknown_modality(tmp_path: Path):
    """Test 24: Unknown or omitted modalities do not trigger guessing and execute normally."""
    path_a = tmp_path / "img_a.jpg"
    path_b = tmp_path / "img_b.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    captured_prompt = None

    async def mock_generate(model, contents, config):
        nonlocal captured_prompt
        captured_prompt = contents[-1]
        return _create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Visual comparison completed without declared sensor modalities.",
                confidence=0.80,
                similarities=["Overall layout"],
                differences=[],
                observations=[],
                warnings=[],
            )
        )

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=mock_generate)

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        # Modalities omitted
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("modality_a") == "unknown"
    assert result.metadata.get("modality_b") == "unknown"
    assert result.metadata.get("is_cross_modal") is False
    assert "UNKNOWN" in captured_prompt
    assert "without guessing unverified sensor types" in captured_prompt


@pytest.mark.anyio
async def test_comparison_mixed_known_unknown_modality(tmp_path: Path):
    """Test 25: One image has known modality and the other is unknown; tool preserves metadata without guessing."""
    path_a = tmp_path / "opt.jpg"
    path_b = tmp_path / "other.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Comparison with partial modality declaration.",
                confidence=0.82,
                similarities=[],
                differences=[],
                observations=[],
                warnings=[],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "image_a_modality": "optical",
        # image_b_modality omitted
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("modality_a") == "optical"
    assert result.metadata.get("modality_b") == "unknown"


@pytest.mark.anyio
async def test_comparison_modality_does_not_affect_decoding(tmp_path: Path):
    """Test 26: Declaring modality as SAR does not alter the safe image decoding path."""
    sar_jpg = tmp_path / "radar.jpg"
    opt_jpg = tmp_path / "visible.jpg"
    sar_jpg.write_bytes(_create_test_image_bytes("JPEG", color="gray"))
    opt_jpg.write_bytes(_create_test_image_bytes("JPEG", color="green"))

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Decoding unaffected by modality metadata.",
                confidence=0.88,
                similarities=[],
                differences=[],
                observations=[],
                warnings=[],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(sar_jpg),
        "after_image": str(opt_jpg),
        "before_image_modality": "sar",
        "after_image_modality": "optical",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert "100x100" in result.metadata.get("image_a_dimensions")
    assert "100x100" in result.metadata.get("image_b_dimensions")


@pytest.mark.anyio
async def test_comparison_cross_modal_warning_preservation(tmp_path: Path):
    """Test 27: Cross-modal comparison preserves model-generated caveats about sensing differences."""
    path_a = tmp_path / "opt.jpg"
    path_b = tmp_path / "sar.png"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("PNG"))

    caveat = "Cross-sensor comparison: radiometric differences cannot be interpreted as geometric surface change."
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_gemini_response(
            ComparisonOutputSchema(
                answer="Cross-sensor comparison complete.",
                confidence=0.79,
                similarities=[],
                differences=[],
                observations=[],
                warnings=[caveat],
            )
        )
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_client)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "image_a_modality": "optical",
        "image_b_modality": "sar",
    })

    assert caveat in result.warnings


def test_comparison_prompt_construction_contains_modalities():
    """Test 28: Prompt builder includes declared modalities and specific rules."""
    tool = ComparisonTool(api_key="mock-key")

    # Optical + SAR
    prompt = tool._build_comparison_prompt("Compare roads", "optical", "sar")
    assert "OPTICAL" in prompt
    assert "SAR" in prompt
    assert "CROSS-MODAL COMPARISON" in prompt

    # SAR + SAR
    prompt_sar = tool._build_comparison_prompt("Compare roughness", "sar", "sar")
    assert "Both images are SAR" in prompt_sar

    # Optical + Optical
    prompt_opt = tool._build_comparison_prompt("Compare vegetation", "optical", "optical")
    assert "Both images are Optical imagery" in prompt_opt


# ─── 7. End-to-End API Integration ─────────────────────────────────────────────


def test_api_query_comparison_e2e(tmp_path: Path):
    """Test 29: POST /api/query end-to-end integration for COMPARISON query."""
    path_a = tmp_path / "before.jpg"
    path_b = tmp_path / "after.jpg"
    path_a.write_bytes(_create_test_image_bytes("JPEG"))
    path_b.write_bytes(_create_test_image_bytes("JPEG"))

    with patch.object(
        ComparisonTool,
        "_call_gemini_multimodal",
        new=AsyncMock(
            return_value=(
                ComparisonOutputSchema(
                    answer="E2E comparison reveals clear expansion of commercial footprint.",
                    confidence=0.89,
                    similarities=["Major transport spine unchanged"],
                    differences=["New warehouse structure in east sector"],
                    observations=["Comparable nadir viewing geometry"],
                    warnings=[],
                ),
                None,
                None,
            )
        ),
    ):
        response = client.post(
            "/api/query",
            json={
                "query": "Compare these two satellite images.",
                "before_image": str(path_a),
                "after_image": str(path_b),
                "before_image_modality": "optical",
                "after_image_modality": "optical",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["task"] == "COMPARISON"
        assert data["routing_decision"]["selected_tool"] == "COMPARISON_TOOL"
        assert data["confidence"] == 0.89
        assert "E2E comparison reveals" in data["answer"]
        assert len(data["evidence"]) == 3
        assert data["visualizations"] == []  # Zero fabricated visualizations

        # Verify 3-step execution trace
        trace = data["execution_trace"]
        assert len(trace) == 3
        assert trace[0]["action"] == "Query Understanding"
        assert trace[1]["action"] == "Agent Routing"
        assert trace[2]["action"] == "Tool Execution"
        assert "COMPARISON_TOOL" in trace[2]["detail"]
        assert trace[2]["status"] == "completed"


def test_api_analysis_comparison_multipart_e2e():
    """Test 30: POST /api/analysis multipart upload end-to-end integration for COMPARISON."""
    img_a_bytes = _create_test_image_bytes("JPEG", color="yellow")
    img_b_bytes = _create_test_image_bytes("JPEG", color="purple")

    with patch.object(
        ComparisonTool,
        "_call_gemini_multimodal",
        new=AsyncMock(
            return_value=(
                ComparisonOutputSchema(
                    answer="Multipart upload comparison successful.",
                    confidence=0.93,
                    similarities=["Boundary lines intact"],
                    differences=["Color variation across terrain"],
                    observations=[],
                    warnings=[],
                ),
                None,
                None,
            )
        ),
    ):
        response = client.post(
            "/api/analysis",
            data={
                "query": "Compare these two satellite images.",
                "before_modality": "optical",
                "after_modality": "optical",
            },
            files={
                "before_image": ("scene1.jpg", img_a_bytes, "image/jpeg"),
                "after_image": ("scene2.jpg", img_b_bytes, "image/jpeg"),
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "Multipart upload comparison successful" in data["answer"]
        assert data["confidence"] == 0.93
        assert data["task"] == "comparison"
        assert len(data["executionTrace"]) == 3
