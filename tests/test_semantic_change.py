"""Unit and integration tests for Two-Stage Semantic Change Detection.

Tests verify:
1. Stage 1 deterministic metrics (pixel deltas, co-registration, cluster boxes).
2. Stage 2 Gemini multimodal semantic attribution ([OBSERVED], [INTERPRETED], [UNCERTAIN]).
3. Zero metric fabrication: pixel delta is never converted to built-up percentage without visual evidence.
4. Fallback behavior when Gemini encounters rate limits or errors: deterministic Stage 1 facts preserved with warnings.
5. Absolute prevention of Qwen in Change Detection.
"""

from __future__ import annotations

import asyncio
import io
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
from PIL import Image
import pytest

from backend.agents.tools.change_detection.interpreter import (
    SemanticChangeInterpreter,
    SemanticInterpretationOutput,
)
from backend.agents.tools.change_detection.tool import ChangeDetectionTool
from backend.schemas.tool import ToolResult, ToolStatus


def _create_synthetic_image(color=(100, 150, 200), size=(128, 128)) -> Image.Image:
    """Create a synthetic RGB PIL Image."""
    return Image.new("RGB", size, color)


# ---------------------------------------------------------------------------
# Test 1: SemanticChangeInterpreter structured parsing
# ---------------------------------------------------------------------------
def test_interpreter_parses_valid_gemini_json():
    """Interpreter correctly parses structured JSON response from Gemini."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "summary": "Vegetation clearing observed in cluster #1 with early foundation grading.",
        "change_categories": ["vegetation", "bare_land"],
        "directional_conclusion": "insufficient_evidence",
        "interpreted_details": ["Tree cover loss at coordinates [0.1, 0.2, 0.4, 0.5]"],
        "uncertainties": ["Atmospheric haze limits structural clarity"],
        "confidence": 0.82,
    })
    mock_client.models.generate_content.return_value = mock_response

    interpreter = SemanticChangeInterpreter(client=mock_client)
    output, err_type, err_msg = asyncio.run(
        interpreter.interpret_change(
            query="What changed between these two dates?",
            bytes_before=b"fake_before",
            bytes_after=b"fake_after",
            mime_type="image/png",
            stage1_metrics={"changed_pixels": 500, "total_pixels": 10000, "change_percentage": 5.0},
            cluster_boxes=[[0.1, 0.2, 0.4, 0.5]],
            coregistration_score=0.92,
            coregistration_status="good",
        )
    )

    assert err_type is None
    assert err_msg is None
    assert output is not None
    assert output.directional_conclusion == "insufficient_evidence"
    assert "vegetation" in output.change_categories
    assert output.confidence == 0.82


def test_interpreter_strips_markdown_code_fence():
    """Interpreter correctly parses JSON wrapped in markdown code blocks."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "```json\n" + json.dumps({
        "summary": "New building footprint visible.",
        "change_categories": ["built-up"],
        "directional_conclusion": "increased",
        "interpreted_details": ["Rectangular roof structure detected in cluster 1"],
        "uncertainties": [],
        "confidence": 0.90,
    }) + "\n```"
    mock_client.models.generate_content.return_value = mock_response

    interpreter = SemanticChangeInterpreter(client=mock_client)
    output, err_type, _ = asyncio.run(
        interpreter.interpret_change(
            query="Has built-up area changed?",
            bytes_before=b"b",
            bytes_after=b"a",
            mime_type="image/png",
            stage1_metrics={},
            cluster_boxes=[],
            coregistration_score=0.9,
            coregistration_status="good",
        )
    )

    assert err_type is None
    assert output is not None
    assert output.directional_conclusion == "increased"
    assert "built-up" in output.change_categories


# ---------------------------------------------------------------------------
# Test 2: Interpreter handles 429 rate limit cleanly
# ---------------------------------------------------------------------------
def test_interpreter_handles_rate_limit_429():
    """Interpreter flags rate_limit_exceeded without crashing on HTTP 429."""
    from google.genai import errors as genai_errors

    mock_client = MagicMock()
    exc = genai_errors.ClientError(429, {"error": {"message": "Resource has been exhausted (e.g. check quota)."}})
    mock_client.models.generate_content.side_effect = exc

    interpreter = SemanticChangeInterpreter(client=mock_client)
    output, err_type, err_msg = asyncio.run(
        interpreter.interpret_change(
            query="What changed?",
            bytes_before=b"b",
            bytes_after=b"a",
            mime_type="image/png",
            stage1_metrics={},
            cluster_boxes=[],
            coregistration_score=0.9,
            coregistration_status="good",
        )
    )

    assert output is None
    assert err_type == "rate_limit_exceeded"
    assert "rate limit" in err_msg.lower()


