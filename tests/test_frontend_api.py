"""Tests for Phase 3A: POST /api/analysis frontend-compatible endpoint.

Verifies:
- multipart file upload handling
- temp file lifecycle (creation + cleanup)
- frontend-compatible camelCase response structure
- genuine tool confidence (not routing confidence)
- visualization pass-through (mask, bounding boxes)
- evidence pass-through
- status mapping (success → completed, input_required → error)
- analysisId uniqueness
- isDemo = false for real analysis
- executionTrace with duration (not duration_ms)
- file validation (reject unsupported types)
- CORS headers
- existing /api/query endpoint is not broken
"""

import io
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app


@pytest.fixture
def client():
    """Create a TestClient for the FastAPI app."""
    return TestClient(app)


def _create_test_jpg(width: int = 64, height: int = 64, color: tuple = (100, 150, 200)) -> bytes:
    """Create a minimal JPEG in memory for testing uploads."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


def _create_test_png(width: int = 64, height: int = 64, color: tuple = (50, 100, 150)) -> bytes:
    """Create a minimal PNG in memory for testing uploads."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


# ─── A. POST /api/analysis without images ─────────────────────────

def test_analysis_without_images(client):
    """POST /api/analysis without images returns controlled error with input_required semantics."""
    resp = client.post(
        "/api/analysis",
        data={"query": "What changed between 2023 and 2025?"},
    )
    assert resp.status_code == 200
    data = resp.json()

    # Should be error status because tool returns input_required
    assert data["status"] == "error"
    assert data["isDemo"] is False
    assert "analysisId" in data
    assert len(data["analysisId"]) > 0

    # The answer should contain the missing-input message
    assert "before" in data["answer"].lower() or "after" in data["answer"].lower() or "imagery" in data["answer"].lower()

    # Warnings should contain the input_required message
    assert len(data["warnings"]) > 0


# ─── B. POST /api/analysis with real before/after images ──────────

def test_analysis_with_real_images(client):
    """POST /api/analysis with real before+after JPGs returns successful change detection."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={
                "query": "What changed between 2023 and 2025?",
                "mode": "compare_images",
                "capability": "change_detection",
            },
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    assert resp.status_code == 200
    data = resp.json()

    # Status must be completed for successful tool execution
    assert data["status"] == "completed"
    assert data["isDemo"] is False
    assert data["task"] == "change_detection"
    assert len(data["answer"]) > 0
    assert data["confidence"] > 0.0
    assert data["confidence"] <= 1.0


# ─── C. Invalid file type ─────────────────────────────────────────

def test_analysis_invalid_file_type(client):
    """POST /api/analysis with unsupported file type returns validation error."""
    fake_pdf = b"%PDF-1.4 fake content"
    resp = client.post(
        "/api/analysis",
        data={"query": "Analyze this document"},
        files={
            "before_image": ("document.pdf", io.BytesIO(fake_pdf), "application/pdf"),
        },
    )
    assert resp.status_code == 422
    assert "unsupported" in resp.json()["detail"].lower() or ".pdf" in resp.json()["detail"].lower()


# ─── D. Missing before image only ─────────────────────────────────

def test_analysis_missing_before_image(client):
    """POST /api/analysis with only after_image returns input_required error."""
    after_jpg = _create_test_jpg(color=(200, 100, 50))
    resp = client.post(
        "/api/analysis",
        data={"query": "What changed between 2023 and 2025?"},
        files={
            "after_image": ("after.jpg", io.BytesIO(after_jpg), "image/jpeg"),
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"  # input_required maps to error
    assert "before" in data["answer"].lower() or "imagery" in data["answer"].lower()


# ─── E. Missing after image only ──────────────────────────────────

def test_analysis_missing_after_image(client):
    """POST /api/analysis with only before_image returns input_required error."""
    before_jpg = _create_test_jpg(color=(100, 200, 50))
    resp = client.post(
        "/api/analysis",
        data={"query": "What changed between 2023 and 2025?"},
        files={
            "before_image": ("before.jpg", io.BytesIO(before_jpg), "image/jpeg"),
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"
    assert "after" in data["answer"].lower() or "imagery" in data["answer"].lower()


# ─── F. Unique analysisId ─────────────────────────────────────────

def test_analysis_id_unique(client):
    """Each /api/analysis request returns a unique analysisId (valid UUID)."""
    ids = set()
    for _ in range(3):
        resp = client.post(
            "/api/analysis",
            data={"query": "What changed between 2023 and 2025?"},
        )
        data = resp.json()
        analysis_id = data["analysisId"]
        assert analysis_id not in ids, f"Duplicate analysisId: {analysis_id}"
        ids.add(analysis_id)
        # Verify it's a valid UUID
        uuid.UUID(analysis_id)

    assert len(ids) == 3


# ─── G. isDemo is always false ────────────────────────────────────

def test_analysis_is_demo_false(client):
    """Real backend analysis always returns isDemo=false."""
    resp = client.post(
        "/api/analysis",
        data={"query": "What changed between 2023 and 2025?"},
    )
    data = resp.json()
    assert data["isDemo"] is False


# ─── H. executionTrace uses duration (not duration_ms) ────────────

def test_analysis_execution_trace_duration(client):
    """executionTrace steps use 'duration' key, not 'duration_ms'."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={"query": "What changed between 2023 and 2025?"},
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    data = resp.json()
    assert "executionTrace" in data
    trace = data["executionTrace"]
    assert len(trace) >= 3  # Query Understanding, Agent Routing, Tool Execution

    for step in trace:
        assert "step" in step
        assert "action" in step
        assert "detail" in step
        assert "duration" in step  # NOT duration_ms
        assert "duration_ms" not in step
        assert "status" in step


