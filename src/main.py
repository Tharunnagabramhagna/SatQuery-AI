"""Main FastAPI application entrypoint for SatQuery AI (SIH26167).

Mounts the Vision-Language Model (VLM) mock routes and provides core application
middleware (CORS, logging) for Backend, Agent, and Frontend developers.
"""

from __future__ import annotations

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.vlm_routes import router as vlm_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("satquery.app")

app = FastAPI(
    title="SatQuery AI - Vision-Language Assistant API",
    description=(
        "API for SatQuery AI (SIH26167): An Interactive Vision-Language Assistant for "
        "Multimodal Remote Sensing Image Analysis through Text Queries. "
        "Provides asynchronous endpoints for Visual Question Answering (VQA), "
        "Text-Guided Grounding [ymin, xmin, ymax, xmax], and Bi-Temporal Change Detection."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend and cross-origin agents
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount VLM Router
app.include_router(vlm_router)


@app.get("/", tags=["System"])
async def root():
    """Root endpoint providing system metadata and available documentation."""
    return {
        "project": "SatQuery AI",
        "problem_statement": "SIH26167 - Interactive Vision-Language Assistant for Remote Sensing",
        "version": "0.1.0",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "vqa": "POST /vqa",
            "grounding": "POST /grounding",
            "change_detection": "POST /change-detection",
            "health": "GET /health",
        },
    }


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for container orchestrators and monitoring agents."""
    return {
        "status": "healthy",
        "service": "satquery-vlm-api",
        "mock_vlm_ready": True,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
