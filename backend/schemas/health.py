"""Health check schemas."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(
        default="healthy",
        description="Current health status of the backend service",
        examples=["healthy", "operational"],
    )
    service: str = Field(
        default="satquery-api",
        description="Service identifier",
    )
    version: str = Field(
        default="0.1.0",
        description="Current API version",
    )
