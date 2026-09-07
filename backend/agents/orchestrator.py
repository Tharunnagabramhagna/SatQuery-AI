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
    Tool Executor        <-- [Block 4 Active]
        ↓
    Specialist Tool (Stub / Real Model)
        ↓
    Tool Result
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
from backend.agents.tools.executor import ToolExecutor, default_tool_executor
from backend.schemas.query import ExecutionTraceStep


class AgentOrchestrator:
    """
    Orchestrates the SatQuery agent pipeline.

    Block 4 executes:
      1. Query Understanding: Analyzes intent, entities, temporal & spatial context.
      2. Agent Router: Evaluates structured intelligence and maps to specialist tools
         or clarification handlers.
      3. Tool Executor: Dispatches the routing decision to the selected specialist
         tool or clarification handler through the BaseTool contract.
    """

    def __init__(
        self,
        query_understanding: Optional[QueryUnderstandingService] = None,
        router: Optional[BaseRouter] = None,
        tool_executor: Optional[ToolExecutor] = None,
    ):
        self.query_understanding = query_understanding or default_query_understanding
        self.router = router or default_agent_router
        self.tool_executor = tool_executor or default_tool_executor

    async def process_query(
        self,
        query: str,
        before_image: Optional[str] = None,
        after_image: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process an incoming natural-language query through the agent pipeline.

        Args:
            query: Validated user query string.
            before_image: Optional path or base64 data for baseline (T1) image.
            after_image: Optional path or base64 data for follow-up (T2) image.
            parameters: Optional dictionary of tool-specific parameters.

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

        # Step 3: Tool Execution
        t2 = time.perf_counter()
        extra_params: Dict[str, Any] = dict(parameters or {})
        if before_image:
            extra_params["before_image"] = before_image
        if after_image:
            extra_params["after_image"] = after_image

        tool_result = await self.tool_executor.execute(
            routing_decision=routing_decision,
            structured_query=structured,
            extra_params=extra_params,
        )
        duration_step3 = (time.perf_counter() - t2) * 1000

        step3_status = "completed" if tool_result.status != "error" else "failed"
        if tool_result.status == "not_implemented":
            step3_detail = (
                f"Invoked {tool_result.tool_name} (status: not_implemented). "
                f"Specialist capability stub executed without mock fabrication."
            )
        elif tool_result.status == "input_required":
            step3_detail = (
                f"Invoked {tool_result.tool_name} (status: input_required). "
                f"{tool_result.answer or 'Missing required image inputs.'}"
            )
        elif tool_result.status == "clarification_needed":
            step3_detail = (
                f"Invoked {tool_result.tool_name} (status: clarification_needed). "
                f"Prompting user for clarification."
            )
        elif tool_result.status == "error":
            step3_detail = (
                f"Tool execution failed for {tool_result.tool_name}: "
                f"{', '.join(tool_result.warnings)}"
            )
        else:
            step3_detail = f"Executed {tool_result.tool_name} successfully (status: {tool_result.status})."

        trace_step3 = ExecutionTraceStep(
            step=3,
            action="Tool Execution",
            detail=step3_detail,
            duration_ms=round(duration_step3, 2),
            status=step3_status,
        )

        # Merge warnings
        warnings = []
        if structured.is_ambiguous and structured.ambiguity_reason:
            warnings.append(structured.ambiguity_reason)
        if routing_decision.requires_clarification and routing_decision.clarification_prompt:
            warnings.append(routing_decision.clarification_prompt)
        for w in tool_result.warnings:
            if w not in warnings:
                warnings.append(w)

        return {
            "received_query": query,
            "status": "received",
            "task": structured.intent.value,
            "confidence": routing_decision.routing_confidence,
            "answer": tool_result.answer,
            "evidence": tool_result.evidence,
            "visualizations": tool_result.visualizations,
            "execution_trace": [trace_step1, trace_step2, trace_step3],
            "warnings": warnings,
            "structured_query": structured,
            "routing_decision": routing_decision,
            "tool_result": tool_result,
        }


# Singleton orchestrator instance for dependency injection
orchestrator = AgentOrchestrator()
