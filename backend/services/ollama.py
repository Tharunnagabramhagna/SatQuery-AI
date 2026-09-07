"""Ollama service adapter for local Qwen3-VL fallback in SatQuery AI.

Provides an isolated, lazy, and optional fallback adapter communicating with a local
Ollama instance running Qwen3-VL (e.g. qwen-satquery) over HTTP via httpx.
Primary specialist inference remains Google Gemini; this adapter is invoked ONLY
upon eligible Gemini provider/runtime availability failures (HTTP 429, timeout, 503).

Grounding and Change Detection are strictly excluded from Qwen fallback.
"""

from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydantic import ValidationError

from backend.config import settings
from backend.agents.tools.vqa.models import VQAOutputSchema
from backend.agents.tools.comparison.models import ComparisonOutputSchema

logger = logging.getLogger("satquery.services.ollama")

VQA_QWEN_SYSTEM_PROMPT = (
    "You are an Earth Observation satellite imagery analyst. Your task is to analyze "
    "the supplied satellite image and answer the user question factually and concisely.\n\n"
    "Strict Guidelines:\n"
    "1. Base observations solely on visible features directly discernible in the image.\n"
    "2. Do NOT invent or hallucinate facts, facilities, or infrastructure.\n"
    "3. Explicitly distinguish uncertainty, blurriness, or low resolution.\n"
    "4. NEVER fabricate geographic coordinates, latitude/longitude, GPS data, hectares, "
    "exact pixel dimensions, dates, or quantitative statistics.\n"
    "5. Calibrate confidence honestly (0.0 to 1.0) based on visual clarity.\n"
    "6. You MUST respond with ONLY a valid JSON object adhering strictly to this schema:\n"
    "{\n"
    '  "answer": "string",\n'
    '  "confidence": 0.0 to 1.0,\n'
    '  "observations": ["observable feature 1", "observable feature 2"],\n'
    '  "detected_objects": ["category 1", "category 2"],\n'
    '  "land_use": ["land use category 1", "land use category 2"],\n'
    '  "warnings": ["caveat or uncertainty note if any"]\n'
    "}"
)

COMPARISON_QWEN_SYSTEM_PROMPT = (
    "You are an Earth Observation satellite imagery analyst. You are comparing two satellite images:\n"
    "- Image 1 is the BEFORE image (baseline/reference).\n"
    "- Image 2 is the AFTER image (comparison/follow-up).\n\n"
    "Strict Guidelines:\n"
    "1. Identify visible changes and persistent features between Image 1 and Image 2 "
    "(e.g. buildings, roads, vegetation, agricultural land, water, overall land use).\n"
    "2. Do NOT invent facts or unverified scene changes.\n"
    "3. NEVER fabricate quantitative change percentages (e.g. 'increased by 25%'), exact hectares, "
    "exact object counts, pixel measurements, dates, or coordinates.\n"
    "4. Use calibrated qualitative language (e.g. 'appears', 'likely', 'visually increased').\n"
    "5. Categorize findings into similarities, differences, and contextual observations.\n"
    "6. Assign an honest confidence score (0.0 to 1.0) and note caveats in 'warnings'.\n"
    "7. You MUST respond with ONLY a valid JSON object adhering strictly to this schema:\n"
    "{\n"
    '  "answer": "string summary of comparison",\n'
    '  "confidence": 0.0 to 1.0,\n'
    '  "similarities": ["similarity 1", "similarity 2"],\n'
    '  "differences": ["difference 1", "difference 2"],\n'
    '  "observations": ["contextual observation 1"],\n'
    '  "warnings": ["caveats regarding alignment, resolution, or sensor differences"]\n'
    "}"
)


