"""Unit and integration tests for Block 5: Real Specialist Capability (ChangeDetectionTool)."""

import asyncio
import base64
import io
import os
from typing import Any, Dict
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.agents.orchestrator import AgentOrchestrator, orchestrator
from backend.agents.tools.change_detection.engine import (
    ChangeDetectionEngine,
    ImageValidationError,
    default_change_detection_engine,
)
from backend.agents.tools.change_detection.tool import ChangeDetectionTool
from backend.agents.tools.executor import ToolExecutor
from backend.agents.tools.registry import default_tool_registry
from backend.main import app
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

client = TestClient(app)

BEFORE_IMG_PATH = os.path.abspath("tests/data/sat_before.jpg")
AFTER_IMG_PATH = os.path.abspath("tests/data/sat_after.jpg")


# -----------------------------------------------------------------------------
# 1. Tool Registry & Initialization Tests
# -----------------------------------------------------------------------------

def test_change_detection_tool_resolution():
    """Verify ChangeDetectionTool resolves properly from default registry."""
    tool = default_tool_registry.get(ToolIdentifier.CHANGE_DETECTION_TOOL)
    assert isinstance(tool, ChangeDetectionTool)
    assert tool.tool_id == ToolIdentifier.CHANGE_DETECTION_TOOL
    assert "Change Detection" in tool.name
    assert "bi-temporal" in tool.description.lower() or "pixel-level" in tool.description.lower()


# -----------------------------------------------------------------------------
# 2. Input Validation & Missing Input Tests
# -----------------------------------------------------------------------------

def test_missing_both_images_returns_input_required():
    """Verify tool gracefully signals input_required when both images are missing."""
    tool = ChangeDetectionTool()
    res = asyncio.run(tool.execute({}))
    assert res.status == ToolStatus.INPUT_REQUIRED.value
    assert "requires before and after imagery" in res.answer.lower()
    assert "before_image" in res.metadata["missing_inputs"]
    assert "after_image" in res.metadata["missing_inputs"]
    assert len(res.evidence) == 0
    assert len(res.visualizations) == 0


def test_missing_after_image_returns_input_required():
    """Verify tool signals input_required when after_image is omitted."""
    tool = ChangeDetectionTool()
    res = asyncio.run(tool.execute({"before_image": BEFORE_IMG_PATH}))
    assert res.status == ToolStatus.INPUT_REQUIRED.value
    assert "after_image" in res.metadata["missing_inputs"]
    assert "before_image" not in res.metadata["missing_inputs"]


def test_missing_before_image_returns_input_required():
    """Verify tool signals input_required when before_image is omitted."""
    tool = ChangeDetectionTool()
    res = asyncio.run(tool.execute({"after_image": AFTER_IMG_PATH}))
    assert res.status == ToolStatus.INPUT_REQUIRED.value
    assert "before_image" in res.metadata["missing_inputs"]
    assert "after_image" not in res.metadata["missing_inputs"]


def test_invalid_image_path_returns_error():
    """Verify tool safely catches image validation errors and returns ToolStatus.ERROR."""
    tool = ChangeDetectionTool()
    res = asyncio.run(tool.execute({
        "before_image": "non_existent_path_before.jpg",
        "after_image": AFTER_IMG_PATH,
    }))
    assert res.status == ToolStatus.ERROR.value
    assert res.answer is None
    assert len(res.warnings) >= 1
    assert "not found" in res.warnings[0].lower() or "validation" in res.metadata["error_type"]


# -----------------------------------------------------------------------------
# 3. Core Engine Execution & Algorithm Tests
# -----------------------------------------------------------------------------

def test_engine_run_with_real_demo_images():
    """Verify ChangeDetectionEngine runs on real demo imagery with pixel-difference metrics."""
    assert os.path.exists(BEFORE_IMG_PATH), f"Demo asset missing: {BEFORE_IMG_PATH}"
    assert os.path.exists(AFTER_IMG_PATH), f"Demo asset missing: {AFTER_IMG_PATH}"

    engine = ChangeDetectionEngine()
    result = engine.run(
        before_image=BEFORE_IMG_PATH,
        after_image=AFTER_IMG_PATH,
        query="What changed between baseline and follow-up?",
    )

    # 1. Verify metrics (pixel counts, percentages)
    assert result.metrics.total_pixels > 0
    assert result.metrics.changed_pixels > 0
    assert 0.0 < result.metrics.change_percentage <= 100.0
    assert result.metrics.mean_difference_intensity >= 0.0

    # 2. Verify co-registration assessment
    assert 0.0 <= result.coregistration.quality_score <= 1.0
    assert result.coregistration.status in ("verified", "marginal", "uncertain")

    # 3. Verify mask generation (base64 PNG)
    assert result.mask_base64.startswith("data:image/png;base64,")
    # Decode base64 PNG to verify valid image format
    raw_b64 = result.mask_base64.split(",", 1)[1]
    mask_bytes = base64.b64decode(raw_b64)
    mask_img = Image.open(io.BytesIO(mask_bytes))
    assert mask_img.format == "PNG"

    # 4. Verify bounding box clusters in normalized [ymin, xmin, ymax, xmax] coordinates
    assert len(result.regions) > 0
    for r in result.regions:
        ymin, xmin, ymax, xmax = r.box_2d
        assert 0.0 <= ymin <= ymax <= 1.0
        assert 0.0 <= xmin <= xmax <= 1.0

    # 5. Verify honest summary wording (no hallucinated hectares or building types)
    summary_lower = result.summary.lower()
    assert "hectare" not in summary_lower
    assert "multispectral" not in summary_lower
    assert "%" in result.summary or "pixel" in summary_lower


