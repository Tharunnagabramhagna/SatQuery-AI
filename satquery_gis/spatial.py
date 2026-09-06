import rasterio
from shapely.geometry import box, Polygon
import geopandas as gpd
from pyproj import Transformer

def pixel_to_coords(transform, x_pixel, y_pixel):
    """
    Converts pixel coordinates to geographic/projected coordinates using the raster's affine transform.
    """
    lon, lat = transform @ (x_pixel, y_pixel)
    return lon, lat

def bbox_to_geometry(transform, xmin, ymin, xmax, ymax):
    """
    Converts a pixel bounding box (xmin, ymin, xmax, ymax) to a Shapely Polygon.
    """
    top_left = pixel_to_coords(transform, xmin, ymin)
    bottom_right = pixel_to_coords(transform, xmax, ymax)
    
    # Rasterio origin is usually top-left. So ymax pixel corresponds to a lower latitude.
    lon_min, lat_max = top_left
    lon_max, lat_min = bottom_right
    
    return box(min(lon_min, lon_max), min(lat_min, lat_max), max(lon_min, lon_max), max(lat_min, lat_max))

def coords_to_geojson(geometries, source_crs, target_crs="EPSG:4326", properties_list=None):
    """
    Converts a list of Shapely geometries into an EPSG:4326 GeoJSON FeatureCollection.
    """
    if properties_list is None:
        properties_list = [{} for _ in geometries]
        
    if len(geometries) != len(properties_list):
        raise ValueError("geometries and properties_list must have the same length")
        
    gdf = gpd.GeoDataFrame(properties_list, geometry=geometries, crs=source_crs)
    
    if source_crs != target_crs:
        gdf = gdf.to_crs(target_crs)
        
    return gdf.to_json()
