"""SatQuery Agent Orchestrator Foundation.

This module establishes the architectural entry point for the SatQuery agent pipeline.
Execution flow across hackathon blocks:

    /api/query
        ↓
    Agent Orchestrator
        ↓
    Query Understanding  <-- [Block 2 Active]
        ↓
    Agent Router         <-- [Block 3 Active]
        ↓
    Tools (VQA, Grounding, Change Detection, Geospatial Ops)
        ↓
    Evidence Validation
        ↓
    Response
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from backend.agents.query_understanding.service import (
    QueryUnderstandingService,
    default_query_understanding,
)
from backend.agents.router.agent_router import AgentRouter, default_agent_router
from backend.agents.router.base import BaseRouter
from backend.schemas.query import ExecutionTraceStep


class AgentOrchestrator:
    """
    Orchestrates the SatQuery agent pipeline.

    Block 3 executes:
      1. Query Understanding: Analyzes intent, entities, temporal & spatial context.
      2. Agent Router: Evaluates structured intelligence and maps to specialist tools
         or clarification handlers.
    """

    def __init__(
        self,
        query_understanding: Optional[QueryUnderstandingService] = None,
        router: Optional[BaseRouter] = None,
    ):
        self.query_understanding = query_understanding or default_query_understanding
        self.router = router or default_agent_router

    async def process_query(self, query: str) -> Dict[str, Any]:
        """
        Process an incoming natural-language query through the agent pipeline.

        Args:
            query: Validated user query string.

        Returns:
            Dictionary matching QueryResponse data structure.
        """
        # Step 1: Query Understanding
        t0 = time.perf_counter()
        structured = await self.query_understanding.analyze(query)
        duration_step1 = (time.perf_counter() - t0) * 1000

        target_summary = (
            f"Targets: {', '.join(structured.target_objects)}"
            if structured.target_objects
            else "No specific targets identified"
        )
        step1_detail = (
            f"Classified intent as {structured.intent.value} with confidence {structured.confidence:.2f}. "
            f"{target_summary}."
        )
        if structured.is_ambiguous and structured.ambiguity_reason:
            step1_detail += f" Note: {structured.ambiguity_reason}"

        trace_step1 = ExecutionTraceStep(
            step=1,
            action="Query Understanding",
            detail=step1_detail,
            duration_ms=round(duration_step1, 2),
            status="completed",
        )

        # Step 2: Agent Routing
        t1 = time.perf_counter()
        routing_decision = await self.router.route(structured)
        duration_step2 = (time.perf_counter() - t1) * 1000

        step2_detail = (
            f"{structured.intent.value} query routed to {routing_decision.selected_tool.value}. "
            f"Reason: {routing_decision.reason}"
        )
        trace_step2 = ExecutionTraceStep(
            step=2,
            action="Agent Routing",
            detail=step2_detail,
            duration_ms=round(duration_step2, 2),
            status="completed",
        )

        warnings = []
        if structured.is_ambiguous and structured.ambiguity_reason:
            warnings.append(structured.ambiguity_reason)
        if routing_decision.requires_clarification and routing_decision.clarification_prompt:
            warnings.append(routing_decision.clarification_prompt)

        return {
            "received_query": query,
            "status": "received",
            "task": structured.intent.value,
            "confidence": routing_decision.routing_confidence,
            "execution_trace": [trace_step1, trace_step2],
            "warnings": warnings,
            "structured_query": structured,
            "routing_decision": routing_decision,
        }


# Singleton orchestrator instance for dependency injection
orchestrator = AgentOrchestrator()
