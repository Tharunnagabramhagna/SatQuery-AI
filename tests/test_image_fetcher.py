"""Unit tests for the Image Fetcher Service."""

from __future__ import annotations

import io
import pytest
from PIL import Image

from backend.services.image_fetcher import ImageFetchError, fetch_image_from_url


@pytest.mark.asyncio
async def test_fetch_image_empty_url():
    with pytest.raises(ImageFetchError, match="cannot be empty"):
        await fetch_image_from_url("")


@pytest.mark.asyncio
async def test_fetch_image_invalid_scheme():
    with pytest.raises(ImageFetchError, match="Unsupported URL scheme"):
        await fetch_image_from_url("ftp://example.com/image.png")


@pytest.mark.asyncio
async def test_fetch_image_invalid_netloc():
    with pytest.raises(ImageFetchError, match="Invalid image URL"):
        await fetch_image_from_url("https://")
