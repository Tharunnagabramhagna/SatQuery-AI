"""Image URL Fetcher Service for SatQuery AI.

Provides asynchronous, secure downloading of remote satellite images from HTTP/HTTPS URLs
for use across the Multi-Agent Vision pipeline.
"""

from __future__ import annotations

import logging
import os
import tempfile
import urllib.parse
from typing import Optional

import httpx
from PIL import Image

logger = logging.getLogger("satquery.services.image_fetcher")

# Maximum allowed image download size in bytes (50 MB)
MAX_IMAGE_DOWNLOAD_BYTES = 50 * 1024 * 1024
DEFAULT_DOWNLOAD_TIMEOUT = 15.0  # seconds

ALLOWED_CONTENT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/tiff": ".tif",
    "image/x-tiff": ".tif",
    "image/geotiff": ".tif",
    "image/webp": ".webp",
    "application/octet-stream": ".png",  # Handled with fallback validation
}


class ImageFetchError(Exception):
    """Raised when an image URL cannot be downloaded or validated."""


async def fetch_image_from_url(
    url: str,
    target_dir: Optional[str] = None,
    prefix: str = "remote_image",
    timeout: float = DEFAULT_DOWNLOAD_TIMEOUT,
) -> str:
    """Download an image from a URL, validate it, and write to a local temporary file.

    Parameters
    ----------
    url : str
        The HTTP or HTTPS URL pointing to the image.
    target_dir : Optional[str]
        Directory where the file will be saved. If None, a temporary directory is used.
    prefix : str
        Filename prefix for the saved image.
    timeout : float
        HTTP request timeout in seconds.

    Returns
    -------
    str
        Absolute file path of the downloaded image.

    Raises
    ------
    ImageFetchError
        If URL is invalid, download fails, size exceeds limit, or content is not a valid image.
    """
    if not url or not url.strip():
        raise ImageFetchError("Image URL cannot be empty.")

    url = url.strip()
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ImageFetchError(f"Unsupported URL scheme '{parsed.scheme}'. Only http:// and https:// are allowed.")

    if not parsed.netloc:
        raise ImageFetchError(f"Invalid image URL: '{url}'")

    if target_dir is None:
        target_dir = tempfile.mkdtemp(prefix="satquery_fetch_")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            response = await client.get(url)
            if response.status_code != 200:
                raise ImageFetchError(
                    f"Failed to fetch image from URL (HTTP {response.status_code}): {url}"
                )

            content = response.content
            if len(content) > MAX_IMAGE_DOWNLOAD_BYTES:
                raise ImageFetchError(
                    f"Downloaded image exceeds maximum size limit of {MAX_IMAGE_DOWNLOAD_BYTES // (1024 * 1024)}MB."
                )

            # Determine extension from URL path or Content-Type header
            content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
            ext = ALLOWED_CONTENT_TYPES.get(content_type)

            if not ext:
                path_ext = os.path.splitext(parsed.path)[1].lower()
                if path_ext in (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"):
                    ext = path_ext
                else:
                    ext = ".png"

            temp_path = os.path.join(target_dir, f"{prefix}{ext}")

            # Write bytes to disk
            with open(temp_path, "wb") as f:
                f.write(content)

            # Verify image integrity with PIL
            try:
                with Image.open(temp_path) as img:
                    img.verify()
            except Exception as verify_err:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise ImageFetchError(f"Downloaded file is not a valid image: {verify_err}") from verify_err

            logger.info("Successfully downloaded image from %s to %s (%d bytes)", url, temp_path, len(content))
            return temp_path

    except httpx.RequestError as exc:
        raise ImageFetchError(f"Network error while fetching image from '{url}': {str(exc)}") from exc
    except Exception as exc:
        if not isinstance(exc, ImageFetchError):
            raise ImageFetchError(f"Unexpected error fetching image from '{url}': {str(exc)}") from exc
        raise
