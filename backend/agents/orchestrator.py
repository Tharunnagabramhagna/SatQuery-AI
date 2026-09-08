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
from typing import Any, Dict, List, Optional

from backend.agents.query_understanding.service import (
    QueryUnderstandingService,
    default_query_understanding,
)
from backend.agents.router.agent_router import AgentRouter, default_agent_router
from backend.agents.router.base import BaseRouter
from backend.agents.tools.executor import ToolExecutor, default_tool_executor
from backend.schemas.query import ExecutionSummary, ExecutionTraceStep
from backend.schemas.query_understanding import QueryIntent
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.validation import InputValidator


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
        before_image_modality: Optional[str] = None,
        after_image_modality: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process an incoming natural-language query through the agent pipeline.

        Args:
            query: Validated user query string.
            before_image: Optional path or base64 data for baseline (T1) image.
            after_image: Optional path or base64 data for follow-up (T2) image.
            parameters: Optional dictionary of tool-specific parameters.
            before_image_modality: Optional modality for baseline image ('optical' | 'sar' | 'unknown').
            after_image_modality: Optional modality for follow-up image ('optical' | 'sar' | 'unknown').

        Returns:
            Dictionary matching QueryResponse data structure.
        """
        # Step 0: Input & Modality Validation
        validation_summary = InputValidator.validate_inputs(
            before_image=before_image,
            after_image=after_image,
            before_modality=before_image_modality,
            after_modality=after_image_modality,
        )

        # Step 1: Query Understanding
        t0 = time.perf_counter()
        structured = await self.query_understanding.analyze(query)
        duration_step1 = (time.perf_counter() - t0) * 1000

        target_summary = (
            f"Targets: {', '.join(structured.target_objects)}"
            if structured.target_objects
            else "No specific targets identified"
        )
        provider = structured.extracted_attributes.get("provider", "rule_based")
        if provider == "gemini":
            model = structured.extracted_attributes.get("model", "gemini-3.6-flash")
            provider_tag = f" [provider: gemini, model: {model}]"
        elif structured.extracted_attributes.get("fallback_reason"):
            reason = structured.extracted_attributes.get("fallback_reason")
            provider_tag = f" [provider: rule_based, fallback_reason: {reason}]"
        else:
            provider_tag = " [provider: rule_based]"

        step1_detail = (
            f"Classified intent as {structured.intent.value} with confidence {structured.confidence:.2f}{provider_tag}. "
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

        # Context-aware disambiguation:
        # 1. If 2 images are provided (before & after), resolve to CHANGE_DETECTION_TOOL
        hint_cap = (parameters or {}).get("hint_capability")
        if (before_image and after_image) or hint_cap == "change_detection":
            if routing_decision.requires_clarification or routing_decision.selected_tool == ToolIdentifier.CLARIFICATION_TOOL:
                routing_decision = RoutingDecision(
                    selected_tool=ToolIdentifier.CHANGE_DETECTION_TOOL,
                    intent=QueryIntent.CHANGE_DETECTION,
                    routing_confidence=0.95,
                    reason="Bi-temporal image pair provided; executing full change detection analysis.",
                    requires_clarification=False,
                    parameters={"target_objects": structured.target_objects, "temporal": {"is_bi_temporal": True}},
                    structured_query=structured,
                )
        # 2. If single image is provided with grounding intent or hint, resolve to GROUNDING_TOOL
        elif before_image and (hint_cap == "grounding" or "detect" in query.lower() or "locate" in query.lower()):
            if routing_decision.requires_clarification or routing_decision.selected_tool == ToolIdentifier.CLARIFICATION_TOOL:
                routing_decision = RoutingDecision(
                    selected_tool=ToolIdentifier.GROUNDING_TOOL,
                    intent=QueryIntent.GROUNDING,
                    routing_confidence=0.92,
                    reason="Single satellite image provided with visual grounding context.",
                    requires_clarification=False,
                    parameters={"target_objects": structured.target_objects},
                    structured_query=structured,
                )

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
        extra_params["query"] = query
        if before_image:
            extra_params["before_image"] = before_image
        if after_image:
            extra_params["after_image"] = after_image
        if before_image_modality:
            extra_params["before_image_modality"] = before_image_modality
        if after_image_modality:
            extra_params["after_image_modality"] = after_image_modality

        tool_result = await self.tool_executor.execute(
            routing_decision=routing_decision,
            structured_query=structured,
            extra_params=extra_params,
        )
        duration_step3 = (time.perf_counter() - t2) * 1000

        provider = tool_result.metadata.get("provider")
        model = tool_result.metadata.get("model")
        provider_tag = f" [provider: {provider}, model: {model}]" if provider and model else (f" [provider: {provider}]" if provider else "")

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
                f"Tool execution failed for {tool_result.tool_name}{provider_tag}: "
                f"{', '.join(tool_result.warnings)}"
            )
        else:
            step3_detail = f"Executed {tool_result.tool_name} successfully (status: {tool_result.status}){provider_tag}."

        trace_step3 = ExecutionTraceStep(
            step=3,
            action="Tool Execution",
            detail=step3_detail,
            duration_ms=round(duration_step3, 2),
            status=step3_status,
        )

        # Merge warnings
        warnings = []
        for vw in validation_summary.warnings:
            if vw not in warnings:
                warnings.append(vw)
        if structured.is_ambiguous and structured.ambiguity_reason:
            warnings.append(structured.ambiguity_reason)
        if routing_decision.requires_clarification and routing_decision.clarification_prompt:
            warnings.append(routing_decision.clarification_prompt)
        for w in tool_result.warnings:
            if w not in warnings:
                warnings.append(w)

        # Determine top-level response confidence
        # Prioritize specialist tool confidence when the tool completed successfully with a meaningful value.
        if tool_result.status in ("success", "completed"):
            if tool_result.confidence is not None and isinstance(tool_result.confidence, (int, float)):
                final_confidence = float(tool_result.confidence)
            else:
                final_confidence = routing_decision.routing_confidence
        elif tool_result.status == "error":
            final_confidence = 0.0
        else:
            # For input_required, clarification_needed, or placeholder tools,
            # preserve query-understanding routing confidence when tool confidence is None
            final_confidence = (
                float(tool_result.confidence)
                if (tool_result.confidence is not None and isinstance(tool_result.confidence, (int, float)))
                else routing_decision.routing_confidence
            )

        # Build auditable execution summary for SIH compliance
        models_invoked: List[str] = []
        qu_model = structured.extracted_attributes.get("model")
        if qu_model and qu_model not in models_invoked:
            models_invoked.append(qu_model)
        tool_model = tool_result.metadata.get("model")
        if tool_model and tool_model not in models_invoked:
            models_invoked.append(tool_model)
        if not models_invoked and provider:
            models_invoked.append(provider)

        execution_summary = ExecutionSummary(
            task=structured.intent.value,
            models=models_invoked,
            tools=[tool_result.tool_name],
            input_summary=validation_summary.to_dict(),
            parameters=extra_params,
            evidence=tool_result.evidence,
            confidence=final_confidence,
            warnings=warnings,
            provider_info={
                "query_understanding_provider": structured.extracted_attributes.get("provider", "rule_based"),
                "tool_provider": tool_result.metadata.get("provider", "unknown"),
                "fallback_used": tool_result.metadata.get("fallback", False),
                "fallback_reason": tool_result.metadata.get("fallback_reason"),
            },
        )

        return {
            "received_query": query,
            "status": "received",
            "task": structured.intent.value,
            "confidence": final_confidence,
            "answer": tool_result.answer,
            "evidence": tool_result.evidence,
            "visualizations": tool_result.visualizations,
            "execution_trace": [trace_step1, trace_step2, trace_step3],
            "execution_summary": execution_summary,
            "warnings": warnings,
            "structured_query": structured,
            "routing_decision": routing_decision,
            "tool_result": tool_result,
        }


# Singleton orchestrator instance for dependency injection
orchestrator = AgentOrchestrator()
