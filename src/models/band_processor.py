import numpy as np
import rasterio
from rasterio.errors import RasterioIOError


def load_geotiff(path: str) -> np.ndarray:
    """Load a GeoTIFF file and return a NumPy array.

    Parameters
    ----------
    path: str
        File path to the GeoTIFF.
    Returns
    -------
    np.ndarray
        Array with shape (bands, height, width).
    """
    try:
        with rasterio.open(path) as src:
            array = src.read()  # shape: (bands, height, width)
        return array.astype(np.float32)
    except RasterioIOError as e:
        raise FileNotFoundError(f"Unable to read GeoTIFF at {path}: {e}")


def normalize_array(arr: np.ndarray) -> np.ndarray:
    """Normalize a numeric array to the [0, 1] range as float32.
    """
    if not np.issubdtype(arr.dtype, np.number):
        raise TypeError("Input array must be numeric")
    arr_min = arr.min()
    arr_max = arr.max()
    if arr_max == arr_min:
        return np.zeros_like(arr, dtype=np.float32)
    normalized = (arr - arr_min) / (arr_max - arr_min)
    return normalized.astype(np.float32)


def bands_to_rgb(arr: np.ndarray, red_idx: int = 0, green_idx: int = 1, blue_idx: int = 2) -> np.ndarray:
    """Convert multi‑spectral bands to an 8‑bit RGB image.

    Parameters
    ----------
    arr: np.ndarray
        Input array with shape (bands, height, width).
    red_idx, green_idx, blue_idx: int, optional
        Indices of the red, green, and blue bands.

    Returns
    -------
    np.ndarray
        RGB image with shape (height, width, 3) and dtype uint8.
    """
    if arr.ndim != 3:
        raise ValueError("Input array must be 3-dimensional (bands, height, width)")
    bands, height, width = arr.shape
    for idx in (red_idx, green_idx, blue_idx):
        if idx < 0 or idx >= bands:
            raise IndexError(f"Band index {idx} out of range for array with {bands} bands")
    # Extract bands and normalize
    red = normalize_array(arr[red_idx])
    green = normalize_array(arr[green_idx])
    blue = normalize_array(arr[blue_idx])
    # Stack and convert to uint8
    rgb = np.stack([red, green, blue], axis=-1)  # shape: (height, width, 3)
    return (rgb * 255).astype(np.uint8)
