"""Remote Sensing Adaptation Pipeline Definition for SatQuery AI.

Establishes the reproducible training pipeline and state tracking for
adapting vision components using remote-sensing datasets (BigEarthNet).
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("satquery.ml.pipeline")


class AdaptationState(str, enum.Enum):
    """
    Lifecycle states for remote-sensing domain adaptation.

    Only states 2, 3, and 4 together demonstrate actual adaptation.
    Without verified trained weights, state remains TRAINING_REQUIRED.
    """

    ADAPTATION_PIPELINE_IMPLEMENTED = "adaptation_pipeline_implemented"
    TRAINING_EXECUTED = "training_executed"
    CHECKPOINT_VERIFIED = "checkpoint_verified"
    ADAPTED_MODEL_USED_IN_INFERENCE = "adapted_model_used_in_inference"
    TRAINING_REQUIRED = "training_required"


@dataclass
class ModelAdapterConfig:
    """Configuration for remote-sensing classification adapter head."""

    architecture: str = "linear_probe_lora"
    backbone: str = "siglip-so400m-patch14-384"
    num_classes: int = 19
    hidden_dim: int = 512
    dropout: float = 0.1
    learning_rate: float = 1e-4
    weight_decay: float = 1e-2
    loss_function: str = "BCEWithLogitsLoss"
    target_dataset: str = "BigEarthNet-S2"


@dataclass
class CheckpointManifest:
    """Verifiable manifest stored with trained adaptation weights."""

    checkpoint_id: str
    model_config: ModelAdapterConfig
    state: AdaptationState
    dataset_name: str
    dataset_patch_count: int
    epochs_trained: int
    validation_micro_f1: float
    validation_macro_f1: float
    weights_filename: str
    weights_sha256: str
    training_timestamp: str
    git_commit: Optional[str] = None


class RemoteSensingAdaptationPipeline:
    """
    Defines the training configuration, loss, and checkpoint verification logic
    for remote-sensing model adaptation.
    """

    DEFAULT_CHECKPOINT_DIR = Path("checkpoints/bigearthnet_adapter")

    def __init__(self, config: Optional[ModelAdapterConfig] = None):
        self.config = config or ModelAdapterConfig()

    def get_current_state(self, checkpoint_dir: Optional[Path] = None) -> AdaptationState:
        """
        Evaluate current adaptation state based on actual filesystem artifacts.

        Strict Rule: Returns TRAINING_REQUIRED if no verified checkpoint exists.
        Never returns ADAPTED_MODEL_USED_IN_INFERENCE without verified weights.
        """
        target_dir = checkpoint_dir or self.DEFAULT_CHECKPOINT_DIR
        manifest_path = target_dir / "checkpoint.json"

        if not manifest_path.is_file():
            return AdaptationState.TRAINING_REQUIRED

        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            weights_file = target_dir / data.get("weights_filename", "")
            if not weights_file.is_file():
                logger.warning("Checkpoint manifest exists but weights file is missing: %s", weights_file)
                return AdaptationState.TRAINING_REQUIRED

            # Verify sha256
            expected_sha = data.get("weights_sha256", "")
            if expected_sha:
                hasher = hashlib.sha256()
                with open(weights_file, "rb") as wf:
                    for chunk in iter(lambda: wf.read(65536), b""):
                        hasher.update(chunk)
                computed_sha = hasher.hexdigest()
                if computed_sha != expected_sha:
                    logger.error("Weights sha256 mismatch: expected %s, got %s", expected_sha, computed_sha)
                    return AdaptationState.TRAINING_REQUIRED

            return AdaptationState.CHECKPOINT_VERIFIED

        except Exception as exc:
            logger.warning("Failed to verify checkpoint manifest: %s", exc)
            return AdaptationState.TRAINING_REQUIRED
