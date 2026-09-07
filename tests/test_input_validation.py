"""Deterministic unit tests for Input and Modality Validation Layer.

Tests:
- Modality inference precedence (no assuming optical from RGB, no inferring SAR from filename).
- GeoTIFF tag inspection without geospatial fabrication.
- Pair validation rules: bi-temporal dimension/channel checks vs cross-modal optical+SAR flexibility.
"""

import io
from pathlib import Path
import pytest
from PIL import Image

from backend.validation.input_validator import (
    ImageFormat,
    ImageMetadata,
    ImageModality,
    InputValidator,
    PairValidationResult,
    TAG_MODEL_PIXEL_SCALE,
    TAG_MODEL_TIEPOINT,
)


def test_modality_precedence_explicit_optical():
    """Explicit optical declaration resolves to OPTICAL."""
    assert InputValidator.infer_modality(declared_modality="optical") == ImageModality.OPTICAL
    assert InputValidator.infer_modality(declared_modality="RGB") == ImageModality.OPTICAL


def test_modality_precedence_explicit_sar():
    """Explicit SAR declaration resolves to SAR."""
    assert InputValidator.infer_modality(declared_modality="sar") == ImageModality.SAR
    assert InputValidator.infer_modality(declared_modality="radar") == ImageModality.SAR


def test_modality_precedence_explicit_multispectral():
    """Explicit multispectral declaration resolves to MULTISPECTRAL."""
    assert InputValidator.infer_modality(declared_modality="multispectral") == ImageModality.MULTISPECTRAL


def test_modality_precedence_documented_benchmark_fixture():
    """Documented benchmark fixture paths resolve to their documented modality."""
    assert InputValidator.infer_modality(source_path="tests/data/sat_before.jpg") == ImageModality.OPTICAL
    assert InputValidator.infer_modality(source_path="tests/data/optical/sat_after.jpg") == ImageModality.OPTICAL


def test_modality_precedence_arbitrary_rgb_is_unknown():
    """CRITICAL: Arbitrary RGB JPEG is NOT inferred as optical satellite imagery."""
    assert InputValidator.infer_modality(source_path="random_photo.jpg") == ImageModality.UNKNOWN
    assert InputValidator.infer_modality(source_path="tests/data/other_photo.png") == ImageModality.UNKNOWN
    assert InputValidator.infer_modality(declared_modality=None, source_path=None) == ImageModality.UNKNOWN


def test_modality_never_inferred_as_sar_from_filename():
    """CRITICAL: SAR is NEVER inferred from filename or extension."""
    assert InputValidator.infer_modality(source_path="sar_image.jpg") == ImageModality.UNKNOWN
    assert InputValidator.infer_modality(source_path="sentinel1_sar.tif") == ImageModality.UNKNOWN
    assert InputValidator.infer_modality(source_path="radar_data.png") == ImageModality.UNKNOWN


def test_load_jpeg_no_geospatial_fabrication():
    """JPEG image loading extracts correct dimensions but does not fabricate GeoTIFF tags."""
    img_path = "tests/data/sat_before.jpg"
    pil_img, meta = InputValidator.load_image(img_path, source_label="sat_before")

    assert meta.width == 1200
    assert meta.height == 896
    assert meta.channels == 3
    assert meta.format == ImageFormat.JPEG
    assert meta.modality == ImageModality.OPTICAL  # via documented fixture
    assert meta.is_geotiff is False
    assert meta.has_geospatial_tags is False
    assert meta.pixel_scale is None
    assert meta.tiepoints is None


def test_load_geotiff_with_real_tags():
    """TIFF with GeoTIFF tags extracts pixel scale without hallucinating CRS."""
    img = Image.new("L", (256, 256), color=128)
    buf = io.BytesIO()

    # Save with real TIFF tags
    tiffinfo = {
        TAG_MODEL_PIXEL_SCALE: (10.0, 10.0, 0.0),
        TAG_MODEL_TIEPOINT: (0.0, 0.0, 0.0, 500000.0, 4649780.0, 0.0),
    }
    img.save(buf, format="TIFF", tiffinfo=tiffinfo)
    buf.seek(0)

    _, meta = InputValidator.load_image(buf.getvalue(), declared_modality="sar", source_label="mock_geotiff")

    assert meta.width == 256
    assert meta.height == 256
    assert meta.channels == 1
    assert meta.format == ImageFormat.GEOTIFF
    assert meta.is_geotiff is True
    assert meta.modality == ImageModality.SAR
    assert meta.pixel_scale == (10.0, 10.0, 0.0)
    assert meta.tiepoints is not None


def test_bitemporal_pair_validation_dimension_match():
    """Bi-temporal validation passes when dimensions match and flags alignment checking."""
    meta_a = ImageMetadata(
        width=512, height=512, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )
    meta_b = ImageMetadata(
        width=512, height=512, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )

    res = InputValidator.validate_pair(meta_a, meta_b, intended_type="bi_temporal")
    assert res.is_valid_pair is True
    assert res.pair_type == "bi_temporal"
    assert res.dimensions_match is True
    assert res.channels_match is True
    assert len(res.errors) == 0


def test_bitemporal_pair_validation_dimension_mismatch_fails():
    """Bi-temporal validation strictly fails when raster dimensions differ."""
    meta_a = ImageMetadata(
        width=512, height=512, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )
    meta_b = ImageMetadata(
        width=256, height=256, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )

    res = InputValidator.validate_pair(meta_a, meta_b, intended_type="bi_temporal")
    assert res.is_valid_pair is False
    assert res.dimensions_match is False
    assert any("dimension" in err.lower() for err in res.errors)


def test_cross_modal_optical_sar_allows_differing_dimensions_and_channels():
    """CRITICAL: Optical+SAR allows different dimensions and channels without failing."""
    meta_optical = ImageMetadata(
        width=1200, height=896, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )
    meta_sar = ImageMetadata(
        width=800, height=600, channels=1, mode="L",
        format=ImageFormat.GEOTIFF, modality=ImageModality.SAR, is_geotiff=True
    )

    res = InputValidator.validate_pair(meta_optical, meta_sar, intended_type="cross_modal")
    assert res.is_valid_pair is True
    assert res.pair_type == "cross_modal_optical_sar"
    assert res.dimensions_match is False
    assert res.channels_match is False
    assert len(res.errors) == 0
    assert any("differing dimensions" in w.lower() for w in res.warnings)


def test_cross_modal_optical_sar_rejects_missing_sar():
    """Cross-modal pair validation fails if neither image is declared SAR."""
    meta_a = ImageMetadata(
        width=1200, height=896, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )
    meta_b = ImageMetadata(
        width=1200, height=896, channels=3, mode="RGB",
        format=ImageFormat.JPEG, modality=ImageModality.OPTICAL
    )

    res = InputValidator.validate_pair(meta_a, meta_b, intended_type="cross_modal")
    assert res.is_valid_pair is False
    assert any("one image must be explicitly optical and the other explicitly sar" in err.lower() for err in res.errors)
