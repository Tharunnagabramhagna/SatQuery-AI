"""Common analytical artifacts and visualization schemas."""

from typing import Any
from pydantic import BaseModel, Field


class AnalysisEvidence(BaseModel):
    """Evidence item supporting the analytical answer."""

    type: str = Field(..., description="Evidence type (e.g., metric, metadata, spectral_index)")
    description: str = Field(..., description="Explanation of what was detected or measured")
    source: str = Field(..., description="Tool or sensor source of the evidence")


class AnalysisVisualization(BaseModel):
    """Visual evidence or overlay item."""

    type: str = Field(..., description="Visualization type: bounding_box | polygon | mask | heatmap | point")
    data: Any = Field(default=None, description="Structured coordinates or base64 overlay")
    label: str = Field(..., description="Descriptive label for UI overlay rendering")
