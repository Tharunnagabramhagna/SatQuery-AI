"""Centralized configuration for SatQuery backend.

Loads settings from environment variables and optional .env file.
Keeps configuration minimal and focused for PostgreSQL database integration.
"""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable fallbacks."""

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/satquery"
    TEST_DATABASE_URL: Optional[str] = "postgresql+psycopg://postgres:postgres@localhost:5432/satquery_test"
    CORS_ORIGINS: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
