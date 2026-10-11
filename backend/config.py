import os
from typing import Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable fallbacks."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Defaults to SQLite in development; required to be PostgreSQL in production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./satquery.db")
    TEST_DATABASE_URL: Optional[str] = "sqlite:///:memory:"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    CORS_ORIGINS: Optional[str] = None

    # JWT Authentication configuration (strictly required and validated in production)
    JWT_SECRET_KEY: Optional[str] = os.getenv("JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Frontend and Backend URLs
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://sat-query-ai-two.vercel.app")
    BACKEND_URL: str = os.getenv("BACKEND_URL", os.getenv("RENDER_EXTERNAL_URL", "https://satquery-ai-u3ls.onrender.com"))
    ALLOW_VERCEL_PREVIEWS: Optional[bool] = None

    @field_validator("ALLOW_VERCEL_PREVIEWS", mode="before")
    @classmethod
    def parse_allow_vercel_previews(cls, v: object) -> Optional[bool]:
        """Parse string or boolean values for ALLOW_VERCEL_PREVIEWS."""
        if v is None or v == "":
            return None
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ("true", "1", "yes", "on"):
                return True
            if v_lower in ("false", "0", "no", "off"):
                return False
        return bool(v) if not isinstance(v, bool) else v


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

    @property
    def is_production_grade(self) -> bool:
        """Check whether the current runtime environment is production-grade (production, staging, or cloud)."""
        env_clean = self.ENVIRONMENT.strip().lower()
        cloud_detected = any([
            os.getenv("RENDER") == "true",
            bool(os.getenv("RENDER_SERVICE_ID")),
            bool(os.getenv("RAILWAY_ENVIRONMENT")),
            bool(os.getenv("RAILWAY_PROJECT_ID")),
            bool(os.getenv("VERCEL")),
            bool(os.getenv("KUBERNETES_SERVICE_HOST")),
        ])
        return env_clean in ("production", "prod", "staging") or cloud_detected

    @model_validator(mode="after")
    def validate_environment_and_security(self) -> "Settings":
        """Validate production constraints, JWT security, and normalize database driver URLs."""
        env_clean = self.ENVIRONMENT.strip().lower()
        valid_environments = {
            "development", "dev", "local", "test", "testing",
            "staging", "production", "prod"
        }
        if env_clean not in valid_environments:
            raise ValueError(
                f"Invalid or misspelled ENVIRONMENT '{self.ENVIRONMENT}'. "
                f"Allowed environments are: 'development', 'test', 'staging', 'production'."
            )

        # Detect cloud hosting platforms (Render, Railway, Vercel, Kubernetes)
        cloud_detected = any([
            os.getenv("RENDER") == "true",
            bool(os.getenv("RENDER_SERVICE_ID")),
            bool(os.getenv("RAILWAY_ENVIRONMENT")),
            bool(os.getenv("RAILWAY_PROJECT_ID")),
            bool(os.getenv("VERCEL")),
            bool(os.getenv("KUBERNETES_SERVICE_HOST")),
        ])

        if cloud_detected and env_clean not in ("production", "prod", "staging"):
            raise ValueError(
                "Cloud hosting environment detected (Render/Railway/Vercel), but ENVIRONMENT is not set to 'production' or 'staging'. "
                "Cloud deployments must explicitly configure ENVIRONMENT=production or ENVIRONMENT=staging and a secure JWT_SECRET_KEY."
            )

        is_prod_grade = self.is_production_grade

        # 1. Normalize database URL for psycopg 3 driver (SQLAlchemy 2.x requirement)
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
        elif self.DATABASE_URL.startswith("postgresql://") and not self.DATABASE_URL.startswith("postgresql+"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

        # 2. Database validation: require postgresql+psycopg:// in production and staging; forbid SQLite and unknown schemes
        if is_prod_grade:
            if not self.DATABASE_URL.startswith("postgresql+psycopg://"):
                unsupported_scheme = (
                    self.DATABASE_URL.split("://")[0]
                    if "://" in self.DATABASE_URL
                    else ("(empty)" if not self.DATABASE_URL else self.DATABASE_URL.split(":")[0])
                )
                raise ValueError(
                    f"Production and staging environments require a PostgreSQL database with psycopg 3 driver "
                    f"(postgresql+psycopg://...). Received unsupported database scheme '{unsupported_scheme}'."
                )

        # 3. JWT Secret Key validation
        insecure_jwt_defaults = {
            "",
            "replace-with-a-random-secret",
            "satquery-insecure-dev-secret-key-32-chars-long",
            "satquery-dev-secret-key-for-local-testing-only-32ch",
            "changeme",
            "secret",
        }
        if is_prod_grade:
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY.strip() in insecure_jwt_defaults:
                raise ValueError(
                    "Production and staging environments require an explicitly configured, secure JWT_SECRET_KEY. "
                    "Known insecure defaults, development placeholders, and empty secrets are strictly prohibited."
                )
            if len(self.JWT_SECRET_KEY.strip()) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must be at least 32 characters long in production and staging."
                )
        else:
            # Development / testing fallback strictly for non-production environments
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY.strip() in insecure_jwt_defaults:
                self.JWT_SECRET_KEY = "satquery-dev-secret-key-for-local-testing-only-32ch"

        # 4. Resolve ALLOW_VERCEL_PREVIEWS default if not explicitly configured
        if self.ALLOW_VERCEL_PREVIEWS is None:
            # Default to False in production and staging; default to True in development and test
            self.ALLOW_VERCEL_PREVIEWS = False if is_prod_grade else True

        return self


settings = Settings()
