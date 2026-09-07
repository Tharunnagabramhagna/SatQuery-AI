import os
import logging
from typing import Any, Dict

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.config import get_gemini_key
from src.models.mock_vlm import async_mock_vqa, async_mock_grounding, async_mock_change_detection

logger = logging.getLogger("satquery.gemini_vlm")

# Configure the Gemini client lazily per request to allow key rotation
def _configure_client():
    api_key = get_gemini_key()
    if not api_key:
        raise RuntimeError("Gemini API key not configured")
    genai.configure(api_key=api_key)
    # Use Gemini 1.5 Pro Vision model (adjust as needed)
    return genai.GenerativeModel("gemini-1.5-pro-vision")

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
            Natural‑language question.
        **kwargs: Any
            Additional parameters (ignored for Gemini but kept for API compatibility).
        """
        try:
            model = self._get_model()
            response = model.generate_content([
                genai.upload_file(path=image) if os.path.isfile(image) else image,
                query,
            ])
            answer = response.text.strip()
            return {
                "answer": answer,
                "confidence": 1.0,
                "bounding_boxes": [],
                "evidence": [],
                "metadata": {"model": "gemini-1.5-pro-vision", "source": "gemini"},
                "is_mock": False,
            }
        except Exception as exc:
            logger.warning("Gemini VQA failed, falling back to mock: %s", exc)
            result = await async_mock_vqa(image=image, query=query, **kwargs)
            result["is_mock"] = True
            return result

    @retry_decorator
    async def async_grounding(self, image: str, query: str, confidence_threshold: float = 0.5, target_classes: Any = None, **kwargs: Any) -> Dict[str, Any]:
        """Text‑guided grounding via Gemini.

        Gemini does not provide explicit grounding, so we fall back to the mock
        implementation on failure. Successful calls return an empty list of
        detections with ``is_mock`` set to ``False``.
        """
        try:
            model = self._get_model()
            response = model.generate_content([
                genai.upload_file(path=image) if os.path.isfile(image) else image,
                f"Ground the following query in the image: {query}",
            ])
            return {
                "detected_objects": [],
                "total_detected": 0,
                "summary": response.text.strip(),
                "metadata": {"model": "gemini-1.5-pro-vision", "source": "gemini"},
                "is_mock": False,
            }
        except Exception as exc:
            logger.warning("Gemini grounding failed, falling back to mock: %s", exc)
            result = await async_mock_grounding(image=image, query=query, confidence_threshold=confidence_threshold, target_classes=target_classes)
            result["is_mock"] = True
            return result

    @retry_decorator
    async def async_change_detection(self, image_before: str, image_after: str, query: str = "What changed?", threshold: float = 0.5, **kwargs: Any) -> Dict[str, Any]:
        """Bi‑temporal change detection using Gemini.

        Gemini does not support explicit change detection, so this method simply
        forwards to the mock implementation on any error. If the call succeeds,
        it returns a minimal placeholder response.
        """
        try:
            model = self._get_model()
            response = model.generate_content([
                genai.upload_file(path=image_before) if os.path.isfile(image_before) else image_before,
                genai.upload_file(path=image_after) if os.path.isfile(image_after) else image_after,
                query,
            ])
            return {
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
                "metadata": {"model": "gemini-1.5-pro-vision", "source": "gemini"},
                "is_mock": False,
            }
        except Exception as exc:
            logger.warning("Gemini change detection failed, falling back to mock: %s", exc)
            result = await async_mock_change_detection(image_before=image_before, image_after=image_after, query=query, threshold=threshold)
            result["is_mock"] = True
            return result

# Singleton instance used by the API routes
default_gemini_service = GeminiVLMService()
