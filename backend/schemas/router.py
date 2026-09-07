"""Schemas for the SatQuery Agent Router."""

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from backend.schemas.query_understanding import QueryIntent, StructuredQuery


class ToolIdentifier(str, Enum):
    """Identifier for specialist tools managed by the Agent Router."""

    VQA_TOOL = "VQA_TOOL"
    GROUNDING_TOOL = "GROUNDING_TOOL"
    CHANGE_DETECTION_TOOL = "CHANGE_DETECTION_TOOL"
    COMPARISON_TOOL = "COMPARISON_TOOL"
    CLARIFICATION_TOOL = "CLARIFICATION_TOOL"


class RoutingDecision(BaseModel):
    """
    Structured routing decision produced by the Agent Router.
    Maps an analyzed query to the appropriate specialist tool or fallback handler.
    """

    selected_tool: ToolIdentifier = Field(
        ...,
        description="Target specialist tool or clarification handler",
    )
    intent: QueryIntent = Field(
        ...,
        description="Original query intent identified by the Query Understanding layer",
    )
    routing_confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for this routing decision",
    )
    reason: str = Field(
        ...,
        description="Detailed explanation of why this tool was selected or why clarification was requested",
    )
    requires_clarification: bool = Field(
        default=False,
        description="True if query is ambiguous, underspecified, or below confidence threshold",
    )
    clarification_prompt: Optional[str] = Field(
        default=None,
        description="Suggested prompt or guidance for the user when clarification is required",
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tool-specific execution parameters extracted from the query",
    )
    structured_query: Optional[StructuredQuery] = Field(
        default=None,
        description="Full structured query intelligence preserved from Query Understanding",
    )
