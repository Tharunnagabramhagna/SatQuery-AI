"""Schemas for persisted satellite analysis history."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AnalysisHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    """Single persisted analysis record returned by the history API."""

    id: UUID
    query: str
    mode: Optional[str] = None
    capability: Optional[str] = None
    status: str
    response_json: Optional[Dict[str, Any]] = None
    created_at: datetime


class AnalysisHistoryResponse(BaseModel):
    """Response containing the authenticated user's analysis history."""

    items: List[AnalysisHistoryItem] = Field(default_factory=list)
    total: int
