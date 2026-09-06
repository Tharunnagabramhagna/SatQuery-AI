"""Analysis response schemas for history and retrieval endpoints.

Provides Pydantic models for the analysis history list and single analysis
detail endpoints. These schemas serialize persisted Analysis database records
into frontend-consumable JSON.

Note: The backend does NOT provide a `modality` field. The frontend should
derive display-level modality labels from the `mode` field.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AnalysisHistoryItem(BaseModel):
    """Summary of a persisted analysis for history listing.

    Maps to the frontend AnalysisRecord type (minus `modality`, which the
    frontend should derive from `mode`).
    """

    id: str = Field(..., description="Unique analysis identifier (UUID string)")
    query: str = Field(..., description="Natural language query that was analyzed")
    mode: Optional[str] = Field(default=None, description="Analysis mode (e.g. compare_images, single_image)")
    capability: Optional[str] = Field(default=None, description="Analysis capability (e.g. change_detection, vqa)")
    status: str = Field(..., description="Analysis outcome status (completed, error, failed)")
    date: str = Field(..., description="ISO 8601 timestamp of analysis creation")
    is_demo: bool = Field(default=False, serialization_alias="isDemo", description="Always false for persisted analyses")

    model_config = ConfigDict(populate_by_name=True)


class AnalysisDetailResponse(BaseModel):
    """Full persisted analysis for single retrieval.

    Includes the complete structured response payload stored in response_json.
    """

    id: str = Field(..., description="Unique analysis identifier (UUID string)")
    query: str = Field(..., description="Natural language query that was analyzed")
    mode: Optional[str] = Field(default=None, description="Analysis mode")
    capability: Optional[str] = Field(default=None, description="Analysis capability")
    status: str = Field(..., description="Analysis outcome status")
    date: str = Field(..., description="ISO 8601 timestamp of analysis creation")
    is_demo: bool = Field(default=False, serialization_alias="isDemo", description="Always false for persisted analyses")
    response: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Complete structured analysis result payload (contains analysisId, "
            "status, task, answer, confidence, evidence, visualizations, "
            "executionTrace, warnings, isDemo)"
        ),
    )

    model_config = ConfigDict(populate_by_name=True)
