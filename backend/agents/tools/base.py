"""Tool abstraction and placeholder definitions for SatQuery AI.

Establishes the interface for downstream specialist execution tools without
loading heavy machine learning models prematurely.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from backend.schemas.router import ToolIdentifier


class BaseTool(ABC):
    """Abstract base class for all SatQuery tools."""

    tool_id: ToolIdentifier
    name: str
    description: str

    @abstractmethod
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute tool operation.
        In Block 3, this is a clean architectural contract.
        Concrete specialist models will be implemented in subsequent blocks.
        """
        pass


class VQATool(BaseTool):
    """Placeholder for Visual Question Answering tool."""

    tool_id = ToolIdentifier.VQA_TOOL
    name = "Visual Question Answering Tool"
    description = "Answers natural language questions about features and properties in satellite imagery."

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "placeholder", "tool": self.tool_id.value, "params": params}


class GroundingTool(BaseTool):
    """Placeholder for Text-Guided Grounding / Object Detection tool."""

    tool_id = ToolIdentifier.GROUNDING_TOOL
    name = "Visual Grounding Tool"
    description = "Detects and localizes target entities with bounding box coordinates."

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "placeholder", "tool": self.tool_id.value, "params": params}


class ChangeDetectionTool(BaseTool):
    """Placeholder for Bi-Temporal Change Detection tool."""

    tool_id = ToolIdentifier.CHANGE_DETECTION_TOOL
    name = "Bi-Temporal Change Detection Tool"
    description = "Analyzes changes, construction, or land cover transitions across two observation periods."

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "placeholder", "tool": self.tool_id.value, "params": params}


class ComparisonTool(BaseTool):
    """Placeholder for Optical-SAR / Cross-sensor Comparison tool."""

    tool_id = ToolIdentifier.COMPARISON_TOOL
    name = "Multimodal Comparison Tool"
    description = "Compares multimodal optical and SAR imagery or dual-sensor acquisitions."

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "placeholder", "tool": self.tool_id.value, "params": params}


class ClarificationTool(BaseTool):
    """Placeholder for Clarification / Fallback handler."""

    tool_id = ToolIdentifier.CLARIFICATION_TOOL
    name = "Clarification and Fallback Handler"
    description = "Prompts the user for clarification when queries are out-of-domain, low-confidence, or ambiguous."

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "clarification_needed", "tool": self.tool_id.value, "params": params}
