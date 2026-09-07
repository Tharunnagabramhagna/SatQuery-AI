"""Tests for GeoChat / Remote Sensing VLM Inference Pipeline (src/models/geochat_inference.py)."""

from __future__ import annotations

import os
import tempfile
import pytest
from PIL import Image

from src.models.geochat_inference import (
    get_device_and_dtype,
    cleanup_memory,
    load_remote_sensing_image,
    parse_grounding_coordinates,
    predict_vqa_and_grounding,
    GeoChatPipeline,
)

DUMMY_BASE64_IMAGE = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAE0lEQVR4nGP8z4APMOGVZRip0gBBLAETee26JgAAAABJRU5ErkJggg=="
)


# =============================================================================
# 1. Coordinate & Token Parsing Tests
# =============================================================================

def test_parse_normalized_float_brackets():
    """Verify parsing standard bracketed normalized coordinates."""
    text = (
        "The primary runway is located at [0.420, 0.080, 0.480, 0.920], and terminal at [0.660, 0.400, 0.750, 0.600]."
    )
    boxes = parse_grounding_coordinates(text, query_hint="Where is the runway?")
    assert len(boxes) == 2

    b1 = boxes[0]["box_2d"]
    assert b1 == [0.420, 0.080, 0.480, 0.920]
    assert "runway" in boxes[0]["label"].lower()

    b2 = boxes[1]["box_2d"]
    assert b2 == [0.660, 0.400, 0.750, 0.600]
    assert "terminal" in boxes[1]["label"].lower()


def test_parse_scaled_integer_coordinates():
    """Verify parsing GeoChat / LLaVA 0..1000 integer coordinates."""
    text = (
        "Aircraft is located at [560, 380, 600, 420] and fuel storage tank at [180, 620, 260, 700]."
    )
    boxes = parse_grounding_coordinates(text)
    assert len(boxes) == 2

    # Scaled down by 1000
    b1 = boxes[0]["box_2d"]
    assert b1 == [0.56, 0.38, 0.6, 0.42]
    assert "aircraft" in boxes[0]["label"].lower()

    b2 = boxes[1]["box_2d"]
    assert b2 == [0.18, 0.62, 0.26, 0.7]
    assert "tank" in boxes[1]["label"].lower() or "storage" in boxes[1]["label"].lower()


def test_parse_loc_tokens():
    """Verify parsing GeoChat location tokens <loc_y1><loc_x1><loc_y2><loc_x2>."""
    text = (
        "Cargo ship <loc_310> <loc_150> <loc_420> <loc_320> approaching deepwater pier."
    )
    boxes = parse_grounding_coordinates(text)
    assert len(boxes) == 1
    assert boxes[0]["box_2d"] == [0.31, 0.15, 0.42, 0.32]
    assert "ship" in boxes[0]["label"].lower() or "cargo" in boxes[0]["label"].lower()


def test_parse_qwen_and_xml_box_tags():
    """Verify parsing Qwen-VL style <|box_start|> and XML <box> tags."""
    text = (
        "Solar array <|box_start|>(0.12, 0.14), (0.28, 0.45)<|box_end|> and "
        "substation <box>[0.28, 0.46, 0.34, 0.52]</box>."
    )
    boxes = parse_grounding_coordinates(text)
    assert len(boxes) == 2
    assert boxes[0]["box_2d"] == [0.12, 0.14, 0.28, 0.45]
    assert boxes[1]["box_2d"] == [0.28, 0.46, 0.34, 0.52]


def test_coordinate_ordering_and_clamping():
    """Verify inverted coordinates get normalized to [ymin, xmin, ymax, xmax] with proper min/max ordering."""
    # Input has y2 < y1, x2 < x1 and values slightly exceeding bounds
    text = "Feature at [0.85, 0.90, 0.15, 0.20]"
    boxes = parse_grounding_coordinates(text, query_hint="Feature")
    assert len(boxes) == 1
    ymin, xmin, ymax, xmax = boxes[0]["box_2d"]
    assert ymin == 0.15
    assert xmin == 0.20
    assert ymax == 0.85
    assert xmax == 0.90


