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

class VQATool(BaseTool):
    """Visual Question Answering specialist tool using local BLIP."""

    tool_id = ToolIdentifier.VQA_TOOL
    name = "Visual Question Answering Tool"
    description = "Answers questions about visible content in satellite imagery."

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """Answer a question using the local BLIP VQA model."""

        image_input = (
            params.get("before_image")
            or params.get("image")
            or params.get("image_path")
        )

        query = (
            params.get("query")
            or params.get("question")
            or params.get("structured_query", {}).get("original_query")
        )

        if not image_input:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="A satellite image is required for Visual Question Answering.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={"capability": "VQA", "provider": "Local BLIP"},
                warnings=["VQA requires an image input."],
            )

        if not query:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="A visual question is required for Visual Question Answering.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={"capability": "VQA", "provider": "Local BLIP"},
                warnings=["VQA requires a question."],
            )

        # Local BLIP is the primary provider.
        # This requires no OpenAI credits or API calls.
        try:
            from backend.agents.tools.local_vqa import get_local_vqa

            local_vqa = get_local_vqa()
            answer = local_vqa.answer(image_input, query)

            if answer:
                return ToolResult(
                    tool_name=self.tool_id.value,
                    status=ToolStatus.COMPLETED.value,
                    answer=answer,
                    confidence=0.65,
                    evidence=[],
                    visualizations=[],
                    metadata={
                        "capability": "VQA",
                        "provider": "Local BLIP",
                        "model": "Salesforce/blip-vqa-base",
                        "fallback_mode": "local_primary",
                    },
                    warnings=[],
                )

            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "VQA",
                    "provider": "Local BLIP",
                    "model": "Salesforce/blip-vqa-base",
                },
                warnings=["Local BLIP returned an empty VQA answer."],
            )

        except Exception as exc:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "VQA",
                    "provider": "Local BLIP",
                    "model": "Salesforce/blip-vqa-base",
                },
                warnings=[f"Local VQA inference failed: {str(exc)}"],
            )


class GroundingTool(BaseTool):
    """Grounding specialist using local VQA for object presence/localization."""

    tool_id = ToolIdentifier.GROUNDING_TOOL
    name = "Visual Grounding Tool"
    description = "Identifies requested objects in satellite imagery."

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        image_input = (
            params.get("before_image")
            or params.get("image")
            or params.get("image_path")
        )

        query = (
            params.get("query")
            or params.get("question")
            or params.get("structured_query", {}).get("original_query")
        )

        if not image_input:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="A satellite image is required for visual grounding.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={"capability": "GROUNDING", "provider": "Local BLIP"},
                warnings=["Grounding requires an image input."],
            )

        if not query:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="An object or feature to locate is required.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={"capability": "GROUNDING", "provider": "Local BLIP"},
                warnings=["Grounding requires a target object or feature."],
            )

        try:
            from backend.agents.tools.local_vqa import get_local_vqa

            vqa = get_local_vqa()

            # Ask the local model whether the requested target is visible.
            answer = vqa.answer(
                image_input,
                f"Is the object or feature requested in this question visible? "
                f"Answer briefly based only on the image: {query}",
            )

            if not answer:
                return ToolResult(
                    tool_name=self.tool_id.value,
                    status=ToolStatus.ERROR.value,
                    answer=None,
                    confidence=None,
                    evidence=[],
                    visualizations=[],
                    metadata={
                        "capability": "GROUNDING",
                        "provider": "Local BLIP",
                    },
                    warnings=["Local grounding inference returned no answer."],
                )

            # IMPORTANT: BLIP does not provide pixel coordinates.
            # Never fabricate a bounding box or mask.
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.COMPLETED.value,
                answer=f"Grounding target assessment: {answer}",
                confidence=0.60,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "GROUNDING",
                    "provider": "Local BLIP",
                    "model": "Salesforce/blip-vqa-base",
                    "localization": "semantic_only",
                    "bounding_boxes": False,
                },
                warnings=[
                    "Semantic grounding is available; precise pixel bounding boxes "
                    "require a dedicated object-detection/localization model."
                ],
            )

        except Exception as exc:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "GROUNDING",
                    "provider": "Local BLIP",
                },
                warnings=[f"Local grounding inference failed: {str(exc)}"],
            )


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
