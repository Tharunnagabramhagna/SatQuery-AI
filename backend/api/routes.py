"""FastAPI routes for SatQuery API."""

import logging
from fastapi import APIRouter, HTTPException, status

from backend.agents.orchestrator import orchestrator
from backend.schemas.health import HealthResponse
from backend.schemas.query import QueryRequest, QueryResponse

logger = logging.getLogger("satquery.api")

router = APIRouter(prefix="/api", tags=["SatQuery"])


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
