"""FastAPI routes for SatQuery API."""

import logging
import os
import shutil
import tempfile
import uuid as uuid_module
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.agents.orchestrator import orchestrator
from backend.db.models import Analysis, User
from backend.db.session import get_db
from backend.schemas.frontend import FrontendAnalysisResponse
from backend.schemas.health import HealthResponse
from backend.schemas.query import QueryRequest, QueryResponse
from backend.security import get_optional_current_user

logger = logging.getLogger("satquery.api")

router = APIRouter(prefix="/api", tags=["SatQuery"])

# Accepted image file extensions for /api/analysis multipart upload
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check endpoint",
    description="Returns current service status to verify backend is active and responsive.",
)
async def health_check() -> HealthResponse:
    """Check backend service health."""
    return HealthResponse(
        status="healthy",
        service="satquery-api",
        version="0.1.0",
    )


@router.post(
    "/query",
    response_model=QueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Process natural-language remote sensing query",
    description=(
        "Entry point for natural-language satellite queries. "
        "Dispatches query to Agent Orchestrator pipeline. "
        "In Block 1, validates and acknowledges receipt with status."
    ),
)
async def process_query_endpoint(request: QueryRequest) -> QueryResponse:
    """
    Handle natural language satellite query.

    Flow:
        POST /api/query -> QueryRequest validation -> Agent Orchestrator -> QueryResponse
    """
    try:
        result = await orchestrator.process_query(
            query=request.query,
            before_image=request.before_image,
            after_image=request.after_image,
            parameters=request.parameters,
            before_image_modality=request.before_image_modality,
            after_image_modality=request.after_image_modality,
        )
        return QueryResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error while processing query: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the query: {str(exc)}",
        ) from exc


def _validate_upload_extension(file: UploadFile) -> str:
    """Validate uploaded file has an allowed extension. Returns the extension.

    Raises:
        HTTPException: if the file type is not in ALLOWED_IMAGE_EXTENSIONS.
    """
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                f"Unsupported image file type '{ext}' for file '{filename}'. "
                f"Accepted formats: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}"
            ),
        )
    return ext


async def _save_upload_to_temp(file: UploadFile, temp_dir: str, prefix: str) -> str:
    """Save an UploadFile to a controlled temporary directory. Returns the temp file path."""
    ext = _validate_upload_extension(file)
    temp_path = os.path.join(temp_dir, f"{prefix}{ext}")
    contents = await file.read()
    with open(temp_path, "wb") as f:
        f.write(contents)
    return temp_path


@router.post(
    "/analysis",
    status_code=status.HTTP_200_OK,
    summary="Frontend-compatible multipart analysis endpoint",
    description=(
        "Accepts multipart/form-data with image file uploads for frontend integration. "
        "Routes through the existing Query Understanding → Agent Router → Tool Executor pipeline. "
        "Returns a camelCase response matching the frontend AnalysisResponse type. "
        "Supports optional JWT Bearer authentication for analysis persistence."
    ),
)
async def frontend_analysis_endpoint(
    query: str = Form(..., description="Natural language query for satellite analysis"),
    mode: Optional[str] = Form(default=None, description="Frontend analysis mode hint (e.g. compare_images)"),
    capability: Optional[str] = Form(default=None, description="Frontend capability hint (e.g. change_detection)"),
    before_image: Optional[UploadFile] = None,
    after_image: Optional[UploadFile] = None,
    before_modality: Optional[str] = Form(default=None, description="Modality hint for baseline image (optical | sar | unknown)"),
    after_modality: Optional[str] = Form(default=None, description="Modality hint for follow-up image (optical | sar | unknown)"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Frontend-compatible analysis endpoint with optional authentication.

    Accepts multipart file uploads, saves to temp directory, runs through
    the existing orchestrator pipeline, and returns a camelCase response.

    Authentication behavior:
        - No Authorization header: anonymous analysis, no persistence.
        - Valid Bearer token: analysis persisted with user ownership.
        - Invalid Bearer token: HTTP 401 (not silently anonymous).

    Persistence failure behavior:
        - If DB commit fails for an authenticated request, HTTP 500 is returned.
        - The client does NOT receive a successful analysisId that doesn't exist in the DB.

    Flow:
        POST /api/analysis (multipart) → temp file save → orchestrator.process_query()
        → FrontendAnalysisResponse adapter → persist if authenticated → camelCase JSON
    """
    # Validate query is not empty
    query_stripped = query.strip()
    if not query_stripped:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Query string cannot be empty or contain only whitespace.",
        )

    temp_dir = tempfile.mkdtemp(prefix="satquery_upload_")
    before_path: Optional[str] = None
    after_path: Optional[str] = None

    try:
        # Save uploaded files to controlled temp directory
        if before_image is not None and before_image.filename:
            before_path = await _save_upload_to_temp(before_image, temp_dir, "before")

        if after_image is not None and after_image.filename:
            after_path = await _save_upload_to_temp(after_image, temp_dir, "after")

        # Run through the existing orchestrator pipeline
        result = await orchestrator.process_query(
            query=query_stripped,
            before_image=before_path,
            after_image=after_path,
            parameters=None,
            before_image_modality=before_modality,
            after_image_modality=after_modality,
        )

        # Transform to frontend-compatible response
        frontend_response = FrontendAnalysisResponse.from_orchestrator_result(result)
        response_dict = frontend_response.model_dump(by_alias=True)

        # Persist analysis for authenticated users
        if current_user is not None:
            try:
                analysis_record = Analysis(
                    id=uuid_module.UUID(frontend_response.analysis_id),
                    user_id=current_user.id,
                    query=query_stripped,
                    mode=mode,
                    capability=capability,
                    status=frontend_response.status,
                    response_json=response_dict,
                )
                db.add(analysis_record)
                db.commit()
                logger.info(
                    "Persisted analysis id=%s for user id=%s",
                    frontend_response.analysis_id,
                    current_user.id,
                )
            except Exception as exc:
                db.rollback()
                logger.error(
                    "Failed to persist analysis for user id=%s: %s",
                    current_user.id,
                    type(exc).__name__,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Analysis completed but could not be saved. Please try again.",
                ) from exc

        return JSONResponse(content=response_dict)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error in /api/analysis: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the analysis: {str(exc)}",
        ) from exc
    finally:
        # Always clean up temporary files
        if os.path.isdir(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.debug("Cleaned up temp directory: %s", temp_dir)
