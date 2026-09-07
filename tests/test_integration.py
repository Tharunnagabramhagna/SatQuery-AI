import pytest
import numpy as np
import rasterio
from rasterio.transform import from_origin
import json
import os

from satquery_gis.ingestion import validate_raster
from satquery_gis.preprocessing import get_windows
from satquery_gis.spatial import bbox_to_geometry, coords_to_geojson

@pytest.fixture
def mock_geotiff(tmp_path):
    """Creates a mock 1024x1024 GeoTIFF representing an uploaded satellite image."""
    path = tmp_path / "mock_upload.tif"
    
    # EPSG:32633 (UTM Zone 33N), setting origin somewhere in Europe
    transform = from_origin(500000.0, 4600000.0, 10.0, 10.0)
    data = np.random.randint(0, 255, (3, 1024, 1024), dtype=np.uint8) # 3-band image
    
    with rasterio.open(
        path, 'w', driver='GTiff',
        height=1024, width=1024,
        count=3, dtype=data.dtype,
        crs='EPSG:32633', transform=transform
    ) as dst:
        dst.write(data)
        
    return str(path)

def test_end_to_end_workflow(mock_geotiff):
    """
    Simulates the full SatQuery-AI integration pipeline:
    Upload -> Ingestion -> Preprocessing (Windowing) -> VLM Mock -> Spatial Transformation -> API GeoJSON
    """
    
    # 1. Ingestion: Validate the uploaded GeoTIFF
    metadata = validate_raster(mock_geotiff)
    assert metadata['width'] == 1024
    assert metadata['height'] == 1024
    assert metadata['count'] == 3
    assert metadata['crs'].to_string() == 'EPSG:32633'
    
    # 2. Preprocessing: Generate window patches for the VLM (e.g., 512x512 patches)
    windows = get_windows(metadata['width'], metadata['height'], window_size=512, overlap=0)
    assert len(windows) == 4 # 1024x1024 split into 512x512 should yield 4 windows
    
    # 3. VLM Mock: Simulate the VLM detecting an object in the first window
    # Let's say the VLM finds a building in window 0, giving a local bounding box (xmin, ymin, xmax, ymax)
    # inside that 512x512 patch.
    first_window = windows[0]
    
    # Local VLM bounding box inside the patch (e.g., a 50x50 object)
    vlm_local_xmin = 100
    vlm_local_ymin = 100
    vlm_local_xmax = 150
    vlm_local_ymax = 150
    
    # Convert local VLM pixel coordinates to global image pixel coordinates
    global_xmin = first_window.col_off + vlm_local_xmin
    global_ymin = first_window.row_off + vlm_local_ymin
    global_xmax = first_window.col_off + vlm_local_xmax
    global_ymax = first_window.row_off + vlm_local_ymax
    
    # 4. Spatial Module: Translate to Geographic Geometries and GeoJSON
    with rasterio.open(mock_geotiff) as src:
        geom = bbox_to_geometry(src.transform, global_xmin, global_ymin, global_xmax, global_ymax)
        
        # Add some mock metadata properties we would send to the frontend
        feature_properties = {
            "object_type": "building",
            "confidence_score": 0.95,
            "image_id": "mock_upload.tif"
        }
        
        geojson_str = coords_to_geojson([geom], source_crs=src.crs, target_crs="EPSG:4326", properties_list=[feature_properties])
    
    # 5. API/Frontend Validation: Check the final output format
    api_response = json.loads(geojson_str)
    
    assert api_response['type'] == 'FeatureCollection'
    assert len(api_response['features']) == 1
    
    feature = api_response['features'][0]
    assert feature['type'] == 'Feature'
    assert feature['properties']['object_type'] == 'building'
    assert feature['properties']['confidence_score'] == 0.95
    assert feature['properties']['image_id'] == 'mock_upload.tif'
    
    # Check geometry bounds and conversion
    assert feature['geometry']['type'] == 'Polygon'
    coordinates = feature['geometry']['coordinates'][0]
    
    # Ensure standard WGS84 bounds (Lat < 90, Lon < 180)
    for lon, lat in coordinates:
        assert -180 <= lon <= 180
        assert -90 <= lat <= 90
