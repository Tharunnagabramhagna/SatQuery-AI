"""Tool abstraction and placeholder implementations for SatQuery AI.

Establishes the BaseTool execution contract and safe placeholder implementations
that report NOT_IMPLEMENTED rather than generating fabricated AI outputs.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus


class BaseTool(ABC):
    """Abstract base class for all SatQuery execution tools."""

    tool_id: ToolIdentifier
    name: str
    description: str

    @abstractmethod
    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """
        Execute tool operation and return structured ToolResult.

        Args:
            params: Dictionary containing parameters passed by ToolExecutor.

        Returns:
            Structured ToolResult adhering to SatQuery output schema.
        """
        pass


from backend.agents.tools.vqa.tool import VQATool


from backend.agents.tools.grounding.tool import GroundingTool

from backend.agents.tools.change_detection.tool import ChangeDetectionTool


class ComparisonTool(BaseTool):
    """Safe architectural placeholder for Optical-SAR Comparison tool."""

    tool_id = ToolIdentifier.COMPARISON_TOOL
    name = "Multimodal Comparison Tool"
    description = "Compares multimodal optical and SAR imagery or dual-sensor acquisitions."

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        return ToolResult(
            tool_name=self.tool_id.value,
            status=ToolStatus.NOT_IMPLEMENTED.value,
            answer=None,
            confidence=None,
            evidence=[],
            visualizations=[],
            metadata={"capability": "COMPARISON", "params": params},
            warnings=[
                "Multimodal Comparison specialist capability is registered as an architectural placeholder. "
                "Cross-sensor inference is not yet connected."
            ],
        )


class ClarificationTool(BaseTool):
    """Clarification and fallback handler."""

    tool_id = ToolIdentifier.CLARIFICATION_TOOL
    name = "Clarification and Fallback Handler"
    description = "Prompts the user for clarification when queries are out-of-domain, low-confidence, or ambiguous."

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        prompt = (
            params.get("clarification_prompt")
            or "Please clarify your satellite analysis request with more specific remote sensing instructions."
        )
        return ToolResult(
            tool_name=self.tool_id.value,
            status=ToolStatus.CLARIFICATION_NEEDED.value,
            answer=prompt,
            confidence=params.get("routing_confidence"),
            evidence=[],
            visualizations=[],
            metadata={
                "capability": "CLARIFICATION",
                "reason": params.get("reason"),
            },
            warnings=[],
        )
