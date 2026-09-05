"""SatQuery Agent Orchestrator Foundation.

This module establishes the architectural entry point for the SatQuery agent pipeline.
Execution flow across hackathon blocks:

    /api/query
        ↓
    Agent Orchestrator
        ↓
    Query Understanding  <-- [Block 2 Active]
        ↓
    Router               <-- [Future Block 3]
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
from backend.schemas.query import ExecutionTraceStep


class AgentOrchestrator:
    """
    Orchestrates the SatQuery agent pipeline.

    Block 2 integrates the Query Understanding layer, producing typed
    intent and structured entity information while maintaining full backward
    compatibility with Block 1 endpoints and response models.
    """

    def __init__(
        self,
        query_understanding: Optional[QueryUnderstandingService] = None,
    ):
        self.query_understanding = query_understanding or default_query_understanding

    async def process_query(self, query: str) -> Dict[str, Any]:
        """
        Process an incoming natural-language query through the agent pipeline.

        Args:
            query: Validated user query string.

        Returns:
            Dictionary matching QueryResponse data structure.
        """
        t0 = time.perf_counter()

        # Step 1: Query Understanding
        structured = await self.query_understanding.analyze(query)
        duration_ms = (time.perf_counter() - t0) * 1000

        target_summary = (
            f"Targets: {', '.join(structured.target_objects)}"
            if structured.target_objects
            else "No specific targets identified"
        )
        step_detail = (
            f"Classified intent as {structured.intent.value} with confidence {structured.confidence:.2f}. "
            f"{target_summary}."
        )
        if structured.is_ambiguous and structured.ambiguity_reason:
            step_detail += f" Note: {structured.ambiguity_reason}"

        trace_step = ExecutionTraceStep(
            step=1,
            action="Query Understanding",
            detail=step_detail,
            duration_ms=round(duration_ms, 2),
            status="completed",
        )

        warnings = []
        if structured.is_ambiguous and structured.ambiguity_reason:
            warnings.append(structured.ambiguity_reason)

        return {
            "received_query": query,
            "status": "received",
            "task": structured.intent.value,
            "confidence": structured.confidence,
            "execution_trace": [trace_step],
            "warnings": warnings,
            "structured_query": structured,
        }


# Singleton orchestrator instance for dependency injection
orchestrator = AgentOrchestrator()
