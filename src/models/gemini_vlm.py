"""Gemini VLM service with retry logic and mock fallback.

Provides async methods for VQA, grounding, and change detection using the
Google Gemini generative AI API.  Falls back to mock implementations when
Gemini is unavailable or the API key is not configured.
"""

import base64
import io
import os
import logging
from typing import Any, Dict, Optional

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.config import get_gemini_key
from src.models.mock_vlm import async_mock_vqa, async_mock_grounding, async_mock_change_detection

logger = logging.getLogger("satquery.gemini_vlm")

# Model name — update this when migrating to newer Gemini versions
GEMINI_MODEL_NAME = os.getenv("GEMINI_VLM_MODEL", "gemini-2.0-flash")


# ---------------------------------------------------------------------------
# Client & Image Helpers
# ---------------------------------------------------------------------------

def _configure_client():
    """Configure the Gemini client lazily per request to allow key rotation."""
    api_key = get_gemini_key()
    if not api_key:
        raise RuntimeError("Gemini API key not configured")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(GEMINI_MODEL_NAME)


def _prepare_image_input(image: str):
    """Convert image string to a Gemini-compatible input.

    Handles three formats:
      1. Local file path  → ``genai.upload_file``
      2. Base64 data URI  → decode and wrap as inline ``Part``
      3. Plain URL/text   → pass through as-is (Gemini may fetch the URL)
    """
    # 1. Local file
    if os.path.isfile(image):
        return genai.upload_file(path=image)

    # 2. Base64 data URI (e.g. "data:image/jpeg;base64,/9j/...")
    if image.startswith("data:"):
        try:
            header, b64data = image.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]  # e.g. "image/jpeg"
            raw_bytes = base64.b64decode(b64data)
            return {"mime_type": mime_type, "data": raw_bytes}
        except Exception:
            logger.warning("Failed to decode base64 image, passing as text")

    # 3. URL or raw string — pass as-is
    return image


# Generic retry decorator for Gemini calls
retry_decorator = retry(
    retry=retry_if_exception_type((google_exceptions.ResourceExhausted, RuntimeError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, max=10),
    reraise=True,
)


class GeminiVLMService:
    """Service wrapper for Gemini VLM operations with retry and mock fallback.

    All public methods return dictionaries compatible with the existing mock VLM
    responses and include an ``"is_mock"`` flag indicating whether the result
    originates from Gemini (``False``) or the mock fallback (``True``).
    """

    def __init__(self) -> None:
        self.model: Any = None

    def _get_model(self) -> Any:
        if self.model is None:
            self.model = _configure_client()
        return self.model

    @retry_decorator
    async def async_vqa(self, image: str, query: str, **kwargs: Any) -> Dict[str, Any]:
        """Perform Visual Question Answering using Gemini.

        Parameters
        ----------
        image: str
            Path, URL, or base64 string of the image.
        query: str
            Natural-language question.
        **kwargs: Any
            Additional parameters (ignored for Gemini but kept for API compatibility).
        """
        try:
            model = self._get_model()
            image_input = _prepare_image_input(image)
            response = model.generate_content([image_input, query])
            answer = response.text.strip()
            return {
                "answer": answer,
                "confidence": 1.0,
                "bounding_boxes": [],
                "evidence": [],
                "metadata": {"model": GEMINI_MODEL_NAME, "source": "gemini"},
                "is_mock": False,
            }
        except Exception as exc:
            logger.warning("Gemini VQA failed, falling back to mock: %s", exc)
            result = await async_mock_vqa(image=image, query=query, **kwargs)
            result["is_mock"] = True
            return result

    @retry_decorator
    async def async_grounding(self, image: str, query: str, confidence_threshold: float = 0.5, target_classes: Any = None, **kwargs: Any) -> Dict[str, Any]:
        """Text-guided grounding via Gemini.

        Gemini does not provide explicit grounding, so we fall back to the mock
        implementation on failure. Successful calls return an empty list of
        detections with ``is_mock`` set to ``False``.
        """
        try:
            model = self._get_model()
            image_input = _prepare_image_input(image)
            response = model.generate_content([
                image_input,
                f"Ground the following query in the image: {query}",
            ])
            return {
                "query": query,
                "detected_objects": [],
                "total_detected": 0,
                "summary": response.text.strip(),
                "metadata": {"model": GEMINI_MODEL_NAME, "source": "gemini"},
                "is_mock": False,
            }
        except Exception as exc:
            logger.warning("Gemini grounding failed, falling back to mock: %s", exc)
            result = await async_mock_grounding(image=image, query=query, confidence_threshold=confidence_threshold, target_classes=target_classes)
            result["is_mock"] = True
            return result

    @retry_decorator
    async def async_change_detection(self, image_before: str, image_after: str, query: str = "What changed?", threshold: float = 0.5, **kwargs: Any) -> Dict[str, Any]:
        """Bi-temporal change detection using Gemini.

        Gemini does not support explicit change detection, so this method simply
        forwards to the mock implementation on any error. If the call succeeds,
        it returns a minimal placeholder response.
        """
        try:
            model = self._get_model()
            before_input = _prepare_image_input(image_before)
            after_input = _prepare_image_input(image_after)
            response = model.generate_content([before_input, after_input, query])
            return {
                "query": query,
                "summary": response.text.strip(),
                "detected_changes": [],
                "total_changes": 0,
                "quantified_metrics": {
                    "built_up_area_change_pct": 0.0,
                    "vegetation_loss_pct": 0.0,
                    "water_surface_change_pct": 0.0,
                    "total_modified_area_hectares": 0.0,
                    "change_intensity": "none",
                },
                "compatibility_verified": True,
                "metadata": {"model": GEMINI_MODEL_NAME, "source": "gemini"},
                "is_mock": False,
            }
        except Exception as exc:
            logger.warning("Gemini change detection failed, falling back to mock: %s", exc)
            result = await async_mock_change_detection(image_before=image_before, image_after=image_after, query=query, threshold=threshold)
            result["is_mock"] = True
            return result


# Singleton instance used by the API routes
default_gemini_service = GeminiVLMService()