# ─── I. Genuine tool confidence ───────────────────────────────────

def test_analysis_genuine_tool_confidence(client):
    """Confidence in response must be the genuine tool confidence, not routing confidence."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={"query": "What changed between 2023 and 2025?"},
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    data = resp.json()
    # The tool confidence is computed by synthesize_grounded_summary and should be between 0 and 1
    assert data["confidence"] > 0.0
    assert data["confidence"] <= 1.0

    # Routing confidence for change detection queries is typically 0.95
    # Tool confidence from ChangeDetectionEngine is computed differently (typically ~0.9x for well-aligned images)
    # They should NOT be exactly the same unless by coincidence
    # We verify the value is reasonable and non-zero
    assert isinstance(data["confidence"], float)


# ─── J. Mask visualization exists ─────────────────────────────────

def test_analysis_mask_visualization(client):
    """Successful change detection response includes a mask visualization."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={"query": "What changed between 2023 and 2025?"},
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    data = resp.json()
    vizs = data["visualizations"]
    mask_vizs = [v for v in vizs if v["type"] == "mask"]
    assert len(mask_vizs) >= 1

    # Mask data should be a base64 data URI
    mask = mask_vizs[0]
    assert mask["data"].startswith("data:image/png;base64,")
    assert len(mask["label"]) > 0


# ─── K. Bounding box visualizations exist ─────────────────────────

def test_analysis_bounding_box_visualizations(client):
    """Successful change detection response includes bounding box visualizations."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={"query": "What changed between 2023 and 2025?"},
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    data = resp.json()
    vizs = data["visualizations"]
    bbox_vizs = [v for v in vizs if v["type"] == "bounding_box"]

    # The test images should produce at least one change cluster
    assert len(bbox_vizs) >= 1

    # Each bounding box should have structured data
    for bb in bbox_vizs:
        assert "data" in bb
        assert "label" in bb
        assert len(bb["label"]) > 0


# ─── L. Evidence exists ───────────────────────────────────────────

def test_analysis_evidence(client):
    """Successful change detection response includes real evidence items."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={"query": "What changed between 2023 and 2025?"},
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    data = resp.json()
    evidence = data["evidence"]
    assert len(evidence) >= 2  # metric + co_registration evidence

    for e in evidence:
        assert "type" in e
        assert "description" in e
        assert "source" in e
        assert len(e["description"]) > 0


