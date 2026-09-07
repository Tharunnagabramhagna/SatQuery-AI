"""Deterministic unit tests for optional local Qwen3-VL fallback in SatQuery AI.

Tests all requirements:
1. Gemini succeeds -> Qwen is NOT called
2. Gemini HTTP 429 -> Qwen called and succeeds
3. Gemini timeout -> Qwen called and succeeds
4. Gemini missing API key -> Qwen called and succeeds
5. Ollama unavailable -> honest failure, no crash, no fabrication
6. Qwen malformed JSON -> validation failure, no fabrication
7. Qwen timeout -> honest bounded failure rather than hanging
8. Invalid image input -> does not invoke Qwen fallback
9. ENABLE_OLLAMA_FALLBACK=False -> does not contact Ollama
10. Comparison Gemini succeeds -> Qwen is NOT called
11. Comparison Gemini 429 -> Qwen called and succeeds
12. Comparison Gemini timeout -> Qwen called and succeeds
13. Comparison Ollama unavailable -> honest failure
14. Comparison Qwen malformed response -> honest failure
15. Grounding tool -> Qwen is NEVER called
16. Change Detection tool -> Qwen is NEVER called
17. QwenOllamaAdapter HTTP parsing, JSON code fences, normalization
18. Ollama stopped does not prevent backend startup or ToolRegistry creation
19. QwenOllamaAdapter has no grounding method
"""

from __future__ import annotations

import asyncio
import io
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from PIL import Image
from google.genai import errors as genai_errors

from backend.agents.tools.change_detection.tool import ChangeDetectionTool
from backend.agents.tools.comparison.models import ComparisonOutputSchema
from backend.agents.tools.comparison.tool import ComparisonTool
from backend.agents.tools.grounding.tool import GroundingTool
from backend.agents.tools.registry import ToolRegistry
from backend.agents.tools.vqa.models import VQAOutputSchema
from backend.agents.tools.vqa.tool import VQATool
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus
from backend.services.ollama import (
    QwenOllamaAdapter,
    _extract_json_object,
    _normalize_comparison_fields,
    _normalize_vqa_fields,
    _strip_markdown_code_fences,
)


def _create_test_image_bytes(format: str = "JPEG", size: tuple = (100, 100), color: str = "green") -> bytes:
    """Helper to generate in-memory image bytes."""
    img = Image.new("RGB", size, color=color)
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


# ─── 1. VQA Fallback Tests ───────────────────────────────────────────────────


@pytest.mark.anyio
async def test_vqa_gemini_success_does_not_contact_ollama(tmp_path: Path):
    """Test 1: When Gemini succeeds, Qwen fallback is never called."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_resp = MagicMock()
    mock_resp.parsed = VQAOutputSchema(
        answer="A dense forested area with a winding river.",
        confidence=0.92,
        observations=["Dense canopy", "Meandering river course"],
        detected_objects=["trees", "water body"],
        land_use=["forestry"],
        warnings=[],
    )
    mock_gemini.aio.models.generate_content = AsyncMock(return_value=mock_resp)

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock()

    tool = VQATool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "Describe the vegetation."})

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("provider") == "gemini"
    assert result.metadata.get("fallback") is not True
    mock_adapter.vqa.assert_not_called()


@pytest.mark.anyio
async def test_vqa_gemini_429_triggers_qwen_fallback_success(tmp_path: Path):
    """Test 2: When Gemini returns HTTP 429, Qwen fallback is invoked and returns compatible result."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    qwen_schema = VQAOutputSchema(
        answer="Local Qwen observed agricultural crop fields with irrigation channels.",
        confidence=0.81,
        observations=["Rectilinear field boundaries", "Active crop irrigation"],
        detected_objects=["crop fields", "irrigation ditches"],
        land_use=["agricultural"],
        warnings=["Analyzed via local fallback model."],
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock(return_value=(qwen_schema, None, None))

    tool = VQATool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "What land use is shown?"})

    assert result.status == ToolStatus.SUCCESS.value
    assert "Local Qwen observed agricultural" in result.answer
    assert result.confidence == 0.81
    assert result.metadata.get("provider") == "qwen"
    assert result.metadata.get("model") == "qwen-satquery"
    assert result.metadata.get("fallback") is True
    assert result.metadata.get("fallback_reason") == "rate_limit_exceeded"
    assert any(e.source == "Qwen VQA (qwen-satquery)" for e in result.evidence)
    mock_adapter.vqa.assert_called_once()


