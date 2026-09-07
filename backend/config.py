"""Centralized configuration for SatQuery backend."""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env."""

    DATABASE_URL: str
    TEST_DATABASE_URL: Optional[str] = None
    CORS_ORIGINS: Optional[str] = None

    # JWT Authentication configuration
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # OpenAI configuration
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_VQA_MODEL: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
