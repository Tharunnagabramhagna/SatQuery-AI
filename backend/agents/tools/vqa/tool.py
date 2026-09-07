"""Gemini-powered Visual Question Answering (VQA) Specialist Tool for SatQuery AI.

Integrates real multimodal Gemini 3.6 Flash inference to answer natural language
questions regarding satellite imagery, land-use patterns, and observable features.
Replaces architectural placeholder with grounded remote-sensing vision capabilities.
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image
from pydantic import ValidationError

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.config import settings
from backend.agents.tools.base import BaseTool
from backend.agents.tools.vqa.models import ImageValidationError, VQAOutputSchema
from backend.schemas.common import AnalysisEvidence
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

logger = logging.getLogger("satquery.tools.vqa")

VQA_SYSTEM_INSTRUCTION = (
    "You are the Visual Question Answering (VQA) specialist for SatQuery, an Earth Observation "
    "satellite-image analysis system. Your task is to analyze the provided satellite image and answer "
    "the user's visual question with high factual precision.\n\n"
    "Strict Operational Guidelines:\n"
    "1. Grounding: Answer ONLY based on visual features directly discernible in the supplied image.\n"
    "2. No Hallucination: Do NOT hallucinate objects, facilities, or infrastructure that are not visible.\n"
    "3. Uncertainty: Explicitly acknowledge visual uncertainty, low resolution, blurriness, or cloud/shadow occlusions.\n"
    "4. Evidence: In 'observations', list only directly observable visual features and structures.\n"
    "5. Precision: Do NOT invent geographic coordinates, exact acreage, or dimensions unless explicit scale indicators exist.\n"
    "6. Confidence: Calibrate confidence to reflect image quality and visual certainty (0.0 to 1.0). If the image is unclear or does not support a confident answer, assign a lower confidence (<0.60) and add cautionary warnings.\n"
    "7. Land Use: Categorize observable land use or land cover types (e.g. urban, agricultural, forested, water, airport, industrial)."
)

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


class VQATool(BaseTool):
    """
    Multimodal Visual Question Answering specialist tool powered by Google Gemini (gemini-3.6-flash).
    Answers natural language queries about visual features, land use, and objects in satellite imagery.
    """

    tool_id = ToolIdentifier.VQA_TOOL
    name = "Visual Question Answering Tool"
    description = (
        "Answers natural language questions about visual features, land-use patterns, "
        "and observable objects in satellite imagery using multimodal Gemini 3.6 Flash."
    )

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[genai.Client] = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-3.6-flash"
        self.timeout = timeout or settings.GEMINI_TIMEOUT_SECONDS or 15.0

        if client is not None:
            self._client = client
        elif self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as exc:
                logger.warning("Failed to initialize Gemini client for VQATool: %s", type(exc).__name__)
                self._client = None
        else:
            self._client = None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """
        Execute Visual Question Answering analysis on a supplied satellite image.

        Args:
            params: Dictionary containing parameters passed by ToolExecutor:
                - before_image, after_image, or image: Path, base64 string, or PIL Image.
                - query: Natural language question directing visual analysis.
                - structured_query: Optional StructuredQuery context dict.

        Returns:
            Structured ToolResult adhering to SatQuery output schema.
        """
        image_input = (
            params.get("before_image")
            or params.get("after_image")
            or params.get("image")
        )
        query = (
            params.get("query")
            or params.get("structured_query", {}).get("original_query")
            or "Describe this satellite scene and identify the land use."
        )

        # 1. Validate image presence
        if not image_input:
            logger.info("VQATool invoked without image input")
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="Visual Question Answering requires a satellite image. Please supply an image input.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "VQA",
                    "required_inputs": ["image"],
                    "missing_inputs": ["image"],
                },
                warnings=["Visual Question Answering requires a satellite image."],
            )

        # 2. Decode and validate image
        try:
            pil_img, image_bytes, mime_type = self._load_and_validate_image(image_input)
        except ImageValidationError as exc:
            logger.warning("Image validation failed in VQATool: %s", exc)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "VQA",
                    "error_type": "image_validation_error",
                },
                warnings=[str(exc)],
            )

        # 3. Verify Gemini client and API key
        if not self.api_key or self._client is None:
            logger.warning("Gemini API key is not configured for VQATool")
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "VQA",
                    "error_type": "missing_api_key",
                    "provider": "gemini",
                    "model": self.model,
                },
                warnings=["Gemini API key is not configured. Visual Question Answering unavailable."],
            )

        # 4. Invoke multimodal Gemini inference with bounded retry and error containment
        output, error_type, error_msg = await self._call_gemini_multimodal(
            query=query,
            image_bytes=image_bytes,
            mime_type=mime_type,
        )

        if output is None:
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "VQA",
                    "error_type": error_type or "inference_failure",
                    "provider": "gemini",
                    "model": self.model,
                },
                warnings=[error_msg or "Visual Question Answering analysis failed."],
            )

        # 5. Build grounded evidence items
        evidence: List[AnalysisEvidence] = []
        for obs in output.observations:
            evidence.append(
                AnalysisEvidence(
                    type="visual_observation",
                    description=obs,
                    source=f"Gemini VQA ({self.model})",
                )
            )
        if output.detected_objects:
            evidence.append(
                AnalysisEvidence(
                    type="detected_objects",
                    description=f"Identified object categories: {', '.join(output.detected_objects)}.",
                    source=f"Gemini VQA ({self.model})",
                )
            )
        if output.land_use:
            evidence.append(
                AnalysisEvidence(
                    type="land_use",
                    description=f"Classified land-use patterns: {', '.join(output.land_use)}.",
                    source=f"Gemini VQA ({self.model})",
                )
            )

        metadata = {
            "capability": "VQA",
            "provider": "gemini",
            "model": self.model,
            "detected_objects": output.detected_objects,
            "land_use": output.land_use,
            "observations": output.observations,
            "image_dimensions": f"{pil_img.width}x{pil_img.height}",
            "image_format": pil_img.format or "RGB",
        }

        # Zero fabricated visualizations (bounding boxes, masks, coordinates)
        return ToolResult(
            tool_name=self.tool_id.value,
            status=ToolStatus.SUCCESS.value,
            answer=output.answer,
            confidence=round(float(output.confidence), 4),
            evidence=evidence,
            visualizations=[],
            metadata=metadata,
            warnings=output.warnings,
        )

    def _load_and_validate_image(
        self, image_input: Any
    ) -> Tuple[Image.Image, bytes, str]:
        """
        Load, validate, and convert image to format and bytes suitable for Gemini multimodal input.

        Supports:
            - PIL.Image.Image
            - Local filesystem paths (.jpg, .jpeg, .png, .tif, .tiff)
            - Base64 data URIs or base64 strings

        Returns:
            Tuple of (PIL.Image.Image in RGB, image_bytes, mime_type).

        Raises:
            ImageValidationError: If image cannot be read, decoded, or format is unsupported.
        """
        if isinstance(image_input, Image.Image):
            img = image_input.convert("RGB")
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=95)
            return img, buffer.getvalue(), "image/jpeg"

        if not isinstance(image_input, (str, Path)):
            raise ImageValidationError(f"Unsupported image input type: {type(image_input).__name__}")

        image_str = str(image_input).strip()
        if not image_str:
            raise ImageValidationError("Image path or input data string is empty.")

        # 1. Base64 data URI or raw base64 string
        if image_str.startswith("data:image/") or re.match(r"^[A-Za-z0-9+/=]{40,}$", image_str):
            cleaned = image_str.split(",", 1)[1] if "," in image_str else image_str
            try:
                raw_bytes = base64.b64decode(cleaned)
                img = Image.open(io.BytesIO(raw_bytes))
                img.load()
                rgb_img = img.convert("RGB")
                buffer = io.BytesIO()
                rgb_img.save(buffer, format="JPEG", quality=95)
                return rgb_img, buffer.getvalue(), "image/jpeg"
            except Exception as exc:
                raise ImageValidationError(f"Failed to decode base64 image data: {exc}") from exc

        # 2. Local filesystem path
        file_path = Path(image_str)
        if not file_path.is_file():
            raise ImageValidationError(f"Image file not found at path: '{image_str}'")

        ext = file_path.suffix.lower()
        if ext not in SUPPORTED_IMAGE_EXTENSIONS:
            raise ImageValidationError(
                f"Unsupported image extension '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_IMAGE_EXTENSIONS))}"
            )

        try:
            img = Image.open(file_path)
            img.load()
            rgb_img = img.convert("RGB")

            # For TIFF or non-JPEG/PNG formats, serialize to JPEG bytes for Gemini compatibility
            if ext in (".tif", ".tiff"):
                buffer = io.BytesIO()
                rgb_img.save(buffer, format="JPEG", quality=95)
                return rgb_img, buffer.getvalue(), "image/jpeg"
            elif ext == ".png":
                buffer = io.BytesIO()
                rgb_img.save(buffer, format="PNG")
                return rgb_img, buffer.getvalue(), "image/png"
            else:
                # Direct JPEG reading
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                return rgb_img, file_bytes, "image/jpeg"

        except Exception as exc:
            raise ImageValidationError(f"Failed to open image file '{image_str}': {exc}") from exc

    async def _call_gemini_multimodal(
        self,
        query: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> Tuple[Optional[VQAOutputSchema], Optional[str], Optional[str]]:
        """
        Execute Gemini multimodal API call with schema enforcement, timeout, and failure containment.

        Returns:
            Tuple of (VQAOutputSchema or None, error_type or None, error_message or None).
        """
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=VQAOutputSchema,
            system_instruction=VQA_SYSTEM_INSTRUCTION,
            temperature=0.0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        last_error_type: Optional[str] = None
        last_error_msg: Optional[str] = None

        # At most 1 controlled retry for transient timeouts
        for attempt in range(2):
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=self.model,
                        contents=[image_part, query],
                        config=config,
                    ),
                    timeout=self.timeout,
                )

                if hasattr(response, "parsed") and isinstance(response.parsed, VQAOutputSchema):
                    return response.parsed, None, None

                raw_text = getattr(response, "text", None) or ""
                validated = VQAOutputSchema.model_validate_json(raw_text)
                return validated, None, None

            except asyncio.TimeoutError:
                last_error_type = "timeout"
                last_error_msg = f"Gemini VQA request timed out after {self.timeout}s."
                logger.warning("Gemini VQA request timed out on attempt %d", attempt + 1)
            except genai_errors.APIError as exc:
                status_code = getattr(exc, "code", None)
                if status_code in (401, 403):
                    last_error_type = "authentication_error"
                    last_error_msg = "Gemini API authentication failed."
                    logger.warning("Gemini VQA authentication error (HTTP %s)", status_code)
                    break  # Do not retry auth errors
                elif status_code == 429:
                    last_error_type = "rate_limit_exceeded"
                    last_error_msg = "Gemini API rate limit exceeded."
                    logger.warning("Gemini VQA rate limit exceeded (HTTP 429)")
                    break  # Do not retry rate limit
                else:
                    last_error_type = "api_error"
                    last_error_msg = f"Gemini API error (HTTP {status_code})."
                    logger.warning("Gemini VQA API error on attempt %d: %s", attempt + 1, type(exc).__name__)
            except ValidationError as exc:
                last_error_type = "invalid_structured_output"
                last_error_msg = f"Gemini VQA output failed schema validation: {exc}"
                logger.warning("Gemini VQA validation error: %s", exc)
                break  # Do not retry schema validation error
            except Exception as exc:
                last_error_type = "unexpected_error"
                last_error_msg = f"Unexpected error during VQA analysis: {exc}"
                logger.warning("Unexpected error during Gemini VQA on attempt %d: %s", attempt + 1, exc)
                break

        return None, last_error_type, last_error_msg