@pytest.mark.anyio
async def test_vqa_gemini_timeout_triggers_qwen_fallback(tmp_path: Path):
    """Test 3: When Gemini times out, Qwen fallback is invoked."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()

    async def _hang(*args, **kwargs):
        await asyncio.sleep(1.0)

    mock_gemini.aio.models.generate_content = AsyncMock(side_effect=_hang)

    qwen_schema = VQAOutputSchema(
        answer="Observed an industrial warehouse complex.",
        confidence=0.84,
        observations=["Flat metallic roof structures"],
        detected_objects=["buildings"],
        land_use=["industrial"],
        warnings=[],
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock(return_value=(qwen_schema, None, None))

    tool = VQATool(api_key="mock-key", client=mock_gemini, timeout=0.05, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "Describe the facilities."})

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("provider") == "qwen"
    assert result.metadata.get("fallback") is True
    assert result.metadata.get("fallback_reason") == "timeout"
    mock_adapter.vqa.assert_called_once()


@pytest.mark.anyio
async def test_vqa_gemini_missing_api_key_triggers_qwen_fallback(tmp_path: Path):
    """Test 4: When Gemini API key is missing, Qwen fallback is invoked if configured."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    qwen_schema = VQAOutputSchema(
        answer="Harbor facility with container ships and berths.",
        confidence=0.87,
        observations=["Docks with cranes", "Moored cargo ships"],
        detected_objects=["ships", "piers"],
        land_use=["port"],
        warnings=[],
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock(return_value=(qwen_schema, None, None))

    tool = VQATool(api_key="", client=None, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "Describe the coastline."})

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("provider") == "qwen"
    assert result.metadata.get("fallback_reason") == "missing_api_key"
    mock_adapter.vqa.assert_called_once()


@pytest.mark.anyio
async def test_vqa_ollama_unavailable_honest_failure(tmp_path: Path):
    """Test 5: When Gemini 429 occurs and Ollama is stopped/unreachable, fail honestly without crash."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock(
        return_value=(None, "provider_unavailable", "Local Ollama server is unavailable at http://127.0.0.1:11434.")
    )

    tool = VQATool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "Describe the scene."})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("fallback_attempted") is True
    assert result.metadata.get("fallback_error") == "provider_unavailable"
    assert any("Gemini API rate limit exceeded" in w for w in result.warnings)
    assert any("Local Qwen fallback failed" in w for w in result.warnings)


@pytest.mark.anyio
async def test_vqa_qwen_malformed_json_honest_failure(tmp_path: Path):
    """Test 6: When Qwen returns malformed JSON, return validation error without fabricating data."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock(
        return_value=(None, "invalid_structured_output", "Qwen response could not be parsed as valid JSON.")
    )

    tool = VQATool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "Describe the scene."})

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("fallback_attempted") is True
    assert result.metadata.get("fallback_error") == "invalid_structured_output"


@pytest.mark.anyio
async def test_vqa_qwen_timeout_honest_failure(tmp_path: Path):
    """Test 7: When Qwen times out, return bounded honest failure without hanging."""
    img_path = tmp_path / "test_sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.vqa = AsyncMock(
        return_value=(None, "timeout", "Ollama Qwen VQA timed out after 90.0s.")
    )

    tool = VQATool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({"before_image": str(img_path), "query": "Describe the scene."})

    assert result.status == ToolStatus.ERROR.value
    assert result.metadata.get("fallback_error") == "timeout"
    assert any("timed out" in w.lower() for w in result.warnings)


