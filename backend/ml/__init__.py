"""Machine learning and domain adaptation package for SatQuery AI."""

from backend.ml.adapter import AdaptationInferenceResult, RemoteSensingInferenceAdapter
from backend.ml.dataset import (
    BIGEARTHNET_19_CLASSES,
    BIGEARTHNET_TO_SATQUERY_TAXONOMY,
    BigEarthNetIndexReader,
    BigEarthNetPatchMetadata,
)
from backend.ml.pipeline import AdaptationState, ModelAdapterConfig, RemoteSensingAdaptationPipeline

__all__ = [
    "AdaptationInferenceResult",
    "AdaptationState",
    "BIGEARTHNET_19_CLASSES",
    "BIGEARTHNET_TO_SATQUERY_TAXONOMY",
    "BigEarthNetIndexReader",
    "BigEarthNetPatchMetadata",
    "ModelAdapterConfig",
    "RemoteSensingAdaptationPipeline",
    "RemoteSensingInferenceAdapter",
]
