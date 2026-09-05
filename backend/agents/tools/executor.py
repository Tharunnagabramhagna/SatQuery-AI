"""Tool Execution Engine for SatQuery AI.

Orchestrates the dispatch of RoutingDecisions to specialist tools registered in ToolRegistry.
Provides structured error handling, execution logging, and parameter marshaling.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from backend.agents.tools.registry import ToolNotFoundError, ToolRegistry, default_tool_registry
from backend.schemas.query_understanding import StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

logger = logging.getLogger("satquery.tools.executor")


class ToolExecutor:
    """
    Executes specialist tools selected by the Agent Router.
    Ensures safe error containment and uniform output modeling.
    """

    def __init__(self, registry: Optional[ToolRegistry] = None):
        self.registry = registry or default_tool_registry

    async def execute(
        self,
        routing_decision: RoutingDecision,
        structured_query: Optional[StructuredQuery] = None,
    ) -> ToolResult:
        """
        Resolve and execute the tool designated by the routing decision.

        Args:
            routing_decision: Routing decision from the Agent Router.
            structured_query: Optional structured query context.

        Returns:
            ToolResult containing status, output, warnings, or error details.
        """
        tool_id = routing_decision.selected_tool

        # 1. Resolve tool from registry
        try:
            tool = self.registry.get(tool_id)
        except ToolNotFoundError as exc:
            logger.error("Failed to resolve tool '%s': %s", tool_id, exc)
            return ToolResult(
                tool_name=tool_id.value if isinstance(tool_id, ToolIdentifier) else str(tool_id),
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={"error_type": "tool_not_found"},
                warnings=[str(exc)],
            )
        except Exception as exc:
            logger.exception("Unexpected error resolving tool '%s': %s", tool_id, exc)
            return ToolResult(
                tool_name=str(tool_id),
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={"error_type": "tool_resolution_error"},
                warnings=[f"Failed to resolve tool '{tool_id}': {str(exc)}"],
            )

        # 2. Build parameter payload
        params: Dict[str, Any] = dict(routing_decision.parameters or {})
        if routing_decision.clarification_prompt:
            params["clarification_prompt"] = routing_decision.clarification_prompt
        params["routing_confidence"] = routing_decision.routing_confidence
        params["reason"] = routing_decision.reason
        if structured_query:
            params["structured_query"] = structured_query.model_dump()

        # 3. Execute tool through BaseTool interface
        try:
            logger.info("Executing tool '%s' (%s)", tool.name, tool.tool_id.value)
            result = await tool.execute(params)
            return result
        except Exception as exc:
            logger.exception("Exception occurred during execution of tool '%s': %s", tool.name, exc)
            return ToolResult(
                tool_name=tool.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={"error_type": "tool_execution_exception", "tool_name": tool.name},
                warnings=[f"Execution of tool '{tool.name}' failed with error: {str(exc)}"],
            )


# Default singleton executor instance
default_tool_executor = ToolExecutor()