def test_empty_and_degenerate_input():
    """Verify empty text or zero-area boxes return empty list."""
    assert parse_grounding_coordinates("") == []
    assert parse_grounding_coordinates("No coordinates mentioned in this satellite report.") == []
    # Degenerate zero-area box [0.5, 0.5, 0.5, 0.5]
    assert parse_grounding_coordinates("Point at [0.5, 0.5, 0.5, 0.5]") == []


# =============================================================================
# 2. Device Detection & Memory Cleanup Tests
# =============================================================================

def test_device_and_dtype_detection():
    """Verify device auto-detection returns valid device and dtype."""
    device, dtype = get_device_and_dtype()
    assert isinstance(device, str)
    assert any(device.startswith(prefix) for prefix in ["cuda", "cpu", "mps"])
    assert dtype is not None


def test_cleanup_memory_routine():
    """Verify memory cleanup routine runs without raising exceptions and returns stats."""
    stats = cleanup_memory()
    assert isinstance(stats, dict)
    assert "garbage_collected_objects" in stats
    assert "cuda_available" in stats


# =============================================================================
# 3. Image Loading Tests
# =============================================================================

def test_load_image_from_pil():
    """Verify loading from an existing PIL image."""
    img = Image.new("RGB", (64, 64), color="blue")
    loaded = load_remote_sensing_image(img)
    assert loaded.size == (64, 64)
    assert loaded.mode == "RGB"


def test_load_image_from_base64():
    """Verify loading image from base64 data URI."""
    loaded = load_remote_sensing_image(DUMMY_BASE64_IMAGE)
    assert loaded.size == (10, 10)
    assert loaded.mode == "RGB"


def test_load_image_from_local_file():
    """Verify loading image from a local temporary file."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        sample = Image.new("RGB", (32, 32), color="green")
        sample.save(tmp_path)

        loaded = load_remote_sensing_image(tmp_path)
        assert loaded.size == (32, 32)
        assert loaded.mode == "RGB"
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_load_invalid_image_path():
    """Verify FileNotFoundError on non-existent path."""
    with pytest.raises(FileNotFoundError):
        load_remote_sensing_image("non_existent_satellite_file_path_12345.tif")


# =============================================================================
# 4. Pipeline Execution Tests
# =============================================================================

def test_predict_vqa_and_grounding_end_to_end():
    """Verify predict_vqa_and_grounding pipeline produces complete output schema."""
    result = predict_vqa_and_grounding(
        image_path=DUMMY_BASE64_IMAGE,
        prompt="Where are the aircraft?",
    )

    assert "answer" in result
    assert isinstance(result["answer"], str)
    assert "bounding_boxes" in result
    assert isinstance(result["bounding_boxes"], list)
    assert result["total_grounded"] >= 1
    assert "device" in result
    assert "inference_time_ms" in result
    assert result["coordinate_format"] == "[ymin, xmin, ymax, xmax] normalized to [0.0, 1.0]"

    # Check that each grounded bounding box matches [ymin, xmin, ymax, xmax]
    for item in result["bounding_boxes"]:
        assert "label" in item
        assert "box_2d" in item
        ymin, xmin, ymax, xmax = item["box_2d"]
        assert 0.0 <= ymin < ymax <= 1.0
        assert 0.0 <= xmin < xmax <= 1.0


def test_predict_vqa_and_grounding_storage_tanks():
    """Verify query-specific grounding logic for storage tanks."""
    result = predict_vqa_and_grounding(
        image_path=DUMMY_BASE64_IMAGE,
        prompt="Locate fuel storage tanks",
    )
    assert result["total_grounded"] >= 2
    assert any("tank" in b["label"].lower() for b in result["bounding_boxes"])
