"""Gemini-powered Multimodal Comparison Specialist Tool for SatQuery AI.

Integrates real multimodal Gemini 3.6 Flash inference to perform semantic, visual,
and cross-modal comparisons between two satellite images (Optical+Optical, SAR+SAR,
Optical+SAR, or Unknown modalities).
Replaces architectural placeholder with grounded remote-sensing comparison capabilities.
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image
from pydantic import ValidationError

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.config import settings
from backend.agents.tools.base import BaseTool
from backend.agents.tools.comparison.models import ComparisonOutputSchema, ImageValidationError
from backend.schemas.common import AnalysisEvidence
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

logger = logging.getLogger("satquery.tools.comparison")

COMPARISON_SYSTEM_INSTRUCTION = (
    "You are the Multimodal Image Comparison specialist for SatQuery, an Earth Observation "
    "satellite-image analysis system. Your task is to perform rigorous semantic and visual "
    "comparison between two supplied satellite images (Image A and Image B) to answer the user's inquiry.\n\n"
    "Strict Operational Guidelines:\n"
    "1. Grounding: Base comparison strictly and solely on visual and structural features directly discernible in Image A and Image B.\n"
    "2. Modality Awareness: Respect the declared modalities of Image A and Image B (Optical, SAR, or Unknown). For Optical+SAR cross-modal comparisons, do NOT confuse sensor representation differences with physical scene change.\n"
    "3. Zero Fabrication: NEVER fabricate quantitative change percentages (e.g. 'increased by 24%'), exact area/hectares, exact object counts, or geographic coordinates unless verified scale/data is directly visible.\n"
    "4. Qualitative Precision: Use calibrated qualitative language (e.g. 'appears', 'likely', 'visually', 'suggests').\n"
    "5. Distinguish Similarities vs Differences: Clearly categorize findings into 'similarities' and 'differences'. In 'observations', list notable contextual features.\n"
    "6. Calibrate Confidence: Assign confidence (0.0 to 1.0) reflecting visual certainty, alignment, and clarity. Assign lower confidence (<0.60) and add cautionary warnings if imagery is ambiguous or difficult to compare.\n"
    "7. Schema Compliance: Return structured JSON conforming to ComparisonOutputSchema."
)

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
VALID_MODALITIES = {"optical", "sar", "unknown"}
ELIGIBLE_FALLBACK_ERRORS = {
    "rate_limit_exceeded",
    "timeout",
    "api_error",
    "provider_unavailable",
    "missing_api_key",
}


class ComparisonTool(BaseTool):
    """
    Multimodal Image Comparison specialist tool powered primarily by Google Gemini (gemini-3.6-flash),
    with optional local fallback to Qwen3-VL via Ollama when Gemini experiences provider/runtime availability failures.
    Compares two satellite images (Optical, SAR, or Optical+SAR) to extract semantic similarities
    and differences without fabricating quantitative metrics.
    """

    tool_id = ToolIdentifier.COMPARISON_TOOL
    name = "Multimodal Comparison Tool"
    description = (
        "Performs semantic and visual comparison between two satellite images (Optical, SAR, "
        "or Optical+SAR) using multimodal Gemini 3.6 Flash."
    )

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[genai.Client] = None,
        fallback_adapter: Optional[Any] = None,
        enable_fallback: Optional[bool] = None,
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
                logger.warning("Failed to initialize Gemini client for ComparisonTool: %s", type(exc).__name__)
                self._client = None
        else:
            self._client = None

        # Optional local Qwen fallback adapter (lazy initialization)
        if fallback_adapter is not None:
            self.fallback_adapter = fallback_adapter
        elif enable_fallback is True:
            from backend.services.ollama import get_default_qwen_adapter
            self.fallback_adapter = get_default_qwen_adapter()
        else:
            self.fallback_adapter = None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """
        Execute Multimodal Comparison analysis on two supplied satellite images.

        Args:
            params: Dictionary containing parameters passed by ToolExecutor:
                - before_image, image_a, or image1: Path, base64 string, or PIL Image for Image A.
                - after_image, image_b, or image2: Path, base64 string, or PIL Image for Image B.
                - query: Natural language question directing visual comparison.
                - image_a_modality / before_image_modality: Optional 'optical' | 'sar' | 'unknown'.
                - image_b_modality / after_image_modality: Optional 'optical' | 'sar' | 'unknown'.
                - structured_query: Optional StructuredQuery context dict.

        Returns:
            Structured ToolResult adhering to SatQuery output schema.
        """
        # 1. Resolve image inputs
        image_a_input = (
            params.get("before_image")
            or params.get("image_a")
            or params.get("image1")
        )
        image_b_input = (
            params.get("after_image")
            or params.get("image_b")
            or params.get("image2")
        )

        # Also support images list if provided
        if (not image_a_input or not image_b_input) and isinstance(params.get("images"), (list, tuple)) and len(params["images"]) >= 2:
            image_a_input = image_a_input or params["images"][0]
            image_b_input = image_b_input or params["images"][1]

        query = (
            params.get("query")
            or params.get("structured_query", {}).get("original_query")
            or "Compare these two satellite images, identifying major similarities and differences."
        )

        # 2. Validate presence of both images
        if not image_a_input or not image_b_input:
            missing = []
            if not image_a_input:
                missing.append("image_a (or before_image)")
            if not image_b_input:
                missing.append("image_b (or after_image)")

            logger.info("ComparisonTool invoked without required imagery: missing %s", missing)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="Multimodal comparison requires two satellite images. Please supply both Image A (baseline) and Image B (comparison).",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "COMPARISON",
                    "required_inputs": ["before_image", "after_image"],
                    "missing_inputs": missing,
                },
                warnings=["Comparison requires two satellite images (Image A and Image B)."],
            )

        # 3. Resolve modality metadata without guessing
        modality_a = self._resolve_modality(
            params.get("image_a_modality")
            or params.get("before_image_modality")
            or params.get("before_modality")
            or (params.get("modalities", {}) if isinstance(params.get("modalities"), dict) else {}).get("image_a")
        )
        modality_b = self._resolve_modality(
            params.get("image_b_modality")
            or params.get("after_image_modality")
            or params.get("after_modality")
            or (params.get("modalities", {}) if isinstance(params.get("modalities"), dict) else {}).get("image_b")
        )

        # 4. Decode and validate both images
        try:
            pil_img_a, bytes_a, mime_a = self._load_and_validate_image(image_a_input, label="Image A")
        except ImageValidationError as exc:
            logger.warning("Image A validation failed in ComparisonTool: %s", exc)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "COMPARISON",
                    "error_type": "image_validation_error",
                    "target_image": "image_a",
                },
                warnings=[str(exc)],
            )

        try:
            pil_img_b, bytes_b, mime_b = self._load_and_validate_image(image_b_input, label="Image B")
        except ImageValidationError as exc:
            logger.warning("Image B validation failed in ComparisonTool: %s", exc)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "COMPARISON",
                    "error_type": "image_validation_error",
                    "target_image": "image_b",
                },
                warnings=[str(exc)],
            )

        # 5. Verify Gemini client and API key
        if not self.api_key or self._client is None:
            logger.warning("Gemini API key is not configured for ComparisonTool")
            if self.fallback_adapter is not None:
                logger.warning(
                    "Gemini API key not configured -> attempting Qwen fallback (%s)",
                    self.fallback_adapter.model,
                )
                qwen_output, qwen_error_type, qwen_error_msg = await self.fallback_adapter.compare(
                    query=query,
                    bytes_a=bytes_a,
                    mime_a=mime_a,
                    bytes_b=bytes_b,
                    mime_b=mime_b,
                    modality_a=modality_a,
                    modality_b=modality_b,
                )
                if qwen_output is not None:
                    logger.info("Qwen Comparison fallback succeeded (model: %s)", self.fallback_adapter.model)
                    return self._build_qwen_success_result(
                        output=qwen_output,
                        pil_img_a=pil_img_a,
                        pil_img_b=pil_img_b,
                        modality_a=modality_a,
                        modality_b=modality_b,
                        gemini_error_type="missing_api_key",
                    )
                else:
                    logger.error("Qwen Comparison fallback failed (%s: %s)", qwen_error_type, qwen_error_msg)
                    return ToolResult(
                        tool_name=self.tool_id.value,
                        status=ToolStatus.ERROR.value,
                        answer=None,
                        confidence=0.0,
                        evidence=[],
                        visualizations=[],
                        metadata={
                            "capability": "COMPARISON",
                            "error_type": "missing_api_key",
                            "fallback_attempted": True,
                            "fallback_error": qwen_error_type,
                            "provider": "gemini",
                            "model": self.model,
                        },
                        warnings=[
                            "Gemini API key is not configured. Multimodal comparison unavailable.",
                            f"Local Qwen fallback failed: {qwen_error_msg}",
                        ],
                    )

            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "COMPARISON",
                    "error_type": "missing_api_key",
                    "provider": "gemini",
                    "model": self.model,
                },
                warnings=["Gemini API key is not configured. Multimodal comparison unavailable."],
            )

        # 6. Invoke multimodal Gemini inference
        output, error_type, error_msg = await self._call_gemini_multimodal(
            query=query,
            bytes_a=bytes_a,
            mime_a=mime_a,
            bytes_b=bytes_b,
            mime_b=mime_b,
            modality_a=modality_a,
            modality_b=modality_b,
        )

        if output is None:
            # Check if eligible for Qwen fallback
            if self.fallback_adapter is not None and error_type in ELIGIBLE_FALLBACK_ERRORS:
                logger.warning(
                    "Gemini Comparison failed (%s: %s) -> attempting Qwen fallback (model: %s)",
                    error_type,
                    error_msg,
                    self.fallback_adapter.model,
                )
                qwen_output, qwen_error_type, qwen_error_msg = await self.fallback_adapter.compare(
                    query=query,
                    bytes_a=bytes_a,
                    mime_a=mime_a,
                    bytes_b=bytes_b,
                    mime_b=mime_b,
                    modality_a=modality_a,
                    modality_b=modality_b,
                )
                if qwen_output is not None:
                    logger.info("Qwen Comparison fallback succeeded (model: %s)", self.fallback_adapter.model)
                    return self._build_qwen_success_result(
                        output=qwen_output,
                        pil_img_a=pil_img_a,
                        pil_img_b=pil_img_b,
                        modality_a=modality_a,
                        modality_b=modality_b,
                        gemini_error_type=error_type,
                    )
                else:
                    logger.error("Qwen Comparison fallback failed (%s: %s)", qwen_error_type, qwen_error_msg)
                    return ToolResult(
                        tool_name=self.tool_id.value,
                        status=ToolStatus.ERROR.value,
                        answer=None,
                        confidence=0.0,
                        evidence=[],
                        visualizations=[],
                        metadata={
                            "capability": "COMPARISON",
                            "error_type": error_type or "inference_failure",
                            "fallback_attempted": True,
                            "fallback_error": qwen_error_type,
                            "provider": "gemini",
                            "model": self.model,
                        },
                        warnings=[
                            error_msg or "Multimodal comparison analysis failed.",
                            f"Local Qwen fallback failed: {qwen_error_msg}",
                        ],
                    )

            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "COMPARISON",
                    "error_type": error_type or "inference_failure",
                    "provider": "gemini",
                    "model": self.model,
                },
                warnings=[error_msg or "Multimodal comparison analysis failed."],
            )

        # 7. Build grounded evidence items
        evidence: List[AnalysisEvidence] = []
        for sim in output.similarities:
            evidence.append(
                AnalysisEvidence(
                    type="similarity",
                    description=sim,
                    source=f"Gemini Comparison ({self.model})",
                )
            )
        for diff in output.differences:
            evidence.append(
                AnalysisEvidence(
                    type="difference",
                    description=diff,
                    source=f"Gemini Comparison ({self.model})",
                )
            )
        for obs in output.observations:
            evidence.append(
                AnalysisEvidence(
                    type="visual_observation",
                    description=obs,
                    source=f"Gemini Comparison ({self.model})",
                )
            )

        is_cross_modal = (
            (modality_a == "optical" and modality_b == "sar")
            or (modality_a == "sar" and modality_b == "optical")
        )

        metadata = {
            "capability": "COMPARISON",
            "provider": "gemini",
            "model": self.model,
            "modality_a": modality_a,
            "modality_b": modality_b,
            "is_cross_modal": is_cross_modal,
            "similarities": output.similarities,
            "differences": output.differences,
            "observations": output.observations,
            "image_a_dimensions": f"{pil_img_a.width}x{pil_img_a.height}",
            "image_b_dimensions": f"{pil_img_b.width}x{pil_img_b.height}",
            "image_a_format": pil_img_a.format or "RGB",
            "image_b_format": pil_img_b.format or "RGB",
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

    def _build_qwen_success_result(
        self,
        output: ComparisonOutputSchema,
        pil_img_a: Image.Image,
        pil_img_b: Image.Image,
        modality_a: str,
        modality_b: str,
        gemini_error_type: Optional[str] = None,
    ) -> ToolResult:
        """Build compatible ToolResult from Qwen Comparison output adhering to standard schema."""
        evidence: List[AnalysisEvidence] = []
        for sim in output.similarities:
            evidence.append(
                AnalysisEvidence(
                    type="similarity",
                    description=sim,
                    source=f"Qwen Comparison ({self.fallback_adapter.model})",
                )
            )
        for diff in output.differences:
            evidence.append(
                AnalysisEvidence(
                    type="difference",
                    description=diff,
                    source=f"Qwen Comparison ({self.fallback_adapter.model})",
                )
            )
        for obs in output.observations:
            evidence.append(
                AnalysisEvidence(
                    type="visual_observation",
                    description=obs,
                    source=f"Qwen Comparison ({self.fallback_adapter.model})",
                )
            )

        is_cross_modal = (
            (modality_a == "optical" and modality_b == "sar")
            or (modality_a == "sar" and modality_b == "optical")
        )

        metadata = {
            "capability": "COMPARISON",
            "provider": "qwen",
            "model": self.fallback_adapter.model,
            "fallback": True,
            "fallback_reason": gemini_error_type,
            "modality_a": modality_a,
            "modality_b": modality_b,
            "is_cross_modal": is_cross_modal,
            "similarities": output.similarities,
            "differences": output.differences,
            "observations": output.observations,
            "image_a_dimensions": f"{pil_img_a.width}x{pil_img_a.height}",
            "image_b_dimensions": f"{pil_img_b.width}x{pil_img_b.height}",
            "image_a_format": pil_img_a.format or "RGB",
            "image_b_format": pil_img_b.format or "RGB",
        }

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

    def _resolve_modality(self, val: Any) -> str:
        """
        Normalize modality string strictly without heuristic guessing.
        Returns 'optical', 'sar', or 'unknown'.
        """
        if not val or not isinstance(val, str):
            return "unknown"
        cleaned = val.strip().lower()
        if cleaned in ("optical", "rgb", "visible"):
            return "optical"
        if cleaned in ("sar", "radar"):
            return "sar"
        return "unknown"

    def _load_and_validate_image(
        self, image_input: Any, label: str = "Image"
    ) -> Tuple[Image.Image, bytes, str]:
        """
        Load, validate, and convert image to format and bytes suitable for Gemini multimodal input.

        Supports:
            - PIL.Image.Image
            - Local filesystem paths (.jpg, .jpeg, .png, .tif, .tiff)
            - Base64 data URIs or raw base64 strings

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
            raise ImageValidationError(f"{label}: Unsupported image input type: {type(image_input).__name__}")

        image_str = str(image_input).strip()
        if not image_str:
            raise ImageValidationError(f"{label}: Image path or input data string is empty.")

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
                raise ImageValidationError(f"{label}: Failed to decode base64 image data: {exc}") from exc

        # 2. Local filesystem path
        file_path = Path(image_str)
        if not file_path.is_file():
            raise ImageValidationError(f"{label}: Image file not found at path: '{image_str}'")

        ext = file_path.suffix.lower()
        if ext not in SUPPORTED_IMAGE_EXTENSIONS:
            raise ImageValidationError(
                f"{label}: Unsupported image extension '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_IMAGE_EXTENSIONS))}"
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
            raise ImageValidationError(f"{label}: Failed to open image file '{image_str}': {exc}") from exc

    def _build_comparison_prompt(
        self,
        query: str,
        modality_a: str,
        modality_b: str,
    ) -> str:
        """
        Build modality-aware prompt guiding Gemini multimodal reasoning.
        """
        modality_header = (
            f"Modality Metadata:\n"
            f"- Image A declared modality: {modality_a.upper()}\n"
            f"- Image B declared modality: {modality_b.upper()}\n"
        )

        is_cross_modal = (
            (modality_a == "optical" and modality_b == "sar")
            or (modality_a == "sar" and modality_b == "optical")
        )

        if modality_a == "optical" and modality_b == "optical":
            modality_rules = (
                "Both images are Optical imagery. Focus reasoning on visible spectral, color, texture, "
                "vegetation, and structural features (e.g. built-up structures, roads, water bodies, "
                "agricultural patterns, and visible development)."
            )
        elif modality_a == "sar" and modality_b == "sar":
            modality_rules = (
                "Both images are SAR (Synthetic Aperture Radar) imagery. Focus reasoning on radar backscatter, "
                "surface roughness, texture variations, structural alignments, and dielectric signatures "
                "(e.g. double-bounce reflections from built structures, specular reflections from calm water, "
                "surface texture changes)."
            )
        elif is_cross_modal:
            modality_rules = (
                "CROSS-MODAL COMPARISON (Optical vs. SAR):\n"
                "- CRITICAL: Understand that Image A and Image B originate from fundamentally different sensing modalities.\n"
                "- Do NOT treat differences in color, brightness, tone, or visual texture between optical and SAR representations "
                "as evidence of physical scene change or temporal evolution.\n"
                "- Distinguish sensor/modality physics from genuine observable scene features.\n"
                "- Optical captures surface reflectance and visible colors; SAR captures radar backscatter, surface roughness, "
                "structural geometry, and dielectric properties.\n"
                "- Address the user's comparison question by synthesizing complementary observations from both modalities "
                "without drawing unsupported cross-modal quantitative conclusions or assuming direct pixel alignment.\n"
                "- Include an appropriate caveat in 'warnings' regarding sensor differences and cross-modal comparison limitations."
            )
        else:
            modality_rules = (
                "One or both image modalities are UNKNOWN/unspecified. Interpret the visual and structural features directly "
                "without guessing unverified sensor types or assuming specific imaging physics. "
                "Note visual or sensor ambiguities in 'warnings' if interpretation is constrained."
            )

        return (
            f"User Comparison Inquiry: {query}\n\n"
            f"{modality_header}\n"
            f"Modality Interpretation Rules:\n{modality_rules}\n\n"
            f"Comparison Instructions:\n"
            f"1. Image A is the first supplied image (Baseline/Reference).\n"
            f"2. Image B is the second supplied image (Comparison/Follow-up).\n"
            f"3. Focus specifically on aspects requested in the user's inquiry while providing a holistic comparison.\n"
            f"4. Clearly distinguish observable similarities from observable differences.\n"
            f"5. In 'observations', document notable context or land-cover conditions.\n"
            f"6. ZERO FABRICATION: Do NOT invent quantitative change percentages, hectare measurements, or object counts.\n"
            f"7. Use calibrated qualitative language (e.g. 'appears', 'likely', 'visually', 'suggests').\n"
            f"8. Assign an honest confidence score (0.0 to 1.0) and document caveats in 'warnings'."
        )

    async def _call_gemini_multimodal(
        self,
        query: str,
        bytes_a: bytes,
        mime_a: str,
        bytes_b: bytes,
        mime_b: str,
        modality_a: str,
        modality_b: str,
    ) -> Tuple[Optional[ComparisonOutputSchema], Optional[str], Optional[str]]:
        """
        Execute Gemini multimodal API call with schema enforcement, timeout, and failure containment.

        Returns:
            Tuple of (ComparisonOutputSchema or None, error_type or None, error_message or None).
        """
        part_a = types.Part.from_bytes(data=bytes_a, mime_type=mime_a)
        part_b = types.Part.from_bytes(data=bytes_b, mime_type=mime_b)
        prompt_text = self._build_comparison_prompt(query, modality_a, modality_b)

        contents = [
            "Input Image A (Baseline / Reference):",
            part_a,
            "Input Image B (Comparison / Follow-up):",
            part_b,
            prompt_text,
        ]

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ComparisonOutputSchema,
            system_instruction=COMPARISON_SYSTEM_INSTRUCTION,
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
                        contents=contents,
                        config=config,
                    ),
                    timeout=self.timeout,
                )

                if hasattr(response, "parsed") and isinstance(response.parsed, ComparisonOutputSchema):
                    return response.parsed, None, None

                raw_text = getattr(response, "text", None) or ""
                validated = ComparisonOutputSchema.model_validate_json(raw_text)
                return validated, None, None

            except asyncio.TimeoutError:
                last_error_type = "timeout"
                last_error_msg = f"Gemini comparison request timed out after {self.timeout}s."
                logger.warning("Gemini comparison request timed out on attempt %d", attempt + 1)
            except genai_errors.APIError as exc:
                status_code = getattr(exc, "code", None)
                if status_code in (401, 403):
                    last_error_type = "authentication_error"
                    last_error_msg = "Gemini API authentication failed."
                    logger.warning("Gemini comparison authentication error (HTTP %s)", status_code)
                    break  # Do not retry auth errors
                elif status_code == 429:
                    last_error_type = "rate_limit_exceeded"
                    last_error_msg = "Gemini API rate limit exceeded."
                    logger.warning("Gemini comparison rate limit exceeded (HTTP 429)")
                    break  # Do not retry rate limit
                else:
                    last_error_type = "api_error"
                    last_error_msg = f"Gemini API error (HTTP {status_code})."
                    logger.warning("Gemini comparison API error on attempt %d: %s", attempt + 1, type(exc).__name__)
            except ValidationError as exc:
                last_error_type = "invalid_structured_output"
                last_error_msg = f"Gemini comparison output failed schema validation: {exc}"
                logger.warning("Gemini comparison validation error: %s", exc)
                break  # Do not retry schema validation error
            except Exception as exc:
                last_error_type = "unexpected_error"
                last_error_msg = f"Unexpected error during comparison analysis: {exc}"
                logger.warning("Unexpected error during Gemini comparison on attempt %d: %s", attempt + 1, exc)
                break

        return None, last_error_type, last_error_msg
