"""Data models for Change Detection Engine and Analysis Results."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CoregistrationResult(BaseModel):
    """Result of structural co-registration and spatial alignment assessment."""

    quality_score: float = Field(..., description="Alignment quality score in [0.0, 1.0]")
    is_co_registered: bool = Field(..., description="Whether images meet the alignment threshold")
    status: str = Field(..., description="Alignment status: 'verified', 'marginal', or 'uncertain'")
    discrepancy_factor: float = Field(..., description="Estimated misalignment discrepancy factor")
    warning: Optional[str] = Field(default=None, description="Caveat message if alignment quality is degraded")


class ChangeMetrics(BaseModel):
    """Quantitative metrics computed from bi-temporal RGB pixel-level difference."""

    changed_pixels: int = Field(..., description="Count of pixels exceeding the sensitivity threshold")
    total_pixels: int = Field(..., description="Total pixels evaluated in canonical grid")
    change_percentage: float = Field(..., description="Percentage of pixels modified between T1 and T2")
    mean_difference_intensity: float = Field(..., description="Mean Euclidean pixel difference intensity across grid")


class ChangeRegion(BaseModel):
    """Localized cluster of detected change with normalized pixel bounding box."""

    region_id: int = Field(..., description="Unique cluster identifier")
    box_2d: List[float] = Field(
        ...,
        description="Normalized pixel bounding box [ymin, xmin, ymax, xmax] in range [0.0, 1.0]",
    )
    confidence: float = Field(..., description="Confidence score for this cluster")


class ChangeDetectionResult(BaseModel):
    """Complete structured output from ChangeDetectionEngine."""

    summary: str = Field(..., description="Grounded natural-language explanation of detected change")
    confidence: float = Field(..., description="Overall confidence adjusted by co-registration quality")
    metrics: ChangeMetrics = Field(..., description="Quantitative change metrics")
    coregistration: CoregistrationResult = Field(..., description="Co-registration alignment diagnostics")
    regions: List[ChangeRegion] = Field(default_factory=list, description="Extracted change clusters")
    mask_base64: str = Field(..., description="Base64 encoded PNG overlay mask data URI")
    mask_dimensions: Dict[str, int] = Field(..., description="Dimensions of the change mask (rows and cols)")
    image_dimensions: Dict[str, Any] = Field(default_factory=dict, description="Original dimensions of input images")
    sensitivity: float = Field(..., description="Difference sensitivity threshold used")
    warnings: List[str] = Field(default_factory=list, description="Warnings generated during analysis")