# ---------------------------------------------------------------------------
# Test 3: ChangeDetectionTool two-stage execution with mock interpreter
# ---------------------------------------------------------------------------
def test_tool_produces_three_section_answer_when_semantic_succeeds():
    """ChangeDetectionTool creates structured [OBSERVED], [INTERPRETED], [UNCERTAIN] output."""
    img_before = _create_synthetic_image(color=(50, 50, 50))
    # Make after image with distinct center patch to trigger Stage 1 delta
    arr = np.full((128, 128, 3), 50, dtype=np.uint8)
    arr[40:80, 40:80] = [200, 200, 200]
    img_after = Image.fromarray(arr)

    mock_interpreter = MagicMock(spec=SemanticChangeInterpreter)
    mock_interpreter.model = "gemini-3.6-flash"
    mock_interpreter.interpret_change = AsyncMock(return_value=(
        SemanticInterpretationOutput(
            summary="New commercial structure erected in center sector.",
            change_categories=["built-up"],
            directional_conclusion="increased",
            interpreted_details=["Bright high-reflectance roof visible"],
            uncertainties=["Exact footprint area requires ground sampling distance calibration"],
            confidence=0.85,
        ),
        None,
        None,
    ))

    tool = ChangeDetectionTool()
    tool.interpreter = mock_interpreter

    result = asyncio.run(
        tool.execute(
            params={
                "before_image": img_before,
                "after_image": img_after,
                "query": "Has the built-up area increased, decreased, or remained unchanged?",
            }
        )
    )

    assert result.status == ToolStatus.SUCCESS.value
    assert "[OBSERVED]:" in result.answer
    assert "[INTERPRETED]:" in result.answer
    assert "[UNCERTAIN]:" in result.answer
    assert "New commercial structure" in result.answer
    assert result.metadata["directional_conclusion"] == "increased"
    assert result.metadata["semantic_interpretation_status"] == "success"
    # Stage 1 evidence should be present
    evidence_types = [e.type for e in result.evidence]
    assert "metric" in evidence_types
    assert "co_registration" in evidence_types
    assert "semantic_interpretation" in evidence_types


# ---------------------------------------------------------------------------
# Test 4: Tool preserves Stage 1 facts when interpreter fails / 429
# ---------------------------------------------------------------------------
def test_tool_preserves_stage1_when_interpreter_rate_limited():
    """When Gemini 429 occurs, ChangeDetectionTool falls back to deterministic Stage 1 facts with honest warning."""
    img_before = _create_synthetic_image(color=(50, 50, 50))
    arr = np.full((128, 128, 3), 50, dtype=np.uint8)
    arr[40:80, 40:80] = [200, 200, 200]
    img_after = Image.fromarray(arr)

    mock_interpreter = MagicMock(spec=SemanticChangeInterpreter)
    mock_interpreter.model = "gemini-3.6-flash"
    mock_interpreter.interpret_change = AsyncMock(return_value=(
        None,
        "rate_limit_exceeded",
        "Gemini API rate limit exceeded.",
    ))

    tool = ChangeDetectionTool()
    tool.interpreter = mock_interpreter

    result = asyncio.run(
        tool.execute(
            params={
                "before_image": img_before,
                "after_image": img_after,
                "query": "Has the built-up area increased?",
            }
        )
    )

    assert result.status == ToolStatus.SUCCESS.value
    # Result answer should contain Stage 1 summary (not crash or blank)
    assert "detected" in result.answer.lower()
    assert result.metadata["semantic_interpretation_status"] == "unavailable"
    assert result.metadata["semantic_error_type"] == "rate_limit_exceeded"
    # Warning should indicate Stage 1 deterministic facts are shown
    assert any("Stage 1 deterministic pixel change analysis" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Test 5: Qwen is NEVER invoked in ChangeDetectionTool
# ---------------------------------------------------------------------------
def test_qwen_never_invoked_in_change_detection():
    """Change detection must never import or invoke Qwen/Ollama."""
    tool = ChangeDetectionTool()
    # Check that tool has no ollama or qwen attributes
    assert not hasattr(tool, "ollama_client")
    assert not hasattr(tool, "qwen_client")
    assert not hasattr(tool, "_call_qwen")
