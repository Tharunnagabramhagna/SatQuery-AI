"""Common analytical artifacts and visualization schemas."""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class AnalysisEvidence(BaseModel):
    """Evidence item supporting the analytical answer."""

    type: str = Field(..., description="Evidence type (e.g., metric, metadata, spectral_index, visual_observation, semantic_interpretation)")
    description: str = Field(..., description="Explanation of what was detected or measured")
    source: str = Field(..., description="Tool or sensor source of the evidence")
    modality: Optional[str] = Field(default=None, description="Modality associated with this evidence (e.g. optical, sar, multispectral, fused)")
    region: Optional[List[float]] = Field(default=None, description="Optional bounding box [ymin, xmin, ymax, xmax] associated with the evidence")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Confidence score associated with this individual evidence item")


class AnalysisVisualization(BaseModel):
    """Visual evidence or overlay item."""

    type: str = Field(..., description="Visualization type: bounding_box | polygon | mask | heatmap | point")
    data: Any = Field(default=None, description="Structured coordinates or base64 overlay")
    label: str = Field(..., description="Descriptive label for UI overlay rendering")
