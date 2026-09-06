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
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: Optional[str] = None

    # JWT Authentication configuration (secrets must be provided via environment / .env)
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Frontend and Backend URLs
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # SMTP / Email Delivery configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@satquery.ai"
    SMTP_FROM_NAME: str = "SatQuery AI"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # Google OAuth 2.0 / OIDC configuration
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None

    # Facebook OAuth configuration
    FACEBOOK_APP_ID: Optional[str] = None
    FACEBOOK_APP_SECRET: Optional[str] = None
    FACEBOOK_REDIRECT_URI: Optional[str] = None

    # Email verification parameters
    EMAIL_VERIFY_EXPIRE_MINUTES: int = 15
    EMAIL_VERIFY_MAX_ATTEMPTS: int = 5
    EMAIL_RESEND_COOLDOWN_SECONDS: int = 60

    # OAuth one-time exchange code expiration (seconds)
    OAUTH_EXCHANGE_CODE_EXPIRE_SECONDS: int = 120

    # Google Gemini Query Understanding configuration
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_TIMEOUT_SECONDS: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
