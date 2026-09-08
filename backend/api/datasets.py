"""Datasets API and Scenario Ingestion for SatQuery AI.

Provides endpoints for:
- GET  /api/datasets : List available satellite datasets & curated scenarios
- POST /api/datasets/upload : Upload and safely extract ZIP datasets of satellite images
- GET  /api/datasets/{dataset_id} : Get metadata and images for a specific dataset
"""

from __future__ import annotations

import logging
import os
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger("satquery.api.datasets")

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

DATA_DIR = Path("data").resolve()
UPLOADS_DIR = DATA_DIR / "uploads"
RAW_DIR = DATA_DIR / "raw"

# Ensure data directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_DATASET_ARCHIVE_EXTS = {".zip"}
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}
MAX_DATASET_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB per ZIP upload


class DatasetScenarioResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    description: str
    modality: str = "optical"
    capability: str = "grounding"
    mode: str = "single_image"
    dataset_name: Optional[str] = Field(default=None, alias="datasetName")
    tags: List[str] = Field(default_factory=list)
    image_url: Optional[str] = Field(default=None, alias="imageUrl")
    before_image_url: Optional[str] = Field(default=None, alias="beforeImageUrl")
    after_image_url: Optional[str] = Field(default=None, alias="afterImageUrl")
    suggested_queries: List[str] = Field(default_factory=list, alias="suggestedQueries")
    expected_observation: Optional[str] = Field(default=None, alias="expectedObservation")
    ground_truth_count: Optional[int] = Field(default=None, alias="groundTruthCount")


class DatasetUploadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: str = Field(..., alias="datasetId")
    name: str
    total_images: int = Field(..., alias="totalImages")
    image_paths: List[str] = Field(default_factory=list, alias="imagePaths")
    message: str


# Default curated benchmark scenarios (SIH26167 compliant)
BUILTIN_SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "scenario-maritime-01",
        "title": "Port of Rotterdam - Vessel Traffic & Berth Allocation",
        "description": "High-resolution optical satellite imagery of Maasvlakte terminal for container ship grounding and logistics analysis.",
        "modality": "optical",
        "capability": "grounding",
        "mode": "single_image",
        "datasetName": "SpaceNet 8 / OpenSatMap",
        "tags": ["maritime", "vessels", "grounding", "optical"],
        "imageUrl": "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80",
        "suggestedQueries": [
            "Detect and segment all cargo container vessels berthed along the northern pier.",
            "Count the number of active cranes and fuel storage tanks.",
        ],
        "expectedObservation": "Identifies 4 large cargo vessels with segmentation masks and 9 fuel tanks.",
        "groundTruthCount": 13,
    },
    {
        "id": "scenario-change-urban-01",
        "title": "East Austin Urban Expansion & Construction (2020 vs 2024)",
        "description": "Bi-temporal optical scene pair measuring rapid suburban expansion, new residential zoning, and vegetation displacement.",
        "modality": "optical",
        "capability": "change_detection",
        "mode": "compare_images",
        "datasetName": "LEVIR-CD+ / Sentinel-2",
        "tags": ["urban", "change-detection", "bi-temporal", "construction"],
        "beforeImageUrl": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
        "afterImageUrl": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
        "suggestedQueries": [
            "Quantify urban expansion and residential construction between before and after scenes.",
            "Highlight areas of forest clearing and new road infrastructure.",
        ],
        "expectedObservation": "Highlights 18.4% total change with +12% built-up surface area.",
    },
    {
        "id": "scenario-sar-flood-01",
        "title": "Brahmaputra Basin Monsoon Flood Inundation (SAR Sentinel-1)",
        "description": "Synthetic Aperture Radar (SAR) imagery penetrating cloud cover to map flood extent and submerged agricultural land.",
        "modality": "sar",
        "capability": "vqa",
        "mode": "single_image",
        "datasetName": "Sentinel-1 GRD SAR",
        "tags": ["sar", "flood", "disaster-response", "vqa"],
        "imageUrl": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80",
        "suggestedQueries": [
            "What percentage of the agricultural zone is submerged by flood water?",
            "Identify transportation corridors at risk of water logging.",
        ],
        "expectedObservation": "Delineates low-backscatter flood water bodies over 34% of the scene.",
    },
]


