# SAR Test Fixture Specifications & Compliance Status

## Current Status: BLOCKED

As of September 2026, **no verified, operational Synthetic Aperture Radar (SAR) fixture exists** in `tests/data/sar/`.

In accordance with SatQuery-AI's core engineering principles and the SIH 2026 Problem Statement requirements:
- **Optical imagery will NEVER be relabeled as SAR.**
- **Synthetic RGB images or descriptors will NEVER be substituted as real SAR data.**
- Acceptance test **SIH-04 (Optical + SAR Cross-Modal Analysis)** will remain strictly **`BLOCKED`** until a verified, legitimate SAR raster meeting the specifications below is added.

---

## Required SAR Fixture Specifications

When adding a legitimate SAR image for evaluation, the contributor must provide a companion metadata manifest with the following verified attributes:

| Parameter | Required Specification |
|:---|:---|
| **Sensor / Mission** | Sentinel-1 (C-band SAR), TerraSAR-X, ALOS-2 PALSAR (L-band), or equivalent open-source satellite. |
| **Acquisition Mode** | Interferometric Wide (IW) swath or Stripmap. |
| **Product Type** | Ground Range Detected (GRD) or Single Look Complex (SLC) amplitude render. |
| **Polarization** | Dual-polarization (VV + VH) preferred, or single-pol (VV). |
| **Format** | GeoTIFF (`.tif` / `.tiff`) with embedded CRS and pixel scale tags, or calibrated intensity raster. |
| **Source Dataset** | BigEarthNet-S1, Copernicus Open Access Hub, or ASF DAAC. |
| **License** | Open access (e.g. Creative Commons / Copernicus Open Access Policy). |
| **Co-Registration** | Must spatially correspond to the optical footprint of `tests/data/optical/sat_before.jpg`. |

---

## Fixture Metadata Schema

When the SAR image is acquired, place it at `tests/data/sar/sentinel1_sample.tif` and populate `tests/data/sar/sar_fixture_spec.json` with:

```json
{
  "dataset_source": "Copernicus Sentinel-1 / BigEarthNet-S1",
  "license": "CC-BY 4.0 / Copernicus Free and Open Access",
  "sensor": "Sentinel-1A C-SAR",
  "polarization": "VV+VH",
  "product_type": "GRD",
  "format": "GeoTIFF",
  "spatial_resolution_meters": 10.0,
  "co_registered_with_optical": true,
  "optical_reference_file": "tests/data/optical/sat_before.jpg",
  "acquisition_timestamp": "2026-05-15T06:22:00Z"
}
```
