"""Data models and schemas for SatQuery Visual Grounding and Object Localization."""

import math
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ImageValidationError(Exception):
    """Raised when an input image cannot be found, loaded, or decoded."""
    pass


class GroundingObject(BaseModel):
    """Single localized target object with normalized 2D image bounding box."""

    label: str = Field(..., description="Target object category or name (e.g. building, runway, airplane, ship).")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Visual localization confidence score (0.0 to 1.0).")
    bbox: List[float] = Field(
        ...,
        description="Normalized bounding box coordinates in [ymin, xmin, ymax, xmax] format, where 0 <= ymin < ymax <= 1 and 0 <= xmin < xmax <= 1.",
    )


class GroundingOutputSchema(BaseModel):
    """Structured output schema for Gemini Visual Grounding inference."""

    answer: str = Field(
        ...,
        description="Textual explanation of localization findings, highlighting where targets are situated in the scene.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall confidence in visual localization results (0.0 to 1.0).",
    )
    objects: List[GroundingObject] = Field(
        default_factory=list,
        description="List of localized objects with normalized bounding boxes [ymin, xmin, ymax, xmax].",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Caveats regarding resolution, occlusions, or localization uncertainty.",
    )


# Boundary overshoot tolerance for minor model/serialization precision (e.g. -0.001 -> 0.0, 1.001 -> 1.0)
COORDINATE_TOLERANCE = 0.005


def validate_and_normalize_bbox(raw_bbox: Any) -> Optional[List[float]]:
    """
    Validate and strictly enforce normalized [ymin, xmin, ymax, xmax] bounding box coordinates.

    Rules:
    - Must be a 4-element sequence of finite real numbers.
    - Only tiny numerical boundary overshoots within [-0.02, 1.02] are clamped to [0.0, 1.0].
    - Arbitrary invalid coordinates (e.g. -0.4, 1.7, NaN, infinity) are rejected.
    - After clamping, strictly enforces 0.0 <= ymin < ymax <= 1.0 and 0.0 <= xmin < xmax <= 1.0.
    - Fundamentally invalid, inverted, or collapsed boxes are rejected (returns None).
    """
    if not isinstance(raw_bbox, (list, tuple)) or len(raw_bbox) != 4:
        return None

    cleaned: List[float] = []
    for coord in raw_bbox:
        if isinstance(coord, bool) or not isinstance(coord, (int, float)):
            return None
        c_float = float(coord)
        if not math.isfinite(c_float):
            return None
        # Discard arbitrary out-of-range coordinates
        if c_float < -COORDINATE_TOLERANCE or c_float > 1.0 + COORDINATE_TOLERANCE:
            return None
        # Clamp tiny boundary overshoots to [0.0, 1.0]
        clamped = max(0.0, min(1.0, c_float))
        cleaned.append(round(clamped, 4))

    ymin, xmin, ymax, xmax = cleaned

    # Strictly enforce valid non-collapsed non-inverted 2D box geometry
    if not (0.0 <= ymin < ymax <= 1.0 and 0.0 <= xmin < xmax <= 1.0):
        return None

    return [ymin, xmin, ymax, xmax]