@pytest.mark.anyio
async def test_vqa_invalid_image_does_not_invoke_qwen(tmp_path: Path):
    """Test 8: Invalid inputs (missing image, corrupt file) must NEVER invoke Qwen fallback."""
    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.vqa = AsyncMock()

    tool = VQATool(api_key="mock-key", client=MagicMock(), fallback_adapter=mock_adapter)

    # Missing image
    result1 = await tool.execute({"query": "What is visible?"})
    assert result1.status == ToolStatus.INPUT_REQUIRED.value
    mock_adapter.vqa.assert_not_called()

    # Corrupt image
    corrupt_file = tmp_path / "corrupt.jpg"
    corrupt_file.write_bytes(b"not a valid jpeg file data")
    result2 = await tool.execute({"before_image": str(corrupt_file), "query": "What is visible?"})
    assert result2.status == ToolStatus.ERROR.value
    assert result2.metadata.get("error_type") == "image_validation_error"
    mock_adapter.vqa.assert_not_called()


@pytest.mark.anyio
async def test_vqa_fallback_disabled_does_not_contact_ollama(tmp_path: Path):
    """Test 9: When fallback is disabled, Qwen is not contacted even on Gemini 429."""
    img_path = tmp_path / "sat.jpg"
    img_path.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    tool = VQATool(api_key="mock-key", client=mock_gemini, fallback_adapter=None, enable_fallback=False)
    result = await tool.execute({"before_image": str(img_path), "query": "What is visible?"})

    assert result.status == ToolStatus.ERROR.value
    assert result.metadata.get("error_type") == "rate_limit_exceeded"
    assert result.metadata.get("fallback_attempted") is not True


# ─── 2. Comparison Fallback Tests ───────────────────────────────────────────


@pytest.mark.anyio
async def test_comparison_gemini_success_does_not_contact_ollama(tmp_path: Path):
    """Test 10: When Gemini comparison succeeds, Qwen fallback is never called."""
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_a.write_bytes(_create_test_image_bytes())
    path_b.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_resp = MagicMock()
    mock_resp.parsed = ComparisonOutputSchema(
        answer="Clear expansion of residential neighborhood.",
        confidence=0.91,
        similarities=["Road network preserved"],
        differences=["New residential housing tracts"],
        observations=["High resolution optical imagery"],
        warnings=[],
    )
    mock_gemini.aio.models.generate_content = AsyncMock(return_value=mock_resp)

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.compare = AsyncMock()

    tool = ComparisonTool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Compare changes.",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("provider") == "gemini"
    assert result.metadata.get("fallback") is not True
    mock_adapter.compare.assert_not_called()


@pytest.mark.anyio
async def test_comparison_gemini_429_triggers_qwen_fallback_success(tmp_path: Path):
    """Test 11: When Gemini comparison returns 429, Qwen fallback returns valid Comparison contract."""
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_a.write_bytes(_create_test_image_bytes())
    path_b.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    qwen_schema = ComparisonOutputSchema(
        answer="Local Qwen: Agricultural land converted to commercial warehouse park.",
        confidence=0.83,
        similarities=["Main access highway unchanged"],
        differences=["Agricultural crops replaced with warehouses", "New paved parking"],
        observations=["Paved road connections added"],
        warnings=["Analyzed via local fallback comparison model."],
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.compare = AsyncMock(return_value=(qwen_schema, None, None))

    tool = ComparisonTool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Compare these two scenes.",
        "before_image_modality": "optical",
        "after_image_modality": "optical",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert "Local Qwen: Agricultural land" in result.answer
    assert result.confidence == 0.83
    assert result.metadata.get("provider") == "qwen"
    assert result.metadata.get("model") == "qwen-satquery"
    assert result.metadata.get("fallback") is True
    assert result.metadata.get("fallback_reason") == "rate_limit_exceeded"
    assert len([e for e in result.evidence if e.type == "similarity"]) == 1
    assert len([e for e in result.evidence if e.type == "difference"]) == 2
    mock_adapter.compare.assert_called_once()


@pytest.mark.anyio
async def test_comparison_gemini_timeout_triggers_qwen_fallback(tmp_path: Path):
    """Test 12: When Gemini comparison times out, Qwen fallback is invoked."""
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_a.write_bytes(_create_test_image_bytes())
    path_b.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()

    async def _hang(*args, **kwargs):
        await asyncio.sleep(1.0)

    mock_gemini.aio.models.generate_content = AsyncMock(side_effect=_hang)

    qwen_schema = ComparisonOutputSchema(
        answer="Vegetation reduction observed along the riverbank.",
        confidence=0.80,
        similarities=["River course stable"],
        differences=["Cleared riparian buffer"],
        observations=[],
        warnings=[],
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.compare = AsyncMock(return_value=(qwen_schema, None, None))

    tool = ComparisonTool(api_key="mock-key", client=mock_gemini, timeout=0.05, fallback_adapter=mock_adapter)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Compare riverbank.",
    })

    assert result.status == ToolStatus.SUCCESS.value
    assert result.metadata.get("provider") == "qwen"
    assert result.metadata.get("fallback_reason") == "timeout"
    mock_adapter.compare.assert_called_once()