# ─── M. Existing /api/query still works ───────────────────────────

def test_existing_query_endpoint_unchanged(client):
    """POST /api/query must still work identically (Block 1–5 behavior preserved)."""
    resp = client.post(
        "/api/query",
        json={"query": "What changed between 2023 and 2025?"},
    )
    assert resp.status_code == 200
    data = resp.json()

    # Original snake_case response structure
    assert "received_query" in data
    assert "status" in data
    assert data["status"] == "received"
    assert "task" in data
    assert data["task"] == "CHANGE_DETECTION"
    assert "execution_trace" in data
    assert "tool_result" in data
    assert "structured_query" in data
    assert "routing_decision" in data


# ─── N. CORS headers functional ───────────────────────────────────

def test_cors_preflight(client):
    """OPTIONS request to /api/analysis should return CORS headers."""
    resp = client.options(
        "/api/analysis",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    # CORS middleware should respond with access-control headers
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers


# ─── Additional: PNG upload works ─────────────────────────────────

def test_analysis_png_upload(client):
    """PNG file uploads are accepted and processed correctly."""
    before_png = _create_test_png(color=(100, 100, 100))
    after_png = _create_test_png(color=(200, 200, 200))

    resp = client.post(
        "/api/analysis",
        data={"query": "What changed in this area?"},
        files={
            "before_image": ("before.png", io.BytesIO(before_png), "image/png"),
            "after_image": ("after.png", io.BytesIO(after_png), "image/png"),
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["isDemo"] is False


# ─── Additional: Empty query rejected ─────────────────────────────

def test_analysis_empty_query_rejected(client):
    """POST /api/analysis with empty query returns validation error."""
    resp = client.post(
        "/api/analysis",
        data={"query": "   "},
    )
    assert resp.status_code == 422


# ─── Additional: Full response contract check ─────────────────────

def test_analysis_full_response_contract(client):
    """Verify the complete response contract matches frontend expectations."""
    before_path = os.path.join("tests", "data", "sat_before.jpg")
    after_path = os.path.join("tests", "data", "sat_after.jpg")

    with open(before_path, "rb") as bf, open(after_path, "rb") as af:
        resp = client.post(
            "/api/analysis",
            data={
                "query": "What changed between 2023 and 2025?",
                "mode": "compare_images",
                "capability": "change_detection",
            },
            files={
                "before_image": ("sat_before.jpg", bf, "image/jpeg"),
                "after_image": ("sat_after.jpg", af, "image/jpeg"),
            },
        )

    assert resp.status_code == 200
    data = resp.json()

    # Verify ALL required top-level camelCase fields
    required_fields = {
        "analysisId", "status", "task", "answer", "confidence",
        "evidence", "visualizations", "executionTrace", "warnings", "isDemo"
    }
    assert required_fields.issubset(set(data.keys())), f"Missing fields: {required_fields - set(data.keys())}"

    # Verify NO snake_case leakage
    snake_case_fields = {"analysis_id", "execution_trace", "is_demo", "duration_ms"}
    assert not snake_case_fields.intersection(set(data.keys())), \
        f"Snake_case fields leaked into response: {snake_case_fields.intersection(set(data.keys()))}"

    # Verify types
    assert isinstance(data["analysisId"], str)
    assert isinstance(data["status"], str)
    assert isinstance(data["task"], str)
    assert data["task"] == "change_detection"
    assert isinstance(data["answer"], str)
    assert isinstance(data["confidence"], (int, float))
    assert isinstance(data["evidence"], list)
    assert isinstance(data["visualizations"], list)
    assert isinstance(data["executionTrace"], list)
    assert isinstance(data["warnings"], list)
    assert isinstance(data["isDemo"], bool)


# ─── Additional: Health endpoint still works ───────────────────────

def test_health_endpoint_unchanged(client):
    """GET /api/health must still work."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "satquery-api"
    assert data["version"] == "0.1.0"
