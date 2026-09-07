"""Gemini-powered Visual Grounding and Object Localization Specialist Tool for SatQuery AI.

Integrates multimodal Gemini 3.6 Flash inference to detect and localize target entities
in satellite imagery, returning strictly validated normalized bounding boxes [ymin, xmin, ymax, xmax]
and genuine bounding-box image overlay visualizations without fabricating coordinates.
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

from PIL import Image, ImageDraw
from pydantic import ValidationError

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.config import settings
from backend.agents.tools.base import BaseTool
from backend.agents.tools.grounding.models import (
    GroundingObject,
    GroundingOutputSchema,
    ImageValidationError,
    validate_and_normalize_bbox,
)
from backend.schemas.common import AnalysisEvidence, AnalysisVisualization
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

logger = logging.getLogger("satquery.tools.grounding")

GROUNDING_SYSTEM_INSTRUCTION = (
    "You are the Visual Grounding specialist for SatQuery, an Earth Observation satellite-image analysis system. "
    "Your objective is to identify and visually localize the specific target objects or features requested by the user.\n\n"
    "Strict Operational Rules:\n"
    "1. Focus on Target: Ground ONLY the specific object category or features requested in the user query. Do not localize unrequested objects.\n"
    "2. Bounding Box Format: Every bounding box MUST be a 4-element list of normalized floats in EXACT format: [ymin, xmin, ymax, xmax].\n"
    "3. Normalized Coordinates: All coordinate values must be between 0.0 and 1.0 relative to image boundaries, where (0,0) is top-left and (1,1) is bottom-right.\n"
    "4. Valid Geometry: Ensure 0.0 <= ymin < ymax <= 1.0 and 0.0 <= xmin < xmax <= 1.0.\n"
    "5. Grounding Accuracy: Place boxes tightly around discernible instances of the target. Do not invent objects or hallucinate locations.\n"
    "6. Uncertainty: If an object cannot be clearly localized due to low resolution, blur, or occlusions, omit it or lower its confidence.\n"
    "7. No Geodata Fabrication: Never generate geographic latitude/longitude, GPS coordinates, or real-world metric distances/acreage. Coordinates are strictly normalized 2D image pixel-space."
)

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


class GroundingTool(BaseTool):
    """
    Multimodal Visual Grounding specialist tool powered by Google Gemini (gemini-3.6-flash).
    Localizes target objects and structures with strictly validated normalized 2D bounding boxes.
    """

    tool_id = ToolIdentifier.GROUNDING_TOOL
    name = "Visual Grounding Tool"
    description = (
        "Detects, localizes, and bounds target entities in satellite imagery with "
        "normalized bounding boxes [ymin, xmin, ymax, xmax] using multimodal Gemini 3.6 Flash."
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
        self.timeout = timeout if timeout is not None else 30.0

        if client is not None:
            self._client = client
        elif self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as exc:
                logger.warning("Failed to initialize Gemini client for GroundingTool: %s", type(exc).__name__)
                self._client = None
        else:
            self._client = None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """
        Execute Visual Grounding analysis on a supplied satellite image.

        Args:
            params: Dictionary containing parameters passed by ToolExecutor:
                - before_image, after_image, or image: Path, base64 string, or PIL Image.
                - query: Natural language question directing visual localization.
                - structured_query: Optional StructuredQuery context dict with target_objects.

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
            or "Locate the target objects in this satellite image."
        )
        target_objects = params.get("structured_query", {}).get("target_objects", [])

        # 1. Validate image presence
        if not image_input:
            logger.info("GroundingTool invoked without image input")
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="Visual Grounding requires a satellite image. Please supply an image input.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "GROUNDING",
                    "required_inputs": ["image"],
                    "missing_inputs": ["image"],
                },
                warnings=["Visual Grounding requires a satellite image."],
            )

        # 2. Decode and validate image
        try:
            pil_img, image_bytes, mime_type = self._load_and_validate_image(image_input)
        except ImageValidationError as exc:
            logger.warning("Image validation failed in GroundingTool: %s", exc)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "GROUNDING",
                    "error_type": "image_validation_error",
                },
                warnings=[str(exc)],
            )

        # 3. Verify Gemini client and API key
        if not self.api_key or self._client is None:
            logger.warning("Gemini API key is not configured for GroundingTool")
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "GROUNDING",
                    "error_type": "missing_api_key",
                    "provider": "gemini",
                    "model": self.model,
                },
                warnings=["Gemini API key is not configured. Visual Grounding unavailable."],
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
                    "capability": "GROUNDING",
                    "error_type": error_type or "inference_failure",
                    "provider": "gemini",
                    "model": self.model,
                },
                warnings=[error_msg or "Visual Grounding analysis failed."],
            )

        # 5. Server-side bounding box validation and normalization
        valid_objects: List[GroundingObject] = []
        discarded_count = 0
        for raw_obj in output.objects:
            validated_bbox = validate_and_normalize_bbox(raw_obj.bbox)
            if validated_bbox is not None:
                valid_objects.append(
                    GroundingObject(
                        label=raw_obj.label,
                        confidence=round(float(raw_obj.confidence), 4),
                        bbox=validated_bbox,
                    )
                )
            else:
                discarded_count += 1
                logger.warning(
                    "Discarded invalid bounding box from Grounding model: label=%s, raw_bbox=%s",
                    raw_obj.label,
                    raw_obj.bbox,
                )

        warnings_list = list(output.warnings)
        if discarded_count > 0:
            warnings_list.append(
                f"{discarded_count} bounding box prediction(s) were discarded due to invalid coordinate geometry."
            )

        # 6. Build evidence items
        evidence: List[AnalysisEvidence] = [
            AnalysisEvidence(
                type="localization_summary",
                description=(
                    f"Localized {len(valid_objects)} instance(s) of target feature(s) "
                    f"in normalized 2D image coordinate space."
                ),
                source=f"Gemini Grounding ({self.model})",
            )
        ]
        for idx, obj in enumerate(valid_objects[:10], 1):
            evidence.append(
                AnalysisEvidence(
                    type="bounding_box",
                    description=(
                        f"Instance #{idx} ({obj.label}): normalized bbox {obj.bbox} "
                        f"(confidence: {obj.confidence:.2f})."
                    ),
                    source=f"Gemini Grounding ({self.model})",
                )
            )

        # 7. Generate genuine image overlay and structured visualization items
        visualizations: List[AnalysisVisualization] = []
        if valid_objects:
            try:
                overlay_b64 = self._generate_overlay(pil_img, valid_objects)
                visualizations.append(
                    AnalysisVisualization(
                        type="mask",
                        data=overlay_b64,
                        label="Visual Grounding Bounding Box Overlay (PNG)",
                    )
                )
            except Exception as exc:
                logger.warning("Failed to render grounding overlay visualization: %s", exc)

            for idx, obj in enumerate(valid_objects, 1):
                visualizations.append(
                    AnalysisVisualization(
                        type="bounding_box",
                        data={
                            "object_id": idx,
                            "label": obj.label,
                            "confidence": obj.confidence,
                            "box_2d": obj.bbox,
                            "coordinate_format": "normalized [ymin, xmin, ymax, xmax]",
                        },
                        label=f"Localized {obj.label} #{idx} (conf: {obj.confidence:.2f})",
                    )
                )

        metadata = {
            "capability": "GROUNDING",
            "provider": "gemini",
            "model": self.model,
            "target_objects": target_objects,
            "localized_objects_count": len(valid_objects),
            "discarded_invalid_boxes_count": discarded_count,
            "coordinate_format": "normalized [ymin, xmin, ymax, xmax]",
            "image_dimensions": f"{pil_img.width}x{pil_img.height}",
            "image_format": pil_img.format or "RGB",
        }

        return ToolResult(
            tool_name=self.tool_id.value,
            status=ToolStatus.SUCCESS.value,
            answer=output.answer,
            confidence=round(float(output.confidence), 4),
            evidence=evidence,
            visualizations=visualizations,
            metadata=metadata,
            warnings=warnings_list,
        )

    def _generate_overlay(
        self, pil_image: Image.Image, objects: List[GroundingObject]
    ) -> str:
        """
        Draw genuine bounding boxes and label tags directly onto an image copy.
        Returns base64-encoded PNG image string.
        """
        width, height = pil_image.size
        overlay = pil_image.copy().convert("RGB")
        draw = ImageDraw.Draw(overlay)

        for obj in objects:
            ymin, xmin, ymax, xmax = obj.bbox
            x0 = int(xmin * width)
            y0 = int(ymin * height)
            x1 = int(xmax * width)
            y1 = int(ymax * height)

            # Draw outer rectangle
            draw.rectangle([x0, y0, x1, y1], outline="#00FFCC", width=2)
            # Label tag
            label_text = f"{obj.label} ({obj.confidence:.2f})"
            text_y = max(0, y0 - 12)
            draw.rectangle([x0, text_y, x0 + len(label_text) * 7, text_y + 11], fill="#000000")
            draw.text((x0 + 2, text_y), label_text, fill="#00FFCC")

        buffer = io.BytesIO()
        overlay.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")

    def _load_and_validate_image(
        self, image_input: Any
    ) -> Tuple[Image.Image, bytes, str]:
        """
        Load, validate, and convert image to format and bytes suitable for Gemini multimodal input.
        Supports PIL Image, local file paths (.jpg, .jpeg, .png, .tif, .tiff), base64 data URIs/strings.
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
    ) -> Tuple[Optional[GroundingOutputSchema], Optional[str], Optional[str]]:
        """
        Execute Gemini multimodal API call with schema enforcement, timeout, and failure containment.
        """
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GroundingOutputSchema,
            system_instruction=GROUNDING_SYSTEM_INSTRUCTION,
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

                if hasattr(response, "parsed") and isinstance(response.parsed, GroundingOutputSchema):
                    return response.parsed, None, None

                raw_text = getattr(response, "text", None) or ""
                validated = GroundingOutputSchema.model_validate_json(raw_text)
                return validated, None, None

            except asyncio.TimeoutError:
                last_error_type = "timeout"
                last_error_msg = f"Gemini Grounding request timed out after {self.timeout}s."
                logger.warning("Gemini Grounding request timed out on attempt %d", attempt + 1)
            except genai_errors.APIError as exc:
                status_code = getattr(exc, "code", None)
                if status_code in (401, 403):
                    last_error_type = "authentication_error"
                    last_error_msg = "Gemini API authentication failed."
                    logger.warning("Gemini Grounding authentication error (HTTP %s)", status_code)
                    break  # Do not retry auth errors
                elif status_code == 429:
                    last_error_type = "rate_limit_exceeded"
                    last_error_msg = "Gemini API rate limit exceeded."
                    logger.warning("Gemini Grounding rate limit exceeded (HTTP 429)")
                    break  # Do not retry rate limit
                else:
                    last_error_type = "api_error"
                    last_error_msg = f"Gemini API error (HTTP {status_code})."
                    logger.warning("Gemini Grounding API error on attempt %d: %s", attempt + 1, type(exc).__name__)
            except ValidationError as exc:
                last_error_type = "invalid_structured_output"
                last_error_msg = f"Gemini Grounding output failed schema validation: {exc}"
                logger.warning("Gemini Grounding validation error: %s", exc)
                break  # Do not retry schema validation error
            except Exception as exc:
                last_error_type = "unexpected_error"
                last_error_msg = f"Unexpected error during Grounding analysis: {exc}"
                logger.warning("Unexpected error during Gemini Grounding on attempt %d: %s", attempt + 1, exc)
                break

        return None, last_error_type, last_error_msg