def test_sensitivity_parameter_effects():
    """Verify tuning sensitivity threshold alters the detected change percentage."""
    engine = ChangeDetectionEngine()

    res_strict = engine.run(
        before_image=BEFORE_IMG_PATH,
        after_image=AFTER_IMG_PATH,
        sensitivity=0.60,  # Only very large pixel deltas trigger
    )
    res_sensitive = engine.run(
        before_image=BEFORE_IMG_PATH,
        after_image=AFTER_IMG_PATH,
        sensitivity=0.15,  # Subtle deltas trigger
    )

    assert res_sensitive.metrics.changed_pixels >= res_strict.metrics.changed_pixels
    assert res_sensitive.metrics.change_percentage >= res_strict.metrics.change_percentage


def test_engine_identical_images_zero_change():
    """Verify identical before and after images yield near-zero change and high alignment."""
    engine = ChangeDetectionEngine()
    res = engine.run(
        before_image=BEFORE_IMG_PATH,
        after_image=BEFORE_IMG_PATH,
    )
    assert res.metrics.changed_pixels == 0
    assert res.metrics.change_percentage == 0.0
    assert res.coregistration.quality_score >= 0.90
    assert len(res.regions) == 0


# -----------------------------------------------------------------------------
# 4. Tool Execution & Output Schema Compliance
# -----------------------------------------------------------------------------

def test_change_detection_tool_full_execution():
    """Verify ChangeDetectionTool outputs compliant ToolResult with evidence and visualizations."""
    tool = ChangeDetectionTool()
    res = asyncio.run(tool.execute({
        "before_image": BEFORE_IMG_PATH,
        "after_image": AFTER_IMG_PATH,
        "query": "Identify changes in this scene.",
        "sensitivity": 0.25,
    }))

    assert res.status == ToolStatus.SUCCESS.value
    assert res.tool_name == ToolIdentifier.CHANGE_DETECTION_TOOL.value
    assert res.answer is not None
    assert res.confidence is not None and 0.0 <= res.confidence <= 1.0

    # Verify evidence items
    assert len(res.evidence) >= 2
    types = [e.type for e in res.evidence]
    assert "metric" in types
    assert "co_registration" in types

    # Verify visualizations
    vis_types = [v.type for v in res.visualizations]
    assert "mask" in vis_types
    assert "bounding_box" in vis_types

    # Verify metadata fields
    assert "changed_pixels" in res.metadata
    assert "total_pixels" in res.metadata
    assert "change_percentage" in res.metadata
    assert "co_registration_score" in res.metadata
    assert res.metadata["coordinate_format"] == "normalized [ymin, xmin, ymax, xmax]"


# -----------------------------------------------------------------------------
# 5. Orchestrator Pipeline Integration
# -----------------------------------------------------------------------------

def test_orchestrator_pipeline_with_real_change_detection():
    """Verify full orchestrator pipeline routes and executes change detection end-to-end."""
    res = asyncio.run(orchestrator.process_query(
        query="What changed between 2023 and 2025?",
        before_image=BEFORE_IMG_PATH,
        after_image=AFTER_IMG_PATH,
    ))

    assert res["status"] == "received"
    assert res["task"] == "CHANGE_DETECTION"
    assert res["routing_decision"].selected_tool == ToolIdentifier.CHANGE_DETECTION_TOOL
    assert res["tool_result"].status == ToolStatus.SUCCESS.value
    assert res["answer"] is not None

    # Check 3 execution trace steps
    trace = res["execution_trace"]
    assert len(trace) == 3
    assert trace[0].action == "Query Understanding"
    assert trace[0].status == "completed"
    assert trace[1].action == "Agent Routing"
    assert trace[1].status == "completed"
    assert trace[2].action == "Tool Execution"
    assert trace[2].status == "completed"
    assert "CHANGE_DETECTION_TOOL" in trace[2].detail
    assert "success" in trace[2].detail.lower()


# -----------------------------------------------------------------------------
# 6. Live API Endpoint Integration
# -----------------------------------------------------------------------------

def test_api_query_without_imagery_prompts_for_input():
    """Verify POST /api/query without imagery yields input_required status."""
    response = client.post("/api/query", json={
        "query": "Show me what changed over time",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["task"] == "CHANGE_DETECTION"
    assert data["routing_decision"]["selected_tool"] == "CHANGE_DETECTION_TOOL"
    assert data["tool_result"]["status"] == "input_required"
    assert "requires before and after imagery" in data["tool_result"]["answer"].lower()


def test_api_query_with_demo_imagery_success():
    """Verify POST /api/query with before_image and after_image executes real change detection."""
    response = client.post("/api/query", json={
        "query": "What changed between 2023 and 2025?",
        "before_image": BEFORE_IMG_PATH,
        "after_image": AFTER_IMG_PATH,
        "parameters": {"sensitivity": 0.30},
    })
    assert response.status_code == 200
    data = response.json()

    # Core response verification
    assert data["status"] == "received"
    assert data["task"] == "CHANGE_DETECTION"
    assert data["routing_decision"]["selected_tool"] == "CHANGE_DETECTION_TOOL"

    # Tool result verification
    tr = data["tool_result"]
    assert tr["tool_name"] == "CHANGE_DETECTION_TOOL"
    assert tr["status"] == "success"
    assert tr["answer"] is not None
    assert len(tr["evidence"]) >= 2
    assert len(tr["visualizations"]) >= 1

    # Visualization check
    mask_vis = next((v for v in tr["visualizations"] if v["type"] == "mask"), None)
    assert mask_vis is not None
    assert mask_vis["data"].startswith("data:image/png;base64,")

    # Metadata check
    assert tr["metadata"]["changed_pixels"] > 0
    assert tr["metadata"]["change_percentage"] > 0.0
    assert "co_registration_score" in tr["metadata"]
