"""Tool Registry for SatQuery AI.

Maintains the catalog of registered execution tools, enabling dynamic lookup
and pluggable tool implementations (e.g. substituting placeholders with real models).
"""

from typing import Dict, Union

from backend.agents.tools.base import (
    BaseTool,
    ChangeDetectionTool,
    ClarificationTool,
    ComparisonTool,
    GroundingTool,
    VQATool,
)
from backend.schemas.router import ToolIdentifier


class ToolNotFoundError(Exception):
    """Raised when a requested tool identifier is not registered in the ToolRegistry."""
    pass


class ToolRegistry:
    """
    Central registry for SatQuery specialist tools.
    Provides registration, resolution, and inspection capabilities.
    """

    def __init__(self):
        self._tools: Dict[ToolIdentifier, BaseTool] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        """Register the standard set of placeholder tools."""
        self.register(VQATool())
        self.register(GroundingTool())
        self.register(ChangeDetectionTool())
        self.register(ComparisonTool())
        self.register(ClarificationTool())

    def register(self, tool: BaseTool) -> None:
        """Register or replace a tool implementation."""
        self._tools[tool.tool_id] = tool

    def get(self, tool_id: Union[ToolIdentifier, str]) -> BaseTool:
        """
        Retrieve a registered tool by identifier.

        Args:
            tool_id: ToolIdentifier enum or corresponding string name.

        Returns:
            BaseTool implementation.

        Raises:
            ToolNotFoundError: If tool_id is not registered.
        """
        if isinstance(tool_id, str):
            try:
                tool_id = ToolIdentifier(tool_id)
            except ValueError:
                raise ToolNotFoundError(f"Unknown tool identifier '{tool_id}'.") from None

        if tool_id not in self._tools:
            raise ToolNotFoundError(f"Tool '{tool_id.value}' is not registered in ToolRegistry.")

        return self._tools[tool_id]

    def has_tool(self, tool_id: Union[ToolIdentifier, str]) -> bool:
        """Check if a tool identifier is registered."""
        try:
            if isinstance(tool_id, str):
                tool_id = ToolIdentifier(tool_id)
            return tool_id in self._tools
        except ValueError:
            return False

    def list_tools(self) -> Dict[str, str]:
        """Return a dictionary of registered tool names and descriptions."""
        return {tool_id.value: tool.name for tool_id, tool in self._tools.items()}


# Default singleton registry instance
default_tool_registry = ToolRegistry()
