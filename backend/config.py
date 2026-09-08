import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable fallbacks."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Defaults to SQLite if PostgreSQL DATABASE_URL is not configured
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./satquery.db")
    TEST_DATABASE_URL: Optional[str] = "sqlite:///:memory:"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    CORS_ORIGINS: Optional[str] = None

    # JWT Authentication configuration (override in production via environment / .env)
    JWT_SECRET_KEY: str = "satquery-insecure-dev-secret-key-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Frontend and Backend URLs
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://sat-query-ai-two.vercel.app")
    BACKEND_URL: str = os.getenv("RENDER_EXTERNAL_URL", os.getenv("BACKEND_URL", "https://satquery-ai-u3ls.onrender.com"))


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

    # Ollama / Local Qwen Fallback configuration (optional local fallback when Gemini is unavailable)
    # Timeouts are initial safe upper bounds based on local laptop benchmarking on Intel iGPU (Vulkan);
    # they are fully configurable via environment variables.
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen-satquery"
    OLLAMA_VQA_TIMEOUT_SECONDS: float = 90.0
    OLLAMA_COMPARISON_TIMEOUT_SECONDS: float = 150.0
    ENABLE_OLLAMA_FALLBACK: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