def _scan_local_dataset_images() -> List[DatasetScenarioResponse]:
    """Scan data/ directory to discover uploaded or locally placed satellite images."""
    discovered: List[DatasetScenarioResponse] = []
    
    for base_dir in [UPLOADS_DIR, RAW_DIR]:
        if not base_dir.exists():
            continue
        for subpath in base_dir.rglob("*"):
            if subpath.is_file() and subpath.suffix.lower() in ALLOWED_IMAGE_EXTS:
                rel_path = subpath.relative_to(DATA_DIR)
                name_clean = subpath.stem.replace("_", " ").title()
                discovered.append(
                    DatasetScenarioResponse(
                        id=f"local-{subpath.name}",
                        title=f"{name_clean} (Local Image)",
                        description=f"Locally ingested satellite image located at {rel_path}.",
                        modality="optical",
                        capability="grounding",
                        mode="single_image",
                        datasetName=subpath.parent.name or "Local Dataset",
                        tags=["local", "custom-dataset", subpath.suffix.replace(".", "")],
                        imageUrl=f"/data/{rel_path}",
                        suggestedQueries=[
                            f"Detect all objects and land features in {name_clean}.",
                            "Perform spectral and structural visual grounding.",
                        ],
                    )
                )
    return discovered


@router.get(
    "",
    response_model=List[DatasetScenarioResponse],
    status_code=status.HTTP_200_OK,
    summary="List satellite datasets and scenarios",
)
def list_datasets() -> List[DatasetScenarioResponse]:
    """Return both built-in benchmark scenarios and dynamically discovered local datasets."""
    results = [DatasetScenarioResponse(**s) for s in BUILTIN_SCENARIOS]
    local_items = _scan_local_dataset_images()
    results.extend(local_items)
    return results


@router.post(
    "/upload",
    response_model=DatasetUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a ZIP dataset of satellite images",
)
async def upload_dataset_zip(
    file: UploadFile = File(..., description="ZIP archive of satellite images (PNG, JPG, GeoTIFF)"),
) -> DatasetUploadResponse:
    """Safely unpacks a ZIP dataset, validates images, and indexes them for 1-click analysis."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_DATASET_ARCHIVE_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only .zip archives are supported.",
        )

    dataset_name = os.path.splitext(file.filename)[0].strip().replace(" ", "_") or "dataset"
    dataset_id = f"{dataset_name}_{uuid.uuid4().hex[:8]}"
    target_extract_dir = UPLOADS_DIR / dataset_id

    try:
        target_extract_dir.mkdir(parents=True, exist_ok=True)
        contents = await file.read()

        if len(contents) > MAX_DATASET_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"ZIP file exceeds maximum upload size of {MAX_DATASET_UPLOAD_BYTES // (1024 * 1024)}MB.",
            )

        # Temporary ZIP path
        temp_zip_path = target_extract_dir / "archive.zip"
        with open(temp_zip_path, "wb") as f:
            f.write(contents)

        extracted_images: List[str] = []
        with zipfile.ZipFile(temp_zip_path, "r") as zf:
            for member in zf.infolist():
                # Prevent Zip-Slip directory traversal attack
                member_path = Path(member.filename)
                if member_path.is_absolute() or ".." in member_path.parts:
                    logger.warning("Skipping suspicious zip member path: %s", member.filename)
                    continue

                if member.is_dir():
                    continue

                if member_path.suffix.lower() in ALLOWED_IMAGE_EXTS:
                    dest_file = target_extract_dir / member_path.name
                    with zf.open(member) as src, open(dest_file, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    extracted_images.append(dest_file.name)

        # Clean up the zip file itself
        if temp_zip_path.exists():
            temp_zip_path.unlink()

        if not extracted_images:
            shutil.rmtree(target_extract_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No supported satellite image files (.png, .jpg, .tif) found in the ZIP archive.",
            )

        logger.info(
            "Successfully ingested dataset '%s' with %d images.",
            dataset_name,
            len(extracted_images),
        )

        return DatasetUploadResponse(
            datasetId=dataset_id,
            name=dataset_name,
            totalImages=len(extracted_images),
            imagePaths=extracted_images,
            message=f"Successfully ingested {len(extracted_images)} satellite scenes from dataset.",
        )

    except HTTPException:
        raise
    except Exception as exc:
        shutil.rmtree(target_extract_dir, ignore_errors=True)
        logger.exception("Failed to ingest dataset archive: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process dataset archive: {str(exc)}",
        ) from exc
