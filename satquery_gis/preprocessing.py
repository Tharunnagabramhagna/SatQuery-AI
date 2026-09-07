import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.windows import Window
import numpy as np
import math

def reproject_raster(input_filepath, output_filepath, dst_crs="EPSG:4326", resampling=Resampling.nearest):
    """
    Reprojects a raster to a target CRS and saves it.
    """
    with rasterio.open(input_filepath) as src:
        transform, width, height = calculate_default_transform(
            src.crs, dst_crs, src.width, src.height, *src.bounds)
        
        kwargs = src.meta.copy()
        kwargs.update({
            'crs': dst_crs,
            'transform': transform,
            'width': width,
            'height': height
        })

        with rasterio.open(output_filepath, 'w', **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=resampling
                )
    return output_filepath

def get_windows(width, height, window_size=512, overlap=0):
    """
    Generates Rasterio Windows for processing large rasters in chunks.
    """
    stride = window_size - overlap
    windows = []
    
    for row_off in range(0, height, stride):
        for col_off in range(0, width, stride):
            w = min(window_size, width - col_off)
            h = min(window_size, height - row_off)
            windows.append(Window(col_off, row_off, w, h))
            
    return windows

def align_rasters(t1_filepath, t2_filepath, output_t2_filepath, resampling=Resampling.bilinear):
    """
    Aligns T2 raster to exactly match the grid (CRS, transform, shape) of T1 raster
    to prevent false change-detection artifacts, while preserving T2's native band count,
    dtype, and band metadata.
    """
    with rasterio.open(t1_filepath) as src1:
        target_crs = src1.crs
        target_transform = src1.transform
        target_width = src1.width
        target_height = src1.height
        
    with rasterio.open(t2_filepath) as src2:
        out_meta = src2.meta.copy()
        out_meta.update({
            'crs': target_crs,
            'transform': target_transform,
            'width': target_width,
            'height': target_height
        })
        with rasterio.open(output_t2_filepath, 'w', **out_meta) as dst:
            for i in range(1, src2.count + 1):
                reproject(
                    source=rasterio.band(src2, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src2.transform,
                    src_crs=src2.crs,
                    dst_transform=target_transform,
                    dst_crs=target_crs,
                    resampling=resampling
                )
                if src2.descriptions and len(src2.descriptions) >= i and src2.descriptions[i - 1]:
                    dst.set_band_description(i, src2.descriptions[i - 1])
    return output_t2_filepath