@pytest.mark.anyio
async def test_comparison_ollama_unavailable_honest_failure(tmp_path: Path):
    """Test 13: When Gemini comparison fails with 429 and Ollama is stopped, fail honestly."""
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_a.write_bytes(_create_test_image_bytes())
    path_b.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.compare = AsyncMock(
        return_value=(None, "provider_unavailable", "Local Ollama server is unavailable.")
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Compare changes.",
    })

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("fallback_attempted") is True
    assert result.metadata.get("fallback_error") == "provider_unavailable"


@pytest.mark.anyio
async def test_comparison_invalid_inputs_do_not_invoke_qwen(tmp_path: Path):
    """Test 14: Missing or invalid comparison imagery must NOT trigger Qwen fallback."""
    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.compare = AsyncMock()

    tool = ComparisonTool(api_key="mock-key", client=MagicMock(), fallback_adapter=mock_adapter)

    # Missing second image
    img_a = tmp_path / "a.jpg"
    img_a.write_bytes(_create_test_image_bytes())
    result1 = await tool.execute({"before_image": str(img_a), "query": "Compare"})
    assert result1.status == ToolStatus.INPUT_REQUIRED.value
    mock_adapter.compare.assert_not_called()


# ─── 3. Strict Specialist Isolation Tests (Grounding & Change Detection) ─────


@pytest.mark.anyio
async def test_grounding_never_invokes_qwen():
    """Test 15: GroundingTool must NEVER have a Qwen fallback adapter or call Qwen."""
    tool = GroundingTool()
    assert not hasattr(tool, "fallback_adapter")
    assert not hasattr(tool, "enable_fallback")


@pytest.mark.anyio
async def test_change_detection_never_invokes_qwen(tmp_path: Path):
    """Test 16: ChangeDetectionTool is pure local deterministic CV and never invokes Qwen."""
    tool = ChangeDetectionTool()
    assert not hasattr(tool, "fallback_adapter")
    assert not hasattr(tool, "enable_fallback")

    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_a.write_bytes(_create_test_image_bytes(color="red"))
    path_b.write_bytes(_create_test_image_bytes(color="blue"))

    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Detect changes",
    })
    assert result.status in (ToolStatus.SUCCESS.value, ToolStatus.COMPLETED.value)
    assert result.metadata.get("capability") == "CHANGE_DETECTION"
    assert "qwen" not in str(result.metadata).lower()


# ─── 4. QwenOllamaAdapter HTTP Parsing & Utilities ───────────────────────────


def test_ollama_adapter_no_grounding_method():
    """Test 17: QwenOllamaAdapter explicitly does NOT implement a grounding method."""
    adapter = QwenOllamaAdapter()
    assert not hasattr(adapter, "grounding")


