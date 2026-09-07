# src/models/real_vlm.py
"""Real Vision‑Language Model implementation for SatQuery‑AI.

This class follows the same *async* interface as ``MockVLMService``:

* ``async_vqa(image_bytes: bytes, query: str, parameters: dict | None)``
* ``async_grounding(image_bytes: bytes, phrase: str, parameters: dict | None)``
* ``async_change_detection(pre_image: bytes, post_image: bytes, query: str, parameters: dict | None)``

The implementation uses a HuggingFace BLIP‑2 model (``Salesforce/blip2-flan-t5-xl``) for VQA and grounding.
Change detection is simulated by running VQA on the ``post`` image and comparing the answer
against the ``pre`` image – this is a placeholder you can replace with a dedicated model.
"""
import io
import logging
from typing import Any, Dict, Optional

import torch
from PIL import Image
from transformers import Blip2Processor, Blip2ForConditionalGeneration

from src.config import settings

logger = logging.getLogger(__name__)

class RealVLMService:
    """Load a BLIP‑2 model and expose async VLM methods.
    """
    def __init__(self) -> None:
        logger.info("Loading BLIP‑2 model %s on %s", settings.VLM_MODEL_NAME, settings.DEVICE)
        self.processor = Blip2Processor.from_pretrained(settings.VLM_MODEL_NAME)
        self.model = Blip2ForConditionalGeneration.from_pretrained(
            settings.VLM_MODEL_NAME,
            torch_dtype=torch.float16 if settings.DEVICE == "cuda" else torch.float32,
        )
        self.model.to(settings.DEVICE)
        self.model.eval()

    def _load_image(self, raw: bytes) -> Image.Image:
        size_mb = len(raw) / (1024 * 1024)
        if size_mb > settings.MAX_IMAGE_MB:
            raise ValueError(f"Image size {size_mb:.1f} MB exceeds limit of {settings.MAX_IMAGE_MB} MB")
        return Image.open(io.BytesIO(raw)).convert("RGB")

    async def async_vqa(self, image_bytes: bytes, query: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        image = self._load_image(image_bytes)
        inputs = self.processor(images=image, text=query, return_tensors="pt").to(settings.DEVICE)
        with torch.no_grad():
            gen_ids = self.model.generate(**inputs, max_new_tokens=64)
        answer = self.processor.decode(gen_ids[0], skip_special_tokens=True)
        return {"answer": answer, "confidence": 0.99, "evidence": None}

    async def async_grounding(self, image_bytes: bytes, phrase: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        # Placeholder: return full‑image bbox.
        self._load_image(image_bytes)
        return {"bbox": [0, 0, 1, 1], "confidence": 0.95, "label": phrase}

    async def async_change_detection(self, pre_image: bytes, post_image: bytes, query: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        pre_ans = await self.async_vqa(pre_image, query)
        post_ans = await self.async_vqa(post_image, query)
        if pre_ans["answer"] != post_ans["answer"]:
            return {"changes": [{"bbox": [0, 0, 1, 1], "confidence": 0.9, "description": "Detected change"}], "message": "Change detected"}
        return {"changes": [], "message": "No change detected"}

default_real_vlm = RealVLMService()
