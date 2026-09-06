import pytest
import numpy as np
import rasterio
from rasterio.transform import from_origin
import json
from satquery_gis.ingestion import validate_raster
from satquery_gis.preprocessing import get_windows, align_rasters, reproject_raster
from satquery_gis.spatial import pixel_to_coords, bbox_to_geometry, coords_to_geojson
import os

@pytest.fixture
def dummy_raster(tmp_path):
    """Creates a dummy 100x100 raster with EPSG:32633."""
    path = tmp_path / "dummy.tif"
    
    transform = from_origin(500000.0, 4600000.0, 10.0, 10.0)
    data = np.random.randint(0, 255, (1, 100, 100), dtype=np.uint8)
    
    with rasterio.open(
        path, 'w', driver='GTiff',
        height=100, width=100,
        count=1, dtype=data.dtype,
        crs='EPSG:32633', transform=transform
    ) as dst:
        dst.write(data)
        
    return str(path)

@pytest.fixture
def dummy_raster_t2(tmp_path):
    """Creates a slightly misaligned T2 raster for alignment tests."""
    path = tmp_path / "dummy_t2.tif"
    
    # Slightly different transform and shape
    transform = from_origin(499990.0, 4600010.0, 10.0, 10.0)
    data = np.random.randint(0, 255, (1, 110, 110), dtype=np.uint8)
    
    with rasterio.open(
        path, 'w', driver='GTiff',
        height=110, width=110,
        count=1, dtype=data.dtype,
        crs='EPSG:32633', transform=transform
    ) as dst:
        dst.write(data)
        
    return str(path)

def test_validate_raster(dummy_raster):
    meta = validate_raster(dummy_raster)
    assert meta['width'] == 100
    assert meta['height'] == 100
    assert meta['crs'].to_string() == 'EPSG:32633'

def test_get_windows():
    windows = get_windows(200, 200, window_size=100, overlap=0)
    assert len(windows) == 4
    assert windows[0].col_off == 0 and windows[0].row_off == 0
    assert windows[1].col_off == 100 and windows[1].row_off == 0
    
    windows_overlap = get_windows(200, 200, window_size=100, overlap=50)
    assert len(windows_overlap) > 4 # Should have more windows due to 50 pixel overlap

def test_align_rasters(dummy_raster, dummy_raster_t2, tmp_path):
    output_t2 = str(tmp_path / "aligned_t2.tif")
    align_rasters(dummy_raster, dummy_raster_t2, output_t2)
    
    # Check if output_t2 now matches dummy_raster exactly
    meta1 = validate_raster(dummy_raster)
    meta2 = validate_raster(output_t2)
    
    assert meta1['width'] == meta2['width']
    assert meta1['height'] == meta2['height']
    assert meta1['transform'] == meta2['transform']

def test_pixel_to_coords(dummy_raster):
    with rasterio.open(dummy_raster) as src:
        transform = src.transform
        
        # Origin (top-left)
        lon, lat = pixel_to_coords(transform, 0, 0)
        assert lon == 500000.0
        assert lat == 4600000.0
        
        # Bottom right of first pixel
        lon, lat = pixel_to_coords(transform, 1, 1)
        assert lon == 500010.0
        assert lat == 4599990.0

def test_bbox_to_geometry(dummy_raster):
    with rasterio.open(dummy_raster) as src:
        transform = src.transform
        geom = bbox_to_geometry(transform, 0, 0, 10, 10)
        
        bounds = geom.bounds # minx, miny, maxx, maxy
        assert bounds[0] == 500000.0 # minx (lon)
        assert bounds[1] == 4599900.0 # miny (lat - since y goes down)
        assert bounds[2] == 500100.0 # maxx (lon)
        assert bounds[3] == 4600000.0 # maxy (lat)

def test_coords_to_geojson(dummy_raster):
    with rasterio.open(dummy_raster) as src:
        transform = src.transform
        source_crs = src.crs
        
        geom = bbox_to_geometry(transform, 0, 0, 10, 10)
        geojson_str = coords_to_geojson([geom], source_crs=source_crs, target_crs="EPSG:4326")
        
        geojson_dict = json.loads(geojson_str)
        assert geojson_dict['type'] == 'FeatureCollection'
        assert len(geojson_dict['features']) == 1
        
        # Coordinate should now be in EPSG:4326 (lat/lon roughly)
        coords = geojson_dict['features'][0]['geometry']['coordinates'][0]
        # EPSG:32633 is UTM zone 33N, so 500000.0 4600000.0 is roughly lat 41.5, lon 15.0
        lon, lat = coords[0]
        assert 14.0 < lon < 16.0
        assert 40.0 < lat < 42.0
