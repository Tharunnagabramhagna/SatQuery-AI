"""Test suite for SatQuery AI Mock VLM functions and FastAPI endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.models.mock_vlm import (
    mock_vqa,
    async_mock_vqa,
    mock_grounding,
    async_mock_grounding,
    mock_change_detection,
    async_mock_change_detection,
)

client = TestClient(app)

DUMMY_IMAGE_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
DUMMY_IMAGE_URL = "https://example.org/satellite_sample_2026_09.tif"


# =============================================================================
# 1. Direct Unit Tests for Mock VLM Functions (src/models/mock_vlm.py)
# =============================================================================

def test_mock_vqa_sync():
    """Verify synchronous mock VQA function."""
    res = mock_vqa(image=DUMMY_IMAGE_B64, query="What types of land cover are visible?")
    assert "answer" in res
    assert "confidence" in res
    assert 0.0 <= res["confidence"] <= 1.0
    assert "metadata" in res
    assert res["metadata"]["task"] == "single_image_vqa"
    assert len(res["evidence"]) > 0


@pytest.mark.asyncio
async def test_mock_vqa_async():
    """Verify asynchronous mock VQA function."""
    res = await async_mock_vqa(image=DUMMY_IMAGE_URL, query="Is there an airport or runway?")
    assert "airport" in res["answer"].lower() or "runway" in res["answer"].lower()
    assert res["confidence"] >= 0.85
    assert len(res["bounding_boxes"]) > 0
    for box in res["bounding_boxes"]:
        ymin, xmin, ymax, xmax = box["box_2d"]
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0


def test_mock_grounding_sync():
    """Verify synchronous mock Grounding function."""
    res = mock_grounding(image=DUMMY_IMAGE_B64, query="Where are the aircraft?", confidence_threshold=0.8)
    assert res["total_detected"] > 0
    assert "detected_objects" in res
    for item in res["detected_objects"]:
        assert item["confidence"] >= 0.8
        ymin, xmin, ymax, xmax = item["box_2d"]
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0


@pytest.mark.asyncio
async def test_mock_grounding_async():
    """Verify asynchronous mock Grounding function."""
    res = await async_mock_grounding(image=DUMMY_IMAGE_B64, query="storage tanks")
    assert res["total_detected"] >= 2
    assert any("storage_tank" in obj["label"].lower() for obj in res["detected_objects"])


def test_mock_change_detection_sync():
    """Verify synchronous mock Change Detection function."""
    res = mock_change_detection(
        image_before=DUMMY_IMAGE_B64,
        image_after=DUMMY_IMAGE_URL,
        query="What changed between these two images?",
        threshold=0.5,
    )
    assert res["compatibility_verified"] is True
    assert res["total_changes"] > 0
    assert "quantified_metrics" in res
    assert "built_up_area_change_pct" in res["quantified_metrics"]
    for chg in res["detected_changes"]:
        ymin, xmin, ymax, xmax = chg["box_2d"]
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0


@pytest.mark.asyncio
async def test_mock_change_detection_async():
    """Verify asynchronous mock Change Detection function."""
    res = await async_mock_change_detection(
        image_before=DUMMY_IMAGE_B64,
        image_after=DUMMY_IMAGE_B64,
        query="Detect flood inundation and water changes",
    )
    assert "flood" in res["summary"].lower() or "water" in res["summary"].lower()
    assert res["quantified_metrics"]["water_surface_change_pct"] > 0.0


# =============================================================================
# 2. FastAPI Route Tests (src/api/vlm_routes.py via client)
# =============================================================================

def test_system_root_and_health():
    """Verify root / and /health status."""
    root_res = client.get("/")
    assert root_res.status_code == 200
    assert root_res.json()["project"] == "SatQuery AI"

    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"


def test_api_vqa_endpoint_success():
    """Test POST /vqa endpoint."""
    payload = {
        "image": DUMMY_IMAGE_B64,
        "query": "What types of land cover are visible?",
        "parameters": {"sensor_type": "Sentinel-2"},
    }
    response = client.post("/vqa", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == payload["query"]
    assert isinstance(data["answer"], str)
    assert len(data["answer"]) > 20
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["evidence"], list)
    assert len(data["evidence"]) >= 1
    assert data["metadata"]["task"] == "single_image_vqa"


def test_api_grounding_endpoint_success():
    """Test POST /grounding endpoint with [ymin, xmin, ymax, xmax] verification."""
    payload = {
        "image": DUMMY_IMAGE_B64,
        "query": "Locate all aircraft on the apron",
        "confidence_threshold": 0.7,
        "target_classes": ["aircraft"],
    }
    response = client.post("/grounding", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_detected"] > 0
    assert len(data["detected_objects"]) == data["total_detected"]
    assert "[ymin, xmin, ymax, xmax]" in data["coordinate_format"]

    for obj in data["detected_objects"]:
        assert "label" in obj
        assert "box_2d" in obj
        box = obj["box_2d"]
        assert len(box) == 4
        ymin, xmin, ymax, xmax = box
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0
        assert obj["confidence"] >= 0.7


def test_api_change_detection_endpoint_success():
    """Test POST /change-detection endpoint."""
    payload = {
        "image_before": DUMMY_IMAGE_B64,
        "image_after": DUMMY_IMAGE_URL,
        "query": "What changed between these two dates?",
        "threshold": 0.5,
    }
    response = client.post("/change-detection", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["compatibility_verified"] is True
    assert data["total_changes"] >= 1
    assert len(data["detected_changes"]) == data["total_changes"]
    assert "quantified_metrics" in data
    assert "built_up_area_change_pct" in data["quantified_metrics"]
    assert "total_modified_area_hectares" in data["quantified_metrics"]

    for chg in data["detected_changes"]:
        assert "change_type" in chg
        assert "box_2d" in chg
        ymin, xmin, ymax, xmax = chg["box_2d"]
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0
        assert chg["confidence"] >= 0.5
        assert len(chg["description"]) > 5


def test_api_validation_errors():
    """Test that invalid payloads trigger proper HTTP 422 validation errors."""
    # Empty image in VQA
    res = client.post("/vqa", json={"image": "   ", "query": "Test query"})
    assert res.status_code == 422

    # Empty query in VQA
    res = client.post("/vqa", json={"image": DUMMY_IMAGE_B64, "query": ""})
    assert res.status_code == 422

    # Missing image_after in change-detection
    res = client.post("/change-detection", json={"image_before": DUMMY_IMAGE_B64, "image_after": ""})
    assert res.status_code == 422

    # Invalid threshold out of range [0, 1]
    res = client.post(
        "/grounding",
        json={"image": DUMMY_IMAGE_B64, "query": "buildings", "confidence_threshold": 1.8},
    )
    assert res.status_code == 422


def test_api_vqa_with_real_vlm_flag():
    """Test POST /vqa with use_real_vlm=True in parameters."""
    res = client.post(
        "/vqa",
        json={
            "image": DUMMY_IMAGE_B64,
            "query": "Where are the aircraft?",
            "parameters": {"use_real_vlm": True},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["metadata"]["task"] == "single_image_vqa_real"
    assert "device" in data["metadata"]
    assert len(data["bounding_boxes"]) >= 1


def test_api_predict_endpoint_success():
    """Test dedicated POST /predict endpoint."""
    res = client.post(
        "/predict",
        json={
            "image": DUMMY_IMAGE_B64,
            "query": "Where are the aircraft?",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "bounding_boxes" in data
    assert len(data["bounding_boxes"]) >= 1
    assert "device" in data
    assert "inference_time_ms" in data
