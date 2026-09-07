"""Data models and schemas for SatQuery Visual Question Answering (VQA)."""

from typing import List, Optional
from pydantic import BaseModel, Field


class ImageValidationError(Exception):
    """Raised when an input image cannot be found, loaded, or decoded."""
    pass


class VQAOutputSchema(BaseModel):
    """Structured output schema for Gemini Visual Question Answering inference."""

    answer: str = Field(
        ...,
        description="Clear, grounded natural language answer to the user's visual question based strictly on the image.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score in the visual answer based on image clarity, resolution, and visual evidence (0.0 to 1.0).",
    )
    observations: List[str] = Field(
        default_factory=list,
        description="Directly observable visual features, patterns, structures, or anomalies present in the image.",
    )
    detected_objects: List[str] = Field(
        default_factory=list,
        description="Categories of visible objects or facilities (e.g. buildings, roads, runways, airplanes, ships, water bodies).",
    )
    land_use: List[str] = Field(
        default_factory=list,
        description="Identified land use or land cover categories (e.g. urban, agricultural, forested, coastal, industrial, airport).",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Caveats or uncertainty notes if resolution, illumination, clouds, or occlusion limit interpretation.",
    )
