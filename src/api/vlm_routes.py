"""FastAPI routes for SatQuery AI Vision-Language Model (VLM) mock endpoints.

Provides asynchronous POST endpoints for:
  - /vqa: Visual Question Answering on single remote-sensing imagery.
  - /grounding: Text-guided object grounding returning [ymin, xmin, ymax, xmax] bounding boxes.
  - /change-detection: Bi-temporal satellite change analysis with localized bounding boxes.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from src.models.gemini_vlm import default_gemini_service
from src.models.geochat_inference import predict_vqa_and_grounding
from src.models.change_detection import predict_bi_temporal_change


async def route_query(query: str, image_paths: list, parameters: Optional[Dict[str, Any]] = None) -> dict:
    """Route a query to the appropriate mock VLM function.

    If the query appears to request grounding (contains 'ground' or 'where'),
    the grounding mock is used; otherwise, VQA mock is used.
    """
    lowered = query.lower()
    img = image_paths[0] if image_paths else ""

    if parameters and parameters.get("use_real_vlm"):
        res = await default_gemini_service.async_vqa(image=img, query=query, **parameters)
        res["metadata"]["task"] = "single_image_vqa_real"
        res["metadata"]["device"] = "cuda"
        return res

    if "ground" in lowered or "where" in lowered:
        return await default_gemini_service.async_grounding(image=img, query=query)
    return await default_gemini_service.async_vqa(image=img, query=query, **(parameters or {}))

logger = logging.getLogger("satquery.api.vlm")

router = APIRouter(prefix="", tags=["VLM Endpoints"])


# -----------------------------------------------------------------------------
# Pydantic Schemas - Requests & Responses
# -----------------------------------------------------------------------------

class GroundingItem(BaseModel):
    """Localized detection item with normalized coordinates [ymin, xmin, ymax, xmax]."""

    label: str = Field(
        ...,
        description="Target class or detected entity name.",
        examples=["aircraft_narrow_body"],
    )
    box_2d: List[float] = Field(
        ...,
        description="Bounding box coordinates in [ymin, xmin, ymax, xmax] format normalized between 0.0 and 1.0.",
        examples=[[0.56, 0.38, 0.60, 0.42]],
        min_length=4,
        max_length=4,
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for this detection (0.0 to 1.0).",
        examples=[0.95],
    )
    description: Optional[str] = Field(
        None,
        description="Optional human-readable description of the detected region.",
        examples=["Grounded region for aircraft_narrow_body with normalized coordinates [ymin, xmin, ymax, xmax]."],
    )


class ChangeItem(BaseModel):
    """Localized change detection item between two satellite timestamps."""

    change_type: str = Field(
        ...,
        description="Categorical label of observed change.",
        examples=["new_commercial_construction"],
    )
    box_2d: List[float] = Field(
        ...,
        description="Bounding box [ymin, xmin, ymax, xmax] highlighting the change region.",
        examples=[[0.25, 0.30, 0.44, 0.58]],
        min_length=4,
        max_length=4,
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence score for the detected change.",
        examples=[0.96],
    )
    description: str = Field(
        ...,
        description="Detailed description of what changed in this region.",
        examples=["Erection of two large warehouse/distribution structures on previously cleared brownfield."],
    )


class QuantifiedMetrics(BaseModel):
    """Deterministic or estimated geospatial change metrics."""

    built_up_area_change_pct: float = Field(..., description="Percentage change in impervious/built-up surface.", examples=[14.8])
    vegetation_loss_pct: float = Field(..., description="Percentage change in vegetative cover (negative indicates loss).", examples=[-8.6])
    water_surface_change_pct: float = Field(..., description="Percentage change in visible water surface area.", examples=[0.0])
    total_modified_area_hectares: float = Field(..., description="Estimated modified land area in hectares.", examples=[18.2])
    change_intensity: str = Field(..., description="Descriptive classification of change magnitude.", examples=["moderate-high"])


# --- VQA Schemas ---

class VQARequest(BaseModel):
    """Request payload for Visual Question Answering."""

    image: str = Field(
        ...,
        description="Satellite image as base64-encoded string, accessible HTTP/HTTPS URL, or local filepath.",
        examples=["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."],
    )
    query: str = Field(
        ...,
        min_length=1,
        description="Natural language question regarding the satellite image.",
        examples=["What types of land cover and infrastructure are visible in this scene?"],
    )
    parameters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional execution parameters (e.g. temperature, max_tokens, sensor_type).",
        examples=[{"sensor_type": "Sentinel-2", "spectral_bands": ["B02", "B03", "B04", "B08"]}],
    )


class VQAResponse(BaseModel):
    """Response payload returned by VQA endpoint."""

    query: str = Field(..., description="Echo of input question.")
    answer: str = Field(..., description="Synthesized natural language answer from remote-sensing VLM.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall answer confidence score.")
    bounding_boxes: List[GroundingItem] = Field(
        default_factory=list,
        description="Key regions of interest referenced in the visual answer.",
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Observable reasoning tokens, spectral signatures, or geometric evidence.",
    )
    metadata: Dict[str, Any] = Field(
        ...,
        description="Trace metadata including model version, timestamp, and execution trace.",
    )


# --- Grounding Schemas ---

class GroundingRequest(BaseModel):
    """Request payload for Text-Guided Object Grounding."""

    image: str = Field(
        ...,
        description="Satellite image as base64-encoded string, accessible URL, or local filepath.",
        examples=["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."],
    )
    query: str = Field(
        ...,
        min_length=1,
        description="Target class or descriptive text query to ground in the scene.",
        examples=["Where are the aircraft and primary runway?"],
    )
    confidence_threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold to include detected bounding boxes.",
        examples=[0.5],
    )
    target_classes: Optional[List[str]] = Field(
        default=None,
        description="Optional list of specific classes to filter or guide grounding.",
        examples=[["aircraft", "runway"]],
    )


class GroundingResponse(BaseModel):
    """Response payload returned by Grounding endpoint."""

    query: str = Field(..., description="Echo of grounding prompt.")
    detected_objects: List[GroundingItem] = Field(
        ...,
        description="List of detected objects with [ymin, xmin, ymax, xmax] bounding boxes and confidence scores.",
    )
    total_detected: int = Field(..., description="Number of detected objects above threshold.")
    summary: str = Field(..., description="High-level text summary of grounding results.")
    coordinate_format: str = Field(
        default="[ymin, xmin, ymax, xmax] normalized to [0.0, 1.0]",
        description="Definition of bounding box coordinate ordering.",
    )
    metadata: Dict[str, Any] = Field(..., description="Execution trace and inference metadata.")


# --- Change Detection Schemas ---

class ChangeDetectionRequest(BaseModel):
    """Request payload for Bi-temporal Change Detection."""

    image_before: str = Field(
        ...,
        description="Baseline satellite image (Time T1) as base64, URL, or local path.",
        examples=["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."],
    )
    image_after: str = Field(
        ...,
        description="Follow-up satellite image (Time T2) as base64, URL, or local path.",
        examples=["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."],
    )
    query: Optional[str] = Field(
        default="What changed between these two images?",
        description="Specific question or focal prompt for change detection.",
        examples=["What infrastructure or land-cover changes occurred between these two acquisitions?"],
    )
    threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for localized change detections.",
        examples=[0.5],
    )


class ChangeDetectionResponse(BaseModel):
    """Response payload returned by Change Detection endpoint."""

    query: str = Field(..., description="Change analysis prompt.")
    summary: str = Field(..., description="Comprehensive natural-language summary of bi-temporal differences.")
    detected_changes: List[ChangeItem] = Field(
        ...,
        description="List of localized changed zones with [ymin, xmin, ymax, xmax] coordinates.",
    )
    total_changes: int = Field(..., description="Count of detected change areas meeting threshold.")
    quantified_metrics: QuantifiedMetrics = Field(
        ...,
        description="Geospatial estimations including area changes and modified hectares.",
    )
    compatibility_verified: bool = Field(
        ...,
        description="Whether spatial co-registration and resolution compatibility were verified.",
    )
    change_mask_matrix: Optional[List[List[int]]] = Field(
        default=None,
        description="2D binary matrix (H x W) representation of pixel-level change areas.",
    )
    change_mask_base64: Optional[str] = Field(
        default=None,
        description="Base64 encoded PNG overlay mask of the detected changes.",
    )
    mask_dimensions: Optional[Dict[str, int]] = Field(
        default=None,
        description="Dimensions of the change mask (rows and cols).",
    )
    coregistration: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Co-registration alignment diagnostics and verification scores.",
    )
    coordinate_format: str = Field(
        default="[ymin, xmin, ymax, xmax] normalized to [0.0, 1.0]",
        description="Definition of bounding box coordinate ordering.",
    )
    metadata: Dict[str, Any] = Field(..., description="Trace metadata, sensor pair details, and audit steps.")


# -----------------------------------------------------------------------------
# Asynchronous Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/vqa",
    response_model=VQAResponse,
    status_code=status.HTTP_200_OK,
    summary="Visual Question Answering (VQA)",
    description="Analyzes a remote-sensing satellite image using natural-language questions and returns an asynchronous reasoned answer with evidence.",
)
async def vqa_endpoint(request: VQARequest) -> VQAResponse:
    """Execute asynchronous Visual Question Answering against mock VLM."""
    if not request.image or not request.image.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'image' must not be empty.",
        )
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'query' must not be empty.",
        )

    try:
        result = await route_query(query=request.query, image_paths=[request.image], parameters=request.parameters)
        
        # When route_query delegates to grounding, it returns "detected_objects" instead of "bounding_boxes".
        boxes_data = result.get("bounding_boxes", []) or result.get("detected_objects", [])
        
        # Convert RemoteSensingVLM dict to VQAResponse model
        return VQAResponse(
            query=request.query,
            answer=result.get("answer", result.get("summary", "")),
            confidence=result.get("confidence", 1.0),
            bounding_boxes=[GroundingItem(**box) for box in boxes_data],
            evidence=result.get("evidence", []),
            metadata=result.get("metadata", {}),
        )
    except Exception as exc:
        logger.exception("Error in /vqa endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VQA prediction error: {str(exc)}",
        ) from exc


@router.post(
    "/predict",
    status_code=status.HTTP_200_OK,
    summary="Real VLM Inference (GeoChat)",
    description="Directly executes GeoChat Vision-Language inference with visual grounding on remote sensing imagery.",
)
async def predict_endpoint(request: VQARequest) -> Dict[str, Any]:
    """Execute GeoChat VQA and Grounding inference pipeline."""
    if not request.image or not request.image.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'image' must not be empty.",
        )
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'query' must not be empty.",
        )

    try:
        return await run_in_threadpool(
            predict_vqa_and_grounding,
            image_path=request.image,
            prompt=request.query,
            **(request.parameters or {}),
        )
    except Exception as exc:
        logger.exception("Error in /predict endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VLM prediction error: {str(exc)}",
        ) from exc


@router.post(
    "/grounding",
    response_model=GroundingResponse,
    status_code=status.HTTP_200_OK,
    summary="Text-Guided Grounding",
    description="Locates entities described in query and returns normalized bounding box coordinates [ymin, xmin, ymax, xmax] with confidence scores.",
)
async def grounding_endpoint(request: GroundingRequest) -> GroundingResponse:
    """Execute asynchronous Text-Guided Grounding against mock VLM."""
    if not request.image or not request.image.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'image' must not be empty.",
        )
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'query' must not be empty.",
        )

    try:
        response_dict = await default_gemini_service.async_grounding(
            image=request.image,
            query=request.query,
            confidence_threshold=request.confidence_threshold,
            target_classes=request.target_classes,
        )
        return GroundingResponse(**response_dict)
    except Exception as exc:
        logger.exception("Error in /grounding endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grounding mock prediction error: {str(exc)}",
        ) from exc


@router.post(
    "/change-detection",
    response_model=ChangeDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Bi-Temporal Change Detection",
    description="Compares satellite images across two timestamps (T1 vs T2), detecting localized changes with bounding boxes [ymin, xmin, ymax, xmax] and quantified metrics.",
)
async def change_detection_endpoint(request: ChangeDetectionRequest) -> ChangeDetectionResponse:
    """Execute asynchronous Bi-temporal Change Detection against mock VLM."""
    if not request.image_before or not request.image_before.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'image_before' must not be empty.",
        )
    if not request.image_after or not request.image_after.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field 'image_after' must not be empty.",
        )

    try:
        use_deltavlm = (
            (request.query and "mock" not in request.query.lower())
            and os.getenv("SATQUERY_USE_MOCK_CHANGE", "false").lower() != "true"
        )
        if use_deltavlm:
            change_result = await run_in_threadpool(
                predict_bi_temporal_change,
                image_before_path=request.image_before,
                image_after_path=request.image_after,
                query=request.query,
                coregistration_threshold=request.threshold,
            )
            return ChangeDetectionResponse(**change_result)

        response_dict = await default_gemini_service.async_change_detection(
            image_before=request.image_before,
            image_after=request.image_after,
            query=request.query,
            threshold=request.threshold,
        )
        return ChangeDetectionResponse(**response_dict)
    except Exception as exc:
        logger.exception("Error in /change-detection endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Change detection prediction error: {str(exc)}",
        ) from exc
