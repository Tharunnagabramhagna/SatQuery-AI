"""Unit tests for BigEarthNet Remote-Sensing Adaptation Pipeline.

Tests verify:
1. BigEarthNet index reader raises FileNotFoundError on missing index files (no fake manifests).
2. BigEarthNet index reader correctly reads real index format.
3. CLC-19 taxonomy to SatQuery categories mapping.
4. Adaptation state machine correctly evaluates filesystem state.
5. Inference adapter strictly returns TRAINING_REQUIRED when no verified checkpoint exists.
6. Zero fabrication: un-adapted base models are never falsely claimed as fine-tuned.
7. Training CLI argument parser and dry-run execution.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import pytest

from backend.ml.adapter import RemoteSensingInferenceAdapter
from backend.ml.dataset import (
    BIGEARTHNET_19_CLASSES,
    BIGEARTHNET_TO_SATQUERY_TAXONOMY,
    BigEarthNetIndexReader,
)
from backend.ml.pipeline import (
    AdaptationState,
    ModelAdapterConfig,
    RemoteSensingAdaptationPipeline,
)
from backend.ml.train import build_argument_parser


def test_bigearthnet_index_reader_missing_file_raises_error():
    """Index reader must raise FileNotFoundError if the index file is not present."""
    non_existent = Path("non_existent_bigearthnet_index.txt")
    with pytest.raises(FileNotFoundError) as exc_info:
        BigEarthNetIndexReader.read_index(non_existent)
    assert "not found" in str(exc_info.value).lower()


def test_bigearthnet_index_reader_parses_lines(tmp_path: Path):
    """Index reader correctly loads non-empty, non-comment lines."""
    index_file = tmp_path / "sample_index.txt"
    index_file.write_text(
        "# Header comment\n"
        "S2A_MSIL2A_20170613T101031_0_45\n"
        "S2A_MSIL2A_20170613T101031_0_46\n"
        "\n"
        "S2B_MSIL2A_20170705T103029_12_78\n",
        encoding="utf-8",
    )

    patches = BigEarthNetIndexReader.read_index(index_file)
    assert len(patches) == 3
    assert patches[0] == "S2A_MSIL2A_20170613T101031_0_45"
    assert patches[1] == "S2A_MSIL2A_20170613T101031_0_46"
    assert patches[2] == "S2B_MSIL2A_20170705T103029_12_78"


def test_taxonomy_mapping_covers_all_19_classes():
    """All 19 official BigEarthNet classes must map to valid SatQuery categories."""
    assert len(BIGEARTHNET_19_CLASSES) == 19
    for cls_name in BIGEARTHNET_19_CLASSES:
        assert cls_name in BIGEARTHNET_TO_SATQUERY_TAXONOMY
        satquery_cat = BIGEARTHNET_TO_SATQUERY_TAXONOMY[cls_name]
        assert satquery_cat in {"built-up", "agricultural_land", "vegetation", "bare_land", "water"}

    # Test helper method
    mapped = BigEarthNetIndexReader.map_to_satquery_categories(["Urban fabric", "Inland waters"])
    assert "built-up" in mapped
    assert "water" in mapped


def test_pipeline_returns_training_required_when_no_checkpoint(tmp_path: Path):
    """Pipeline strictly returns TRAINING_REQUIRED when checkpoint directory has no manifest."""
    pipeline = RemoteSensingAdaptationPipeline()
    empty_dir = tmp_path / "empty_checkpoints"
    empty_dir.mkdir()

    state = pipeline.get_current_state(checkpoint_dir=empty_dir)
    assert state == AdaptationState.TRAINING_REQUIRED


def test_pipeline_verifies_valid_checkpoint_and_sha256(tmp_path: Path):
    """Pipeline verifies checkpoint only when both manifest and matching weights exist."""
    ckpt_dir = tmp_path / "valid_ckpt"
    ckpt_dir.mkdir()

    # Create dummy weights
    weights_path = ckpt_dir / "adapter_weights.bin"
    dummy_bytes = b"model_adapter_layer_tensor_data_12345"
    weights_path.write_bytes(dummy_bytes)
    sha = hashlib.sha256(dummy_bytes).hexdigest()

    manifest_data = {
        "checkpoint_id": "test_ckpt_01",
        "weights_filename": "adapter_weights.bin",
        "weights_sha256": sha,
        "epochs_trained": 5,
        "validation_macro_f1": 0.78,
    }
    manifest_path = ckpt_dir / "checkpoint.json"
    manifest_path.write_text(json.dumps(manifest_data), encoding="utf-8")

    pipeline = RemoteSensingAdaptationPipeline()
    state = pipeline.get_current_state(checkpoint_dir=ckpt_dir)
    assert state == AdaptationState.CHECKPOINT_VERIFIED


def test_pipeline_rejects_corrupted_weights_sha(tmp_path: Path):
    """Pipeline rejects checkpoint if weights sha256 does not match manifest."""
    ckpt_dir = tmp_path / "corrupt_ckpt"
    ckpt_dir.mkdir()

    weights_path = ckpt_dir / "adapter_weights.bin"
    weights_path.write_bytes(b"tampered_bytes")

    manifest_data = {
        "checkpoint_id": "test_ckpt_02",
        "weights_filename": "adapter_weights.bin",
        "weights_sha256": "expected_different_sha256_hash",
    }
    (ckpt_dir / "checkpoint.json").write_text(json.dumps(manifest_data), encoding="utf-8")

    pipeline = RemoteSensingAdaptationPipeline()
    state = pipeline.get_current_state(checkpoint_dir=ckpt_dir)
    assert state == AdaptationState.TRAINING_REQUIRED


def test_inference_adapter_returns_training_required_without_weights(tmp_path: Path):
    """Inference adapter strictly returns TRAINING_REQUIRED without fabricated predictions."""
    adapter = RemoteSensingInferenceAdapter(checkpoint_dir=tmp_path / "non_existent")
    res = adapter.predict(image_input=b"fake_image_bytes")

    assert res.state == AdaptationState.TRAINING_REQUIRED
    assert res.is_adapted is False
    assert res.confidence == 0.0
    assert "TRAINING_REQUIRED" in res.message


def test_train_cli_argument_parser():
    """Training CLI argument parser supports all required parameters."""
    parser = build_argument_parser()
    args = parser.parse_args([
        "--dataset-index", "BigEarthNet.txt",
        "--data-dir", "data/BigEarthNet",
        "--output-dir", "checkpoints/run1",
        "--epochs", "20",
        "--batch-size", "64",
        "--dry-run",
    ])

    assert args.dataset_index == "BigEarthNet.txt"
    assert args.data_dir == "data/BigEarthNet"
    assert args.output_dir == "checkpoints/run1"
    assert args.epochs == 20
    assert args.batch_size == 64
    assert args.dry_run is True