def test_strip_markdown_code_fences():
    """Test 18: Stripping of markdown code fences (```json ... ```)."""
    raw = '```json\n{"answer": "test", "confidence": 0.8}\n```'
    assert _strip_markdown_code_fences(raw) == '{"answer": "test", "confidence": 0.8}'

    raw2 = '```\n{"answer": "test2"}\n```'
    assert _strip_markdown_code_fences(raw2) == '{"answer": "test2"}'

    raw_clean = '{"answer": "clean"}'
    assert _strip_markdown_code_fences(raw_clean) == '{"answer": "clean"}'


def test_extract_json_object_with_surrounding_text():
    """Test 19: Extracting outer JSON object from text containing surrounding commentary."""
    text = (
        "Here is your satellite analysis result:\n"
        '{"answer": "Farmstead detected", "confidence": 0.85, "observations": []}\n'
        "Hope this helps!"
    )
    extracted = _extract_json_object(text)
    assert extracted is not None
    assert extracted["answer"] == "Farmstead detected"
    assert extracted["confidence"] == 0.85


def test_normalize_vqa_fields():
    """Test 20: Normalization of VQA string fields to lists and bounded confidence."""
    data = {
        "answer": "Test",
        "confidence": 1.5,  # out of bounds
        "observations": "Single string instead of list",
        "detected_objects": None,
        "land_use": ["agriculture"],
        "warnings": [],
    }
    _normalize_vqa_fields(data)
    assert data["confidence"] == 1.0
    assert data["observations"] == ["Single string instead of list"]
    assert data["detected_objects"] == []
    assert data["land_use"] == ["agriculture"]


def test_normalize_comparison_fields():
    """Test 21: Normalization of comparison string fields to lists."""
    data = {
        "answer": "Comparison test",
        "confidence": -0.2,  # negative
        "similarities": "Road matches",
        "differences": ["Building built"],
    }
    _normalize_comparison_fields(data)
    assert data["confidence"] == 0.0
    assert data["similarities"] == ["Road matches"]
    assert data["differences"] == ["Building built"]


@pytest.mark.anyio
async def test_ollama_adapter_vqa_with_mocked_http():
    """Test 22: QwenOllamaAdapter.vqa handles mocked Ollama HTTP response with code fences."""
    mock_payload = {
        "message": {
            "content": (
                "```json\n"
                "{\n"
                '  "answer": "Suburban development with residential streets.",\n'
                '  "confidence": 0.86,\n'
                '  "observations": ["Curved street layout", "Individual house roofs"],\n'
                '  "detected_objects": ["houses", "streets"],\n'
                '  "land_use": ["residential"],\n'
                '  "warnings": []\n'
                "}\n"
                "```"
            )
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)):
        adapter = QwenOllamaAdapter(base_url="http://127.0.0.1:11434", model="qwen-satquery")
        output, err_type, err_msg = await adapter.vqa(
            query="Describe this scene.",
            image_bytes=_create_test_image_bytes(),
        )

    assert err_type is None
    assert output is not None
    assert output.answer == "Suburban development with residential streets."
    assert output.confidence == 0.86
    assert "houses" in output.detected_objects


@pytest.mark.anyio
async def test_ollama_adapter_vqa_timeout_handling():
    """Test 23: QwenOllamaAdapter handles httpx.TimeoutException cleanly."""
    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=httpx.TimeoutException("Timeout"))):
        adapter = QwenOllamaAdapter(vqa_timeout=1.0)
        output, err_type, err_msg = await adapter.vqa(
            query="Describe this scene.",
            image_bytes=_create_test_image_bytes(),
        )

    assert output is None
    assert err_type == "timeout"
    assert "timed out" in err_msg.lower()


@pytest.mark.anyio
async def test_ollama_adapter_vqa_connect_error_handling():
    """Test 24: QwenOllamaAdapter handles httpx.ConnectError (Ollama stopped)."""
    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=httpx.ConnectError("Connection refused"))):
        adapter = QwenOllamaAdapter()
        output, err_type, err_msg = await adapter.vqa(
            query="Describe this scene.",
            image_bytes=_create_test_image_bytes(),
        )

    assert output is None
    assert err_type == "provider_unavailable"
    assert "unavailable" in err_msg.lower()


