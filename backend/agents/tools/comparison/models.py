"""Data models and schemas for SatQuery Multimodal Image Comparison."""

from typing import List
from pydantic import BaseModel, Field


class ImageValidationError(Exception):
    """Raised when an input image cannot be found, loaded, or decoded."""
    pass


class ComparisonOutputSchema(BaseModel):
    """Structured output schema for Gemini Multimodal Comparison inference."""

    answer: str = Field(
        ...,
        description="Comprehensive natural language semantic comparison summary answering the user query.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall confidence score in visual comparison reliability (0.0 to 1.0).",
    )
    similarities: List[str] = Field(
        default_factory=list,
        description="Key visual and semantic similarities observed between Image A and Image B.",
    )
    differences: List[str] = Field(
        default_factory=list,
        description="Key visual and semantic differences observed between Image A and Image B.",
    )
    observations: List[str] = Field(
        default_factory=list,
        description="Directly observable visual features, contextual conditions, or land-cover details.",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Caveats regarding resolution, alignment, cloud cover, sensor/modality differences, or comparison uncertainty.",
    )
    optical_evidence: List[str] = Field(
        default_factory=list,
        description="Directly observable visual, spectral, contextual, and land-cover features from optical imagery.",
    )
    sar_evidence: List[str] = Field(
        default_factory=list,
        description="Directly observable radar backscatter intensity, surface roughness, structural bounce, and moisture response features from SAR imagery.",
    )
    fused_conclusion: str = Field(
        default="",
        description="Reconciled multimodal analytical conclusion synthesizing both sensor modalities.",
    )
    conflicting_evidence: List[str] = Field(
        default_factory=list,
        description="Contradictions or divergences between optical spectral reflectance and radar backscatter.",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Sensor, resolution, and VLM limitations (e.g. noting that visual VLM analysis of SAR interprets rendered intensity patterns rather than calibrated complex polarimetry).",
    )
