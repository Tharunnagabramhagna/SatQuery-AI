# src/config.py
"""Configuration utilities for SatQuery‑AI.

The service reads environment variables (or falls back to defaults) to
determine which Vision‑Language Model to load, which device to use, and a
few runtime parameters.

Typical usage:
```python
from src.config import settings
model_name = settings.VLM_MODEL_NAME
device = settings.DEVICE
```
"""
import os
import itertools
from typing import List
from pathlib import Path

def _has_cuda() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False

class Settings:
    #: Name of the HuggingFace model checkpoint to load for VQA.
    VLM_MODEL_NAME: str = os.getenv("VLM_MODEL_NAME", "Salesforce/blip2-flan-t5-xl")
    #: Primary Gemini API key (fallback if list not provided)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    #: Comma‑separated list of Gemini API keys for round‑robin rotation
    GEMINI_API_KEYS: List[str] = [k.strip() for k in os.getenv("GEMINI_API_KEYS", "").split(",") if k.strip()]
    #: Device on which to run the model – ``cuda`` if a GPU is available, otherwise ``cpu``.
    DEVICE: str = os.getenv("VLM_DEVICE", "cuda" if _has_cuda() else "cpu")
    #: Maximum size (in megabytes) accepted for the uploaded image. Prevents OOM.
    MAX_IMAGE_MB: int = int(os.getenv("VLM_MAX_IMAGE_MB", "20"))
    #: Timeout (seconds) for a single inference request.
    INFERENCE_TIMEOUT: int = int(os.getenv("VLM_INFERENCE_TIMEOUT", "30"))

    def __repr__(self) -> str:
        return (
            f"Settings(VLM_MODEL_NAME={self.VLM_MODEL_NAME}, "
            f"DEVICE={self.DEVICE}, MAX_IMAGE_MB={self.MAX_IMAGE_MB}, "
            f"INFERENCE_TIMEOUT={self.INFERENCE_TIMEOUT})"
        )

# Export a singleton for easy import elsewhere.
# Round‑robin iterator over the list of API keys (if any)
if Settings().GEMINI_API_KEYS:
    _gemini_key_cycle = itertools.cycle(range(len(Settings().GEMINI_API_KEYS)))
else:
    _gemini_key_cycle = None


def get_gemini_key() -> str:
    """Return the next Gemini API key.

    If a list of keys is configured via ``GEMINI_API_KEYS`` the function cycles
    through them on each call (per‑request rotation). Otherwise it falls back to
    the single ``GEMINI_API_KEY`` value (which may be empty if not set).
    """
    if _gemini_key_cycle is not None:
        idx = next(_gemini_key_cycle)
        return Settings().GEMINI_API_KEYS[idx]
    return Settings().GEMINI_API_KEY

settings = Settings()