def test_ollama_stopped_does_not_prevent_backend_startup():
    """Test 25: ToolRegistry instantiation is lazy and does not contact network."""
    # ToolRegistry._register_defaults should not make any HTTP calls
    registry = ToolRegistry()
    assert registry.has_tool(ToolIdentifier.VQA_TOOL)
    assert registry.has_tool(ToolIdentifier.COMPARISON_TOOL)
    assert registry.has_tool(ToolIdentifier.GROUNDING_TOOL)
    assert registry.has_tool(ToolIdentifier.CHANGE_DETECTION_TOOL)
    assert registry.has_tool(ToolIdentifier.CLARIFICATION_TOOL)


@pytest.mark.anyio
async def test_comparison_qwen_malformed_response_honest_failure(tmp_path: Path):
    """Test 26: Comparison Qwen malformed JSON produces honest failure without fabrication."""
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_a.write_bytes(_create_test_image_bytes())
    path_b.write_bytes(_create_test_image_bytes())

    mock_gemini = MagicMock()
    mock_gemini.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource exhausted"}})
    )

    mock_adapter = MagicMock(spec=QwenOllamaAdapter)
    mock_adapter.model = "qwen-satquery"
    mock_adapter.compare = AsyncMock(
        return_value=(None, "invalid_structured_output", "Qwen response could not be parsed as valid JSON.")
    )

    tool = ComparisonTool(api_key="mock-key", client=mock_gemini, fallback_adapter=mock_adapter)
    result = await tool.execute({
        "before_image": str(path_a),
        "after_image": str(path_b),
        "query": "Compare changes.",
    })

    assert result.status == ToolStatus.ERROR.value
    assert result.confidence == 0.0
    assert result.metadata.get("fallback_attempted") is True
    assert result.metadata.get("fallback_error") == "invalid_structured_output"


@pytest.mark.anyio
async def test_ollama_adapter_compare_with_mocked_http():
    """Test 27: QwenOllamaAdapter.compare sends dual images and parses comparison response."""
    mock_payload = {
        "message": {
            "content": (
                "```json\n"
                "{\n"
                '  "answer": "Land use shifted from agricultural to commercial.",\n'
                '  "confidence": 0.88,\n'
                '  "similarities": ["Main highway remains identical"],\n'
                '  "differences": ["Warehouse complex constructed in east sector"],\n'
                '  "observations": ["Paved access roads connected"],\n'
                '  "warnings": []\n'
                "}\n"
                "```"
            )
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)) as mock_post:
        adapter = QwenOllamaAdapter(base_url="http://127.0.0.1:11434", model="qwen-satquery")
        output, err_type, err_msg = await adapter.compare(
            query="Compare before and after scenes.",
            bytes_a=_create_test_image_bytes(color="red"),
            mime_a="image/jpeg",
            bytes_b=_create_test_image_bytes(color="blue"),
            mime_b="image/jpeg",
            modality_a="optical",
            modality_b="optical",
        )

        assert mock_post.called
        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]
        # Verify both images were included in payload
        assert len(payload["messages"][0]["images"]) == 2

    assert err_type is None
    assert output is not None
    assert output.answer == "Land use shifted from agricultural to commercial."
    assert output.confidence == 0.88
    assert len(output.similarities) == 1
    assert len(output.differences) == 1


@pytest.mark.anyio
async def test_ollama_adapter_compare_timeout_handling():
    """Test 28: QwenOllamaAdapter.compare handles httpx.TimeoutException."""
    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=httpx.TimeoutException("Timeout"))):
        adapter = QwenOllamaAdapter(comparison_timeout=2.0)
        output, err_type, err_msg = await adapter.compare(
            query="Compare scenes.",
            bytes_a=_create_test_image_bytes(),
            mime_a="image/jpeg",
            bytes_b=_create_test_image_bytes(),
            mime_b="image/jpeg",
        )

    assert output is None
    assert err_type == "timeout"
    assert "timed out" in err_msg.lower()
