"""Agent Router Implementation for SatQuery AI.

Evaluates the StructuredQuery produced by the Query Understanding layer and
routes it to the appropriate specialist tool or clarification handler.
Strictly separates intent understanding from routing policy.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from backend.agents.router.base import BaseRouter
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier

logger = logging.getLogger("satquery.router")


class AgentRouter(BaseRouter):
    """
    Modular deterministic Agent Router.

    Maps:
      VQA              -> VQA_TOOL
      GROUNDING        -> GROUNDING_TOOL
      CHANGE_DETECTION -> CHANGE_DETECTION_TOOL
      COMPARISON       -> COMPARISON_TOOL
      UNKNOWN          -> CLARIFICATION_TOOL

    Also handles fallbacks:
      - Low-confidence classifications
      - Ambiguous queries
      - Underspecified / isolated entity queries
      - Missing required input parameters
    """

    DEFAULT_CONFIDENCE_THRESHOLD = 0.60

    def __init__(self, min_confidence: float = DEFAULT_CONFIDENCE_THRESHOLD):
        self.min_confidence = min_confidence

    async def route(self, structured_query: StructuredQuery) -> RoutingDecision:
        """
        Evaluate structured query and produce a RoutingDecision.

        Args:
            structured_query: Validated output from Query Understanding layer.

        Returns:
            RoutingDecision containing selected tool, confidence, and metadata.
        """
        intent = structured_query.intent
        confidence = structured_query.confidence
        extracted_attrs = structured_query.extracted_attributes or {}

        # -----------------------------------------------------------------
        # 1. Fallback Condition: Underspecified query (e.g. isolated entity)
        # -----------------------------------------------------------------
        if extracted_attrs.get("type") == "isolated_entity":
            target_str = ", ".join(structured_query.target_objects) or structured_query.original_query
            return RoutingDecision(
                selected_tool=ToolIdentifier.CLARIFICATION_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason=f"Underspecified query: only entity '{target_str}' provided without an action or question.",
                requires_clarification=True,
                clarification_prompt=(
                    f"You mentioned '{target_str}'. What analysis would you like to perform? "
                    "For example: 'Locate all {target_str}', 'Count {target_str}', or 'What changed with {target_str}?'"
                ),
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        # -----------------------------------------------------------------
        # 2. Fallback Condition: Ambiguous query
        # -----------------------------------------------------------------
        if structured_query.is_ambiguous:
            reason = structured_query.ambiguity_reason or "Query exhibits characteristics of multiple analytical intents."
            return RoutingDecision(
                selected_tool=ToolIdentifier.CLARIFICATION_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason=f"Ambiguous query detected: {reason}",
                requires_clarification=True,
                clarification_prompt=(
                    f"Your query appears ambiguous: {reason} "
                    "Please clarify your specific objective (e.g., detect changes over time vs. localize objects in a single image)."
                ),
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        # -----------------------------------------------------------------
        # 3. Fallback Condition: UNKNOWN intent (out-of-domain)
        # -----------------------------------------------------------------
        if intent == QueryIntent.UNKNOWN:
            return RoutingDecision(
                selected_tool=ToolIdentifier.CLARIFICATION_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason="Query intent classified as UNKNOWN (out-of-domain or unrecognized instruction).",
                requires_clarification=True,
                clarification_prompt=(
                    "I am an interactive assistant for Earth Observation and remote sensing imagery. "
                    "Please ask a question related to satellite imagery, such as scene description (VQA), "
                    "object localization (Grounding), temporal change analysis, or Optical-SAR comparison."
                ),
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        # -----------------------------------------------------------------
        # 4. Fallback Condition: Low-confidence classification
        # -----------------------------------------------------------------
        if confidence < self.min_confidence:
            return RoutingDecision(
                selected_tool=ToolIdentifier.CLARIFICATION_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason=(
                    f"Classification confidence ({confidence:.2f}) is below the operational "
                    f"routing threshold ({self.min_confidence:.2f})."
                ),
                requires_clarification=True,
                clarification_prompt=(
                    f"Your query was tentatively classified as {intent.value} but with low confidence ({confidence:.2f}). "
                    "Could you please rephrase or add more details about what you would like to analyze?"
                ),
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        # -----------------------------------------------------------------
        # 5. Standard Intent Mappings to Specialist Tools
        # -----------------------------------------------------------------
        if intent == QueryIntent.VQA:
            return RoutingDecision(
                selected_tool=ToolIdentifier.VQA_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason="Single-image visual question answering and scene attribute analysis requested.",
                requires_clarification=False,
                clarification_prompt=None,
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        if intent == QueryIntent.GROUNDING:
            targets_str = ", ".join(structured_query.target_objects) if structured_query.target_objects else "features"
            return RoutingDecision(
                selected_tool=ToolIdentifier.GROUNDING_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason=f"Spatial entity localization and bounding-box detection requested for: {targets_str}.",
                requires_clarification=False,
                clarification_prompt=None,
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        if intent == QueryIntent.CHANGE_DETECTION:
            time_str = structured_query.time_range or "two temporal observations"
            return RoutingDecision(
                selected_tool=ToolIdentifier.CHANGE_DETECTION_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason=f"Bi-temporal change analysis requested for period: {time_str}.",
                requires_clarification=False,
                clarification_prompt=None,
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        if intent == QueryIntent.COMPARISON:
            comp_type = structured_query.comparison.comparison_type if structured_query.comparison else "general"
            modality = structured_query.modality_hint or "multimodal"
            return RoutingDecision(
                selected_tool=ToolIdentifier.COMPARISON_TOOL,
                intent=intent,
                routing_confidence=confidence,
                reason=f"Multimodal comparison analysis requested (type: {comp_type}, modality: {modality}).",
                requires_clarification=False,
                clarification_prompt=None,
                parameters=self._build_parameters(structured_query),
                structured_query=structured_query,
            )

        # Ultimate fallback
        return RoutingDecision(
            selected_tool=ToolIdentifier.CLARIFICATION_TOOL,
            intent=intent,
            routing_confidence=0.50,
            reason=f"Unrecognized query intent '{intent}'. Routed to clarification handler.",
            requires_clarification=True,
            clarification_prompt="Unable to map query to an analytical tool. Please rephrase your query.",
            parameters=self._build_parameters(structured_query),
            structured_query=structured_query,
        )

    def _build_parameters(self, sq: StructuredQuery) -> Dict[str, Any]:
        """Extract and preserve downstream tool parameters from StructuredQuery."""
        params: Dict[str, Any] = {
            "query": sq.original_query,
            "intent": sq.intent.value,
            "target_objects": sq.target_objects,
            "modality_hint": sq.modality_hint,
        }
        if sq.time_range:
            params["time_range"] = sq.time_range
        if sq.temporal and sq.temporal.has_temporal:
            params["temporal"] = sq.temporal.model_dump()
        if sq.spatial and sq.spatial.has_spatial:
            params["spatial"] = sq.spatial.model_dump()
        if sq.comparison and sq.comparison.is_comparison:
            params["comparison"] = sq.comparison.model_dump()
        if sq.extracted_attributes:
            params["attributes"] = sq.extracted_attributes
        return params


# Default singleton router instance
default_agent_router = AgentRouter()
