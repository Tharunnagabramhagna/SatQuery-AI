"""Tests for Bi-Temporal Change Detection Pipeline (src/models/change_detection.py)."""

from __future__ import annotations

import io
import base64
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from src.main import app
from src.models.change_detection import (
    assess_coregistration_quality,
    generate_change_mask_matrix,
    predict_bi_temporal_change,
    DeltaVLMInterface,
)

client = TestClient(app)


def _create_synthetic_image(color: str, size: tuple[int, int] = (64, 64)) -> str:
    """Generate base64 data URI of a synthetic PIL image."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")


# =============================================================================
# 1. Co-Registration & Alignment Quality Assessment Tests
# =============================================================================

def test_assess_coregistration_quality_aligned():
    """Verify aligned images produce verified status and score above threshold."""
    img1 = Image.new("RGB", (100, 100), color="green")
    img2 = Image.new("RGB", (100, 100), color="green")

    coreg = assess_coregistration_quality(img1, img2, tolerance_threshold=0.65)
    assert coreg["is_co_registered"] is True
    assert coreg["quality_score"] >= 0.65
    assert coreg["status"] in ["verified", "marginal"]
    assert coreg["warning"] is None


def test_assess_coregistration_quality_severe_aspect_mismatch():
    """Verify mismatched aspect ratios trigger uncertain status and low score."""
    img1 = Image.new("RGB", (200, 50), color="blue")
    img2 = Image.new("RGB", (50, 200), color="blue")

    coreg = assess_coregistration_quality(img1, img2, tolerance_threshold=0.65)
    assert coreg["is_co_registered"] is False
    assert coreg["status"] == "uncertain"
    assert "aspect ratio discrepancy" in coreg["warning"].lower()


def test_assess_coregistration_quality_noise_discrepancy():
    """Verify pure random noise vs uniform image has lower correlation."""
    np.random.seed(42)
    noise_arr = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    img_noise = Image.fromarray(noise_arr)
    img_uniform = Image.new("RGB", (100, 100), color="white")

    coreg = assess_coregistration_quality(img_noise, img_uniform, tolerance_threshold=0.65)
    assert coreg["quality_score"] <= 0.70


# =============================================================================
# 2. Change Mask Matrix Generation Tests
# =============================================================================

def test_generate_change_mask_matrix():
    """Verify change mask matrix generation and base64 PNG export."""
    img1 = Image.new("RGB", (128, 128), color="green")
    img2 = Image.new("RGB", (128, 128), color="red")

    mask, mask_b64, regions = generate_change_mask_matrix(img1, img2, mask_size=(64, 64))

    assert isinstance(mask, np.ndarray)
    assert mask.shape == (64, 64)
    # Binary values only
    assert set(np.unique(mask)).issubset({0, 1})
    assert mask_b64.startswith("data:image/png;base64,")

    # Localized regions should have normalized [ymin, xmin, ymax, xmax]
    assert len(regions) >= 1
    for reg in regions:
        ymin, xmin, ymax, xmax = reg["box_2d"]
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0


# =============================================================================
# 3. DeltaVLM Pipeline & Semantic Interpretation Tests
# =============================================================================

def test_predict_bi_temporal_change_urban_expansion():
    """Verify bi-temporal change pipeline for urban expansion query."""
    b64_t1 = _create_synthetic_image("forestgreen")
    b64_t2 = _create_synthetic_image("gray")

    res = predict_bi_temporal_change(
        image_before_path=b64_t1,
        image_after_path=b64_t2,
        query="Detect urban growth and infrastructure development",
    )

    assert "urban" in res["summary"].lower() or "commercial" in res["summary"].lower()
    assert res["total_changes"] >= 1
    assert "built_up_area_change_pct" in res["quantified_metrics"]
    assert res["quantified_metrics"]["built_up_area_change_pct"] > 0
    assert len(res["change_mask_matrix"]) == 128
    assert res["change_mask_base64"].startswith("data:image/png;base64,")


def test_predict_bi_temporal_change_flood_inundation():
    """Verify bi-temporal change pipeline for flood query."""
    b64_t1 = _create_synthetic_image("darkgreen")
    b64_t2 = _create_synthetic_image("navy")

    res = predict_bi_temporal_change(
        image_before_path=b64_t1,
        image_after_path=b64_t2,
        query="Did flooding or water submersion occur?",
    )

    assert "flood" in res["summary"].lower() or "water" in res["summary"].lower()
    assert res["quantified_metrics"]["water_surface_change_pct"] > 0


def test_predict_bi_temporal_change_deforestation():
    """Verify bi-temporal change pipeline for deforestation query."""
    b64_t1 = _create_synthetic_image("darkgreen")
    b64_t2 = _create_synthetic_image("peru")

    res = predict_bi_temporal_change(
        image_before_path=b64_t1,
        image_after_path=b64_t2,
        query="Analyze forest clearing and deforestation",
    )

    assert "forest" in res["summary"].lower() or "canopy" in res["summary"].lower()
    assert res["quantified_metrics"]["vegetation_loss_pct"] < 0


# =============================================================================
# 4. Confidence Scoring & Misregistration Penalization Tests
# =============================================================================

def test_confidence_penalization_on_misalignment():
    """Verify confidence drops below threshold when images have severe alignment discrepancy."""
    # Misaligned dimensions (200x50 vs 50x200)
    b64_wide = _create_synthetic_image("green", size=(200, 50))
    b64_tall = _create_synthetic_image("red", size=(50, 200))

    res = predict_bi_temporal_change(
        image_before_path=b64_wide,
        image_after_path=b64_tall,
        query="What changed between these two images?",
        coregistration_threshold=0.65,
    )

    # Co-registration should fail
    assert res["compatibility_verified"] is False
    assert res["coregistration"]["is_co_registered"] is False

    # Final confidence must be penalized and drop below the acceptance threshold (0.65)
    assert res["confidence"] < 0.50
    assert "low confidence" in res["summary"].lower() or "uncertain" in res["summary"].lower()


# =============================================================================
# 5. FastAPI /change-detection Integration Test
# =============================================================================

def test_api_change_detection_endpoint_with_mask():
    """Verify FastAPI /change-detection endpoint returns mask and metrics."""
    b64_t1 = _create_synthetic_image("darkgreen")
    b64_t2 = _create_synthetic_image("gray")

    response = client.post(
        "/change-detection",
        json={
            "image_before": b64_t1,
            "image_after": b64_t2,
            "query": "Identify new construction and paved roads",
            "threshold": 0.5,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "change_mask_matrix" in data
    assert data["change_mask_matrix"] is not None
    assert "change_mask_base64" in data
    assert data["change_mask_base64"] is not None
    assert "quantified_metrics" in data
    assert "coregistration" in data
    assert data["total_changes"] >= 1