def _strip_markdown_code_fences(raw_text: str) -> str:
    """Strip markdown json code fences (```json ... ```) if present."""
    text = raw_text.strip()
    if text.startswith("```"):
        # Remove opening fence (``` or ```json)
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        # Remove closing fence
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json_object(raw_text: str) -> Optional[dict]:
    """Attempt to parse JSON from text, extracting outermost JSON object if needed."""
    cleaned = _strip_markdown_code_fences(raw_text)
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Try finding first { and matching last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = cleaned[start : end + 1]
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    return None


class QwenOllamaAdapter:
    """
    Isolated client adapter for local Ollama Qwen3-VL multimodal inference.
    Designed for lazy execution: no health check on startup or normal requests.
    Invoked strictly as a fallback when Gemini specialist fails.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        vqa_timeout: Optional[float] = None,
        comparison_timeout: Optional[float] = None,
        enabled: Optional[bool] = None,
    ) -> None:
        self.base_url = (base_url or settings.OLLAMA_BASE_URL or "http://127.0.0.1:11434").rstrip("/")
        self.model = model or settings.OLLAMA_MODEL or "qwen-satquery"
        self.vqa_timeout = (
            vqa_timeout
            if vqa_timeout is not None
            else getattr(settings, "OLLAMA_VQA_TIMEOUT_SECONDS", 90.0)
        )
        self.comparison_timeout = (
            comparison_timeout
            if comparison_timeout is not None
            else getattr(settings, "OLLAMA_COMPARISON_TIMEOUT_SECONDS", 150.0)
        )
        self.enabled = (
            enabled
            if enabled is not None
            else getattr(settings, "ENABLE_OLLAMA_FALLBACK", True)
        )

    async def vqa(
        self,
        query: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> Tuple[Optional[VQAOutputSchema], Optional[str], Optional[str]]:
        """
        Execute Visual Question Answering inference via local Ollama.

        Args:
            query: Visual analysis question.
            image_bytes: Raw bytes of the satellite image.
            mime_type: MIME type of the image.

        Returns:
            Tuple of (VQAOutputSchema or None, error_type or None, error_message or None).
        """
        if not self.enabled:
            logger.info("Ollama fallback requested but ENABLE_OLLAMA_FALLBACK is False")
            return None, "fallback_disabled", "Local Ollama fallback is disabled in configuration."

        img_b64 = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            f"{VQA_QWEN_SYSTEM_PROMPT}\n\n"
            f"User Visual Question: {query}\n"
            "Return valid JSON adhering strictly to the required schema."
        )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [img_b64],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.0},
        }

        url = f"{self.base_url}/api/chat"
        logger.info("Calling Ollama VQA fallback (model: %s, timeout: %.1fs)", self.model, self.vqa_timeout)

        # At most 1 bounded retry for transport error
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=self.vqa_timeout) as client:
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    data = resp.json()

                raw_content = data.get("message", {}).get("content", "")
                parsed_json = _extract_json_object(raw_content)
                if not parsed_json:
                    logger.warning("Ollama Qwen VQA returned malformed non-JSON output")
                    return None, "invalid_structured_output", "Qwen response could not be parsed as valid JSON."

                # Normalize fields if Qwen returned string instead of list
                _normalize_vqa_fields(parsed_json)

                # Validate with standard schema
                validated = VQAOutputSchema.model_validate(parsed_json)
                return validated, None, None

            except httpx.TimeoutException:
                logger.warning("Ollama Qwen VQA timed out after %.1fs on attempt %d", self.vqa_timeout, attempt + 1)
                return None, "timeout", f"Ollama Qwen VQA timed out after {self.vqa_timeout}s."
            except httpx.ConnectError as exc:
                logger.warning("Ollama connection failed on attempt %d: %s", attempt + 1, exc)
                if attempt == 0:
                    continue
                return None, "provider_unavailable", f"Local Ollama server is unavailable at {self.base_url}."
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                logger.warning("Ollama HTTP status error %s: %s", status, exc)
                return None, "api_error", f"Ollama HTTP error (status {status})."
            except ValidationError as exc:
                logger.warning("Qwen VQA output failed schema validation: %s", exc)
                return None, "invalid_structured_output", f"Qwen output failed schema validation: {exc}"
            except Exception as exc:
                logger.warning("Unexpected error during Ollama VQA call: %s", exc)
                return None, "unexpected_error", f"Unexpected Ollama error: {exc}"

        return None, "provider_unavailable", f"Local Ollama server unavailable at {self.base_url}."

    async def compare(
        self,
        query: str,
        bytes_a: bytes,
        mime_a: str,
        bytes_b: bytes,
        mime_b: str,
        modality_a: str = "unknown",
        modality_b: str = "unknown",
    ) -> Tuple[Optional[ComparisonOutputSchema], Optional[str], Optional[str]]:
        """
        Execute Multimodal Comparison inference between two images via local Ollama.

        Args:
            query: Comparison query.
            bytes_a: Raw bytes of Image A (BEFORE / Baseline).
            mime_a: MIME type of Image A.
            bytes_b: Raw bytes of Image B (AFTER / Follow-up).
            mime_b: MIME type of Image B.
            modality_a: Declared modality of Image A ('optical', 'sar', 'unknown').
            modality_b: Declared modality of Image B ('optical', 'sar', 'unknown').

        Returns:
            Tuple of (ComparisonOutputSchema or None, error_type or None, error_message or None).
        """
        if not self.enabled:
            logger.info("Ollama fallback requested but ENABLE_OLLAMA_FALLBACK is False")
            return None, "fallback_disabled", "Local Ollama fallback is disabled in configuration."

        b64_a = base64.b64encode(bytes_a).decode("utf-8")
        b64_b = base64.b64encode(bytes_b).decode("utf-8")

        # Modality context instruction
        modality_context = (
            f"Modality Information:\n"
            f"- Image 1 declared modality: {modality_a.upper()}\n"
            f"- Image 2 declared modality: {modality_b.upper()}\n"
        )
        if (modality_a == "optical" and modality_b == "sar") or (modality_a == "sar" and modality_b == "optical"):
            modality_context += (
                "- Note: Optical and SAR represent different physical sensors. Do not confuse sensor "
                "differences with physical scene changes.\n"
            )

        prompt = (
            f"{COMPARISON_QWEN_SYSTEM_PROMPT}\n\n"
            f"{modality_context}\n"
            f"User Comparison Inquiry: {query}\n"
            "Return valid JSON adhering strictly to the required schema."
        )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [b64_a, b64_b],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.0},
        }

        url = f"{self.base_url}/api/chat"
        logger.info("Calling Ollama Comparison fallback (model: %s, timeout: %.1fs)", self.model, self.comparison_timeout)

        # At most 1 bounded retry for transport error
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=self.comparison_timeout) as client:
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    data = resp.json()

                raw_content = data.get("message", {}).get("content", "")
                parsed_json = _extract_json_object(raw_content)
                if not parsed_json:
                    logger.warning("Ollama Qwen Comparison returned malformed non-JSON output")
                    return None, "invalid_structured_output", "Qwen response could not be parsed as valid JSON."

                # Normalize fields if needed
                _normalize_comparison_fields(parsed_json)

                # Validate with standard schema
                validated = ComparisonOutputSchema.model_validate(parsed_json)
                return validated, None, None

            except httpx.TimeoutException:
                logger.warning("Ollama Qwen Comparison timed out after %.1fs on attempt %d", self.comparison_timeout, attempt + 1)
                return None, "timeout", f"Ollama Qwen Comparison timed out after {self.comparison_timeout}s."
            except httpx.ConnectError as exc:
                logger.warning("Ollama connection failed on attempt %d: %s", attempt + 1, exc)
                if attempt == 0:
                    continue
                return None, "provider_unavailable", f"Local Ollama server is unavailable at {self.base_url}."
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                logger.warning("Ollama HTTP status error %s: %s", status, exc)
                return None, "api_error", f"Ollama HTTP error (status {status})."
            except ValidationError as exc:
                logger.warning("Qwen Comparison output failed schema validation: %s", exc)
                return None, "invalid_structured_output", f"Qwen output failed schema validation: {exc}"
            except Exception as exc:
                logger.warning("Unexpected error during Ollama Comparison call: %s", exc)
                return None, "unexpected_error", f"Unexpected Ollama error: {exc}"

        return None, "provider_unavailable", f"Local Ollama server unavailable at {self.base_url}."


def _normalize_vqa_fields(data: dict) -> None:
    """Ensure list fields are properly typed as lists of strings and confidence is bounded float."""
    for field in ("observations", "detected_objects", "land_use", "warnings"):
        val = data.get(field)
        if isinstance(val, str):
            data[field] = [val] if val.strip() else []
        elif not isinstance(val, list):
            data[field] = []

    conf = data.get("confidence")
    if conf is not None:
        try:
            data["confidence"] = max(0.0, min(1.0, float(conf)))
        except (ValueError, TypeError):
            data["confidence"] = 0.5
    else:
        data["confidence"] = 0.5


def _normalize_comparison_fields(data: dict) -> None:
    """Ensure list fields are properly typed as lists of strings and confidence is bounded float."""
    for field in ("similarities", "differences", "observations", "warnings"):
        val = data.get(field)
        if isinstance(val, str):
            data[field] = [val] if val.strip() else []
        elif not isinstance(val, list):
            data[field] = []

    conf = data.get("confidence")
    if conf is not None:
        try:
            data["confidence"] = max(0.0, min(1.0, float(conf)))
        except (ValueError, TypeError):
            data["confidence"] = 0.5
    else:
        data["confidence"] = 0.5


_default_qwen_adapter: Optional[QwenOllamaAdapter] = None


def get_default_qwen_adapter() -> QwenOllamaAdapter:
    """Return singleton instance of QwenOllamaAdapter (lazily instantiated)."""
    global _default_qwen_adapter
    if _default_qwen_adapter is None:
        _default_qwen_adapter = QwenOllamaAdapter()
    return _default_qwen_adapter
