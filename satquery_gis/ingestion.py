import rasterio
from rasterio.errors import RasterioIOError
import warnings

def validate_raster(filepath):
    """
    Validates a raster file to ensure it can be opened, has a valid CRS,
    and returns its basic metadata.
    """
    try:
        with rasterio.open(filepath) as src:
            if src.crs is None:
                raise ValueError(f"Raster {filepath} is missing Coordinate Reference System (CRS).")
            
            # Extract essential metadata
            meta = src.meta.copy()
            bounds = src.bounds
            
            # Check bands
            if meta['count'] == 0:
                raise ValueError(f"Raster {filepath} has no bands.")
                
            return {
                "filepath": filepath,
                "crs": src.crs,
                "width": meta['width'],
                "height": meta['height'],
                "count": meta['count'],
                "dtype": meta['dtype'],
                "bounds": bounds,
                "transform": src.transform
            }
    except RasterioIOError as e:
        raise ValueError(f"Failed to open raster file: {filepath}. Error: {str(e)}")

def ingest_raster(filepath, expected_crs=None):
    """
    Ingests a raster and performs basic validation. Optionally checks against an expected CRS.
    """
    metadata = validate_raster(filepath)
    
    if expected_crs is not None:
        if metadata['crs'] != expected_crs:
            warnings.warn(f"Raster CRS {metadata['crs']} does not match expected {expected_crs}. Re-projection may be required.")
            
    return metadata
