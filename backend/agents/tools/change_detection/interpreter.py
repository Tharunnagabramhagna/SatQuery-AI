"""Semantic Change Interpretation Layer (Stage 2) for SatQuery AI.

Consumes Stage 1 deterministic change detection evidence (pixel deltas, binary mask,
cluster bounding boxes, co-registration score) and uses multimodal Gemini 3.6 Flash
to classify change categories and directional trends without fabricating measurements.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.config import settings
from backend.schemas.common import AnalysisEvidence

logger = logging.getLogger("satquery.tools.change_detection.interpreter")

SEMANTIC_CHANGE_SYSTEM_INSTRUCTION = (
    "You are the Semantic Change Interpretation specialist for SatQuery, an Earth Observation satellite-image "
    "analysis system. You are provided with two co-registered satellite images (Before/T1 and After/T2) and "
    "deterministic Stage 1 pixel-difference bounding boxes where physical changes were localized.\n\n"
    "Strict Operational Rules:\n"
    "1. Grounding: Focus your interpretation strictly on the visual differences within the localized change cluster regions.\n"
    "2. Categorization: Classify the semantic nature of the change into one or more of: "
    "['built-up', 'vegetation', 'agricultural_land', 'water', 'roads_infrastructure', 'bare_land', 'unknown'].\n"
    "3. Zero Metric Fabrication: NEVER convert the generic pixel-change percentage into a built-up area percentage "
    "(e.g., do NOT claim 'built-up area increased by 15%' simply because 15% of pixels changed). "
    "Never invent hectares, acres, square kilometers, or real-world distances without verified ground sampling distance.\n"
    "4. Qualitative Direction: When asked directional questions (e.g., 'Has the built-up area increased, decreased, or remained unchanged?'), "
    "answer 'increased', 'decreased', or 'remained_unchanged' ONLY if discernible visual evidence supports that conclusion.\n"
    "5. Uncertainty / Insufficient Evidence: If the visual changes in the detected regions are ambiguous, blurry, "
    "consistent with illumination shifts/seasonality, or cannot support a confident semantic conclusion, "
    "you MUST conclude with: 'insufficient_evidence' and state 'Insufficient evidence to determine built-up change'.\n"
    "6. Confidence Calibration: Assign confidence reflecting visual certainty (0.0 to 1.0). If changes are ambiguous or subtle, confidence must be <= 0.50.\n"
    "7. Schema Compliance: Return strictly valid JSON adhering to the requested schema."
)


class SemanticInterpretationOutput(BaseModel):
    """Structured output schema for Stage 2 semantic change interpretation."""

    summary: str = Field(..., description="Comprehensive semantic change summary answering user query.")
    change_categories: List[str] = Field(default_factory=list, description="Identified semantic categories.")
    directional_conclusion: str = Field(
        default="insufficient_evidence",
        description="'increased' | 'decreased' | 'remained_unchanged' | 'insufficient_evidence'",
    )
    interpreted_details: List[str] = Field(default_factory=list, description="Specific visual change observations.")
    uncertainties: List[str] = Field(default_factory=list, description="Visual/spatial caveats and limitations.")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="Calibrated confidence score.")


class SemanticChangeInterpreter:
    """
    Stage 2 interpreter that derives semantic change categories from Stage 1 deterministic evidence.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[genai.Client] = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-3.6-flash"
        self.timeout = timeout if timeout is not None else 20.0

        if client is not None:
            self._client = client
        elif self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as exc:
                logger.warning("Failed to initialize Gemini client for SemanticChangeInterpreter: %s", type(exc).__name__)
                self._client = None
        else:
            self._client = None

    async def interpret_change(
        self,
        query: str,
        bytes_before: bytes,
        bytes_after: bytes,
        mime_type: str,
        stage1_metrics: Dict[str, Any],
        cluster_boxes: List[List[float]],
        coregistration_score: float,
        coregistration_status: str,
    ) -> Tuple[Optional[SemanticInterpretationOutput], Optional[str], Optional[str]]:
        """
        Execute Stage 2 semantic change interpretation using Gemini 3.6 Flash multimodal.

        Returns:
            Tuple of (output, error_type, error_message)
        """
        if self._client is None:
            return None, "missing_api_key", "Gemini API key is not configured for semantic change interpretation."

        cluster_summary = ""
        if cluster_boxes:
            box_strs = [f"Cluster #{i+1}: [ymin={b[0]:.2f}, xmin={b[1]:.2f}, ymax={b[2]:.2f}, xmax={b[3]:.2f}]" for i, b in enumerate(cluster_boxes[:5])]
            cluster_summary = f"Stage 1 detected primary difference clusters at normalized coordinates:\n" + "\n".join(box_strs)
        else:
            cluster_summary = "Stage 1 detected diffuse pixel alterations across the scene without concentrated clusters."

        prompt_text = (
            f"User Query: {query}\n\n"
            f"Deterministic Stage 1 Evidence:\n"
            f"- Changed Pixels: {stage1_metrics.get('changed_pixels', 0)} of {stage1_metrics.get('total_pixels', 0)} ({stage1_metrics.get('change_percentage', 0.0)}%)\n"
            f"- Alignment Quality Score: {coregistration_score:.2f} ({coregistration_status})\n"
            f"- {cluster_summary}\n\n"
            "Task Instructions:\n"
            "1. Inspect the two satellite images (Image 1 = Before/T1, Image 2 = After/T2) specifically at the detected change locations.\n"
            "2. Identify what physical or land-cover changes occurred (e.g. built-up development, vegetation clearing, water level change, or seasonal variation).\n"
            "3. If the query asks whether built-up area increased, decreased, or remained unchanged:\n"
            "   - If new buildings, roads, or roofs are visible in the after image within the change clusters, state that built-up development appears to have increased.\n"
            "   - If no clear structural changes are discernible or changes represent vegetation/lighting/seasonality, state that evidence is insufficient to determine built-up change.\n"
            "   - NEVER convert the pixel-change percentage into a built-up percentage.\n"
            "   - NEVER report area in hectares without explicit scale indicators.\n"
            "4. Return strictly valid JSON conforming to the schema."
        )

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=bytes_before, mime_type=mime_type),
                    types.Part.from_bytes(data=bytes_after, mime_type=mime_type),
                    types.Part.from_text(text=prompt_text),
                ],
            )
        ]

        config = types.GenerateContentConfig(
            system_instruction=SEMANTIC_CHANGE_SYSTEM_INSTRUCTION,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=SemanticInterpretationOutput,
        )

        try:
            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self._client.models.generate_content(
                        model=self.model,
                        contents=contents,
                        config=config,
                    ),
                ),
                timeout=self.timeout,
            )

            if not response or not response.text:
                return None, "empty_response", "Gemini returned an empty semantic interpretation."

            # Parse structured JSON response
            text = response.text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)

            data = json.loads(text)
            parsed = SemanticInterpretationOutput(**data)
            return parsed, None, None

        except asyncio.TimeoutError:
            logger.warning("Gemini semantic change interpretation timed out after %.1fs", self.timeout)
            return None, "timeout", f"Semantic change interpretation timed out after {self.timeout}s."
        except genai_errors.ClientError as exc:
            code = getattr(exc, "code", None)
            if code == 429 or "resource_exhausted" in str(exc).lower() or "quota" in str(exc).lower():
                logger.warning("Gemini rate limit exceeded in SemanticChangeInterpreter (HTTP 429)")
                return None, "rate_limit_exceeded", "Gemini API rate limit exceeded."
            logger.warning("Gemini ClientError in SemanticChangeInterpreter: %s", exc)
            return None, "client_error", f"Gemini client error: {exc}"
        except Exception as exc:
            logger.warning("Unexpected exception in SemanticChangeInterpreter: %s", exc)
            return None, "interpreter_error", f"Semantic interpretation failed: {exc}"
