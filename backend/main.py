"""SatQuery-AI FastAPI Backend Application.

Main entry point providing the foundational API layer for SatQuery AI (SIH26167).
Provides:
  - GET  /api/health : Minimal health verification endpoint
  - POST /api/query  : Query ingestion endpoint connected to the Agent Orchestrator
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Ensure 'backend' and repo root are in python path for flexible execution
current_dir = Path(__file__).resolve().parent
repo_root = current_dir.parent
for path in [str(current_dir), str(repo_root)]:
    if path not in sys.path:
        sys.path.insert(0, path)

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.analyses import router as analyses_router
from backend.api.auth import router as auth_router
from backend.api.oauth import router as oauth_router
from backend.api.routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("satquery.backend")

# Initialize FastAPI Application
app = FastAPI(
    title="SatQuery AI - Backend API",
    description=(
        "FastAPI Backend for SatQuery AI: Interactive Vision-Language Assistant "
        "for Multimodal Remote Sensing Image Analysis through Text Queries."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware
# Allows frontend development servers (Vite default :5173, React :3000) and configurable origins
allowed_origins_env = os.getenv("CORS_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",  # Permissive for local hackathon development
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return clean, structured JSON responses on request validation errors."""
    errors = []
    for err in exc.errors():
        field_loc = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        errors.append({"field": field_loc, "message": msg})

    logger.warning("Validation error on %s: %s", request.url.path, errors)
    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "status": "error",
            "error_type": "validation_error",
            "detail": errors,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to prevent unhandled 500 crashes."""
    logger.exception("Unhandled server error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "error_type": "internal_server_error",
            "detail": "An unexpected internal server error occurred.",
        },
    )


# Root informational endpoint
@app.get("/", tags=["System"])
async def root():
    """System overview and documentation links."""
    return {
        "service": "SatQuery-AI Backend API",
        "status": "running",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": {
            "health": "GET /api/health",
            "query": "POST /api/query",
        },
    }


# Mount API Routers
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(analyses_router)
app.include_router(oauth_router)


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    logger.info("Starting SatQuery AI backend on %s:%s", host, port)
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
