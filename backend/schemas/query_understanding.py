"""Schemas for Query Understanding intelligence layer."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QueryIntent(str, Enum):
    """Supported query intents for the SatQuery prototype."""

    VQA = "VQA"
    GROUNDING = "GROUNDING"
    CHANGE_DETECTION = "CHANGE_DETECTION"
    COMPARISON = "COMPARISON"
    UNKNOWN = "UNKNOWN"


class TemporalInfo(BaseModel):
    """Structured temporal information extracted from query."""

    has_temporal: bool = Field(default=False, description="Whether temporal expressions were found")
    raw_time_expression: Optional[str] = Field(default=None, description="Extracted temporal phrase")
    time_points: List[str] = Field(default_factory=list, description="Extracted dates, years, or phases")
    is_bi_temporal: bool = Field(default=False, description="Whether query references two distinct time periods")


class SpatialInfo(BaseModel):
    """Structured spatial/location information extracted from query."""

    has_spatial: bool = Field(default=False, description="Whether spatial or positional references exist")
    locations: List[str] = Field(default_factory=list, description="Extracted regions, landmarks, or features")
    cardinal_directions: List[str] = Field(default_factory=list, description="Directions (north, south, etc.)")


class ComparisonInfo(BaseModel):
    """Structured comparison indicators extracted from query."""

    is_comparison: bool = Field(default=False, description="Whether comparison indicators exist")
    comparison_type: Optional[str] = Field(
        default=None,
        description="Type of comparison: 'optical_sar', 'temporal', 'sensor', 'general'",
    )
    indicators: List[str] = Field(default_factory=list, description="Matching comparison indicator keywords")


class StructuredQuery(BaseModel):
    """
    Typed structured result produced by the Query Understanding intelligence layer.
    Feeds directly into downstream Agent Orchestrator, Router, and Tools.
    """

    original_query: str = Field(..., description="The original natural-language query")
    intent: QueryIntent = Field(..., description="Classified intent")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence score [0.0, 1.0]")
    target_objects: List[str] = Field(
        default_factory=list,
        description="Extracted domain entities or targets (e.g. buildings, water bodies, aircraft)",
    )
    time_range: Optional[str] = Field(default=None, description="Summary time range if temporal")
    temporal: Optional[TemporalInfo] = Field(default=None, description="Extracted temporal details")
    spatial: Optional[SpatialInfo] = Field(default=None, description="Extracted spatial/positional details")
    comparison: Optional[ComparisonInfo] = Field(default=None, description="Extracted comparison details")
    modality_hint: Optional[str] = Field(
        default=None,
        description="Sensor or modality hint: 'optical', 'sar', 'multimodal'",
    )
    is_ambiguous: bool = Field(default=False, description="True if query could map to multiple intents")
    ambiguity_reason: Optional[str] = Field(default=None, description="Explanation if ambiguous")
    extracted_attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional query characteristics (e.g. count query, existence query, etc.)",
    )
