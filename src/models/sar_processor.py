import os
from typing import Tuple, Optional
import numpy as np
import rasterio

def load_sar_asset(sar_path: str) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Load a Synthetic Aperture Radar (SAR) asset from the given path.
    
    This function expects a dual-pol (VV, VH) SAR image (typically Sentinel-1).
    It extracts the raw VV and VH polarization bands, and computes a false-color
    RGB composite for visual preview, normalized to 8-bit [0, 255].
    
    Returns:
        A tuple of (vv_array, vh_array, rgb_preview).
        If the file cannot be read, returns (None, None, None).
    """
    if not os.path.exists(sar_path):
        return None, None, None

    try:
        with rasterio.open(sar_path) as dataset:
            # Assuming Band 1 is VV, Band 2 is VH. Adjust indices as needed for actual data.
            # Rasterio uses 1-based indexing for bands.
            if dataset.count >= 2:
                vv = dataset.read(1)
                vh = dataset.read(2)
            else:
                # If only one band is present, return it and duplicate for the composite
                vv = dataset.read(1)
                vh = vv

            # Convert to float for processing
            vv_f = vv.astype(np.float32)
            vh_f = vh.astype(np.float32)

            # Generate a 3-channel composite: [VV, VH, VV/VH]
            # Handle division by zero
            with np.errstate(divide='ignore', invalid='ignore'):
                ratio = np.divide(vv_f, vh_f)
                ratio[~np.isfinite(ratio)] = 0.0
            
            # Helper to normalize an array to [0, 255] uint8
            def normalize_8bit(arr: np.ndarray, clip_min_pct: float = 2.0, clip_max_pct: float = 98.0) -> np.ndarray:
                p_min, p_max = np.percentile(arr[arr > 0] if np.any(arr > 0) else arr, (clip_min_pct, clip_max_pct))
                if p_min == p_max:
                    return np.zeros_like(arr, dtype=np.uint8)
                norm = np.clip((arr - p_min) / (p_max - p_min), 0.0, 1.0)
                return (norm * 255).astype(np.uint8)

            r = normalize_8bit(vv_f)
            g = normalize_8bit(vh_f)
            b = normalize_8bit(ratio)

            # Stack into a (H, W, 3) RGB array
            rgb_preview = np.dstack((r, g, b))

            return vv, vh, rgb_preview
    except Exception as e:
        print(f"Error loading SAR asset {sar_path}: {e}")
        return None, None, None
