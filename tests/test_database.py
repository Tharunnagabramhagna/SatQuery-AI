"""Database foundation tests for Phase 4A.

Tests:
- Configuration validation (DATABASE_URL, TEST_DATABASE_URL)
- Model metadata, types, constraints, and cascade definitions
- Safe database connectivity checking
- Alembic configuration and migration script validity
- Live PostgreSQL migration and CRUD on the dedicated `satquery_test` database
"""

import uuid
import pytest
from sqlalchemy import JSON, create_engine, inspect, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, sessionmaker

from alembic.config import Config
from alembic.script import ScriptDirectory

from backend.config import Settings, settings
from backend.db.base import Base
from backend.db.models import Analysis, User
from backend.db.session import check_db_connectivity


# ─── 1. Configuration Tests ──────────────────────────────────────────────────

def test_database_configuration_loads():
    """Verify Settings loads DATABASE_URL and TEST_DATABASE_URL properly."""
    cfg = Settings()
    assert cfg.DATABASE_URL is not None
    assert "postgresql" in cfg.DATABASE_URL
    assert "psycopg" in cfg.DATABASE_URL
    assert cfg.TEST_DATABASE_URL is not None
    assert "satquery_test" in cfg.TEST_DATABASE_URL


def test_test_database_url_differs_from_development_url():
    """Verify test database is strictly separated from development database."""
    assert settings.DATABASE_URL != settings.TEST_DATABASE_URL
    assert "satquery_test" in settings.TEST_DATABASE_URL
    assert "satquery_test" not in settings.DATABASE_URL


# ─── 2. Model Metadata & Schema Tests ────────────────────────────────────────

def test_sqlalchemy_models_import_and_register():
    """Verify Base.metadata contains both users and analyses tables."""
    table_names = set(Base.metadata.tables.keys())
    assert "users" in table_names
    assert "analyses" in table_names


def test_user_table_metadata():
    """Verify users table structure, column types, and constraints."""
    table = Base.metadata.tables["users"]
    col_names = {c.name for c in table.columns}
    assert {"id", "email", "password_hash", "display_name", "created_at", "updated_at"}.issubset(col_names)

    # Primary key must be id (UUID)
    assert table.c.id.primary_key is True
    assert table.c.email.nullable is False
    assert table.c.password_hash.nullable is True  # nullable to support OAuth social signups
    assert table.c.display_name.nullable is True
    assert table.c.email_verified.nullable is False

    # Unique constraint or index on email
    email_unique = any(
        (c.unique for c in table.columns if c.name == "email")
    ) or any(
        (idx.unique and "email" in [col.name for col in idx.columns]) for idx in table.indexes
    )
    assert email_unique is True


def test_analysis_table_metadata():
    """Verify analyses table structure, foreign keys, and column types."""
    table = Base.metadata.tables["analyses"]
    col_names = {c.name for c in table.columns}
    assert {"id", "user_id", "query", "mode", "capability", "status", "response_json", "created_at"}.issubset(col_names)

    assert table.c.id.primary_key is True
    assert table.c.user_id.nullable is True  # nullable for anonymous/demo queries
    assert table.c.query.nullable is False

    # Foreign key to users.id
    fks = list(table.c.user_id.foreign_keys)
    assert len(fks) == 1
    fk = fks[0]
    assert fk.target_fullname == "users.id"
    assert fk.ondelete.upper() == "CASCADE"

    # response_json must use PostgreSQL JSONB or JSON
    assert isinstance(table.c.response_json.type, (JSONB, JSON))


def test_relationship_and_cascade_definitions():
    """Verify User.analyses and Analysis.user relationships."""
    user_mapper = inspect(User)
    analysis_mapper = inspect(Analysis)

    # User -> analyses relationship
    assert "analyses" in user_mapper.relationships
    rel_analyses = user_mapper.relationships["analyses"]
    assert rel_analyses.cascade.delete_orphan is True
    assert rel_analyses.passive_deletes is True

    # Analysis -> user relationship
    assert "user" in analysis_mapper.relationships


# ─── 3. Database Connectivity Check Tests ────────────────────────────────────

def test_check_db_connectivity_with_active_database(test_engine):
    """Verify check_db_connectivity returns True when given a healthy engine."""
    assert check_db_connectivity(target_engine=test_engine) is True


def test_check_db_connectivity_fails_gracefully_on_invalid_url():
    """Verify check_db_connectivity returns False without crashing on dead host."""
    bad_engine = create_engine(
        "postgresql+psycopg://baduser:badpass@127.0.0.1:54999/nonexistent",
        connect_args={"connect_timeout": 1},
    )
    result = check_db_connectivity(target_engine=bad_engine, timeout=1.0)
    assert result is False


# ─── 4. Alembic Configuration Tests ──────────────────────────────────────────

def test_alembic_config_and_migrations_exist():
    """Verify alembic.ini and migration scripts load correctly."""
    alembic_cfg = Config("alembic.ini")
    script_dir = ScriptDirectory.from_config(alembic_cfg)

    # Verify head revision is 0001_initial_schema
    revisions = [rev.revision for rev in script_dir.walk_revisions()]
    assert "0001_initial_schema" in revisions


# ─── 5. Database Integration Tests ───────────────────────────────────────────

@pytest.fixture(scope="module")
def test_db_session(test_engine):
    """Fixture providing a clean session connected to test database."""
    TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = TestSession()

    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_live_postgres_crud_and_cascade(test_db_session: Session):
    """Test full CRUD operations and ON DELETE CASCADE on satquery_test."""
    # 1. Insert User
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=test_email,
        password_hash="argon2id$mock_hash_for_testing",
        display_name="Test Earth Observer",
    )
    test_db_session.add(user)
    test_db_session.commit()
    test_db_session.refresh(user)

    assert isinstance(user.id, uuid.UUID)
    assert user.email == test_email
    assert user.created_at is not None

    # 2. Insert Analysis linked to User
    analysis = Analysis(
        user_id=user.id,
        query="What changed between 2020 and 2024?",
        mode="compare_images",
        capability="change_detection",
        status="completed",
        response_json={
            "change_percentage": 33.78,
            "detected_clusters": 2,
            "confidence": 0.1451,
        },
    )
    test_db_session.add(analysis)
    test_db_session.commit()
    test_db_session.refresh(analysis)

    assert isinstance(analysis.id, uuid.UUID)
    assert analysis.user_id == user.id
    assert analysis.response_json["change_percentage"] == 33.78

    # 3. Test relationship access
    test_db_session.refresh(user)
    assert len(user.analyses) == 1
    assert user.analyses[0].id == analysis.id

    # 4. Test ON DELETE CASCADE
    analysis_id = analysis.id
    test_db_session.delete(user)
    test_db_session.commit()

    # The analysis should be cascade deleted
    deleted_analysis = test_db_session.get(Analysis, analysis_id)
    assert deleted_analysis is None


def test_live_postgres_anonymous_analysis(test_db_session: Session):
    """Verify Analysis can be created without a user_id (guest/anonymous mode)."""
    analysis = Analysis(
        user_id=None,
        query="Identify structures in this scene",
        mode="single_image",
        capability="vqa",
        status="completed",
        response_json={"answer": "Urban residential zone"},
    )
    test_db_session.add(analysis)
    test_db_session.commit()
    test_db_session.refresh(analysis)

    assert analysis.id is not None
    assert analysis.user_id is None
    assert analysis.capability == "vqa"

    # Clean up
    test_db_session.delete(analysis)
    test_db_session.commit()


# ─── 6. Fail-Closed Environment & Security Tests ─────────────────────────────

def test_environment_misspelled_fails_closed():
    """Verify misspelled ENVIRONMENT raises ValueError and cannot silently run."""
    for bad_env in ["produciton", "productionn", "live", "custom_env"]:
        with pytest.raises(ValueError) as exc_info:
            Settings(ENVIRONMENT=bad_env)
        assert "Invalid or misspelled ENVIRONMENT" in str(exc_info.value)
        assert "Allowed environments are: 'development', 'test', 'staging', 'production'." in str(exc_info.value)


def test_environment_cloud_detected_without_prod_fails_closed(monkeypatch):
    """Verify cloud deployment metadata requires explicit production or staging configuration."""
    monkeypatch.setenv("RENDER", "true")
    with pytest.raises(ValueError) as exc_info:
        Settings(ENVIRONMENT="development")
    assert "Cloud hosting environment detected" in str(exc_info.value)
    assert "'production' or 'staging'" in str(exc_info.value)

    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "staging")
    with pytest.raises(ValueError) as exc_info:
        Settings(ENVIRONMENT="development")
    assert "Cloud hosting environment detected" in str(exc_info.value)

    # Cloud environment with staging is accepted
    staging_cfg = Settings(
        ENVIRONMENT="staging",
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        JWT_SECRET_KEY="staging-secure-secret-key-at-least-32-chars!",
    )
    assert staging_cfg.ENVIRONMENT == "staging"

    # Cloud environment with production is accepted
    prod_cfg = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        JWT_SECRET_KEY="prod-secure-secret-key-at-least-32-chars!",
    )
    assert prod_cfg.ENVIRONMENT == "production"


def test_environment_production_requires_secure_jwt_and_postgres():
    """Verify production requires PostgreSQL with psycopg3 and strong random secret."""
    # SQLite rejected with redacted error message
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite:///./prod.db",
            JWT_SECRET_KEY="a" * 32,
        )
    assert "require a PostgreSQL database" in str(exc_info.value)
    assert "unsupported database scheme 'sqlite'" in str(exc_info.value)

    # Credentials in unsupported DATABASE_URL are strictly redacted
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="mysql://supersecretuser:supersecretpass123@db.internal.corp:3306/production_db",
            JWT_SECRET_KEY="a" * 32,
        )
    err_text = str(exc_info.value)
    assert "unsupported database scheme 'mysql'" in err_text
    assert "supersecretuser" not in err_text
    assert "supersecretpass123" not in err_text
    assert "db.internal.corp" not in err_text
    assert "production_db" not in err_text

    # Missing or placeholder JWT rejected
    for bad_jwt in [None, "", "replace-with-a-random-secret", "satquery-dev-secret-key-for-local-testing-only-32ch"]:
        with pytest.raises(ValueError) as exc_info:
            Settings(
                ENVIRONMENT="production",
                DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
                JWT_SECRET_KEY=bad_jwt,
            )
        assert "require an explicitly configured, secure JWT_SECRET_KEY" in str(exc_info.value)

    # Short JWT rejected
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
            JWT_SECRET_KEY="short-secret-under-32",
        )
    assert "at least 32 characters long" in str(exc_info.value)

    # Valid production settings accepted
    prod_cfg = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql://u:p@localhost:5432/db",
        JWT_SECRET_KEY="valid-secure-production-secret-key-32ch-min!",
    )
    assert prod_cfg.DATABASE_URL.startswith("postgresql+psycopg://")
    assert len(prod_cfg.JWT_SECRET_KEY) >= 32


def test_environment_staging_requires_production_grade_security():
    """Verify staging enforces identical production-grade PostgreSQL and JWT constraints with credential redaction."""
    # SQLite rejected in staging with redacted error message
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="staging",
            DATABASE_URL="sqlite:///./staging.db",
            JWT_SECRET_KEY="a" * 32,
        )
    assert "require a PostgreSQL database" in str(exc_info.value)
    assert "unsupported database scheme 'sqlite'" in str(exc_info.value)

    # Unsupported database URL credentials redacted in staging
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="staging",
            DATABASE_URL="mongodb://staging_admin:secret_staging_pass@cluster.mongodb.net:27017/staging_db",
            JWT_SECRET_KEY="a" * 32,
        )
    err_staging = str(exc_info.value)
    assert "unsupported database scheme 'mongodb'" in err_staging
    assert "staging_admin" not in err_staging
    assert "secret_staging_pass" not in err_staging
    assert "cluster.mongodb.net" not in err_staging

    # Missing or placeholder JWT rejected in staging
    for bad_jwt in [None, "", "replace-with-a-random-secret", "satquery-dev-secret-key-for-local-testing-only-32ch"]:
        with pytest.raises(ValueError) as exc_info:
            Settings(
                ENVIRONMENT="staging",
                DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
                JWT_SECRET_KEY=bad_jwt,
            )
        assert "require an explicitly configured, secure JWT_SECRET_KEY" in str(exc_info.value)

    # Short JWT rejected in staging
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="staging",
            DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
            JWT_SECRET_KEY="short-staging-secret",
        )
    assert "at least 32 characters long" in str(exc_info.value)

    # Valid staging settings accepted
    staging_cfg = Settings(
        ENVIRONMENT="staging",
        DATABASE_URL="postgresql://u:p@localhost:5432/db",
        JWT_SECRET_KEY="valid-secure-staging-secret-key-32ch-min!",
    )
    assert staging_cfg.DATABASE_URL.startswith("postgresql+psycopg://")
    assert len(staging_cfg.JWT_SECRET_KEY) >= 32


def test_environment_local_development_uses_safe_fallbacks(monkeypatch):
    """Verify local development permits SQLite and dev fallback secret."""
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("RENDER_SERVICE_ID", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("KUBERNETES_SERVICE_HOST", raising=False)

    dev_cfg = Settings(ENVIRONMENT="development", DATABASE_URL="sqlite:///./test.db", JWT_SECRET_KEY=None)
    assert dev_cfg.DATABASE_URL == "sqlite:///./test.db"
    assert dev_cfg.JWT_SECRET_KEY == "satquery-dev-secret-key-for-local-testing-only-32ch"

    test_cfg = Settings(ENVIRONMENT="test", DATABASE_URL="sqlite:///:memory:", JWT_SECRET_KEY="")
    assert test_cfg.DATABASE_URL == "sqlite:///:memory:"
    assert test_cfg.JWT_SECRET_KEY == "satquery-dev-secret-key-for-local-testing-only-32ch"


def test_allow_vercel_previews_defaults_and_explicit_overrides(monkeypatch):
    """Verify ALLOW_VERCEL_PREVIEWS defaults to False in prod/staging, True in dev/test, and respects explicit settings."""
    # Ensure no environment variable overrides for clean default testing
    monkeypatch.delenv("ALLOW_VERCEL_PREVIEWS", raising=False)
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("RENDER_SERVICE_ID", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("KUBERNETES_SERVICE_HOST", raising=False)

    # Default in production: False
    prod_cfg = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        JWT_SECRET_KEY="secure-production-secret-key-32ch-min!",
    )
    assert prod_cfg.ALLOW_VERCEL_PREVIEWS is False

    # Default in staging: False
    staging_cfg = Settings(
        ENVIRONMENT="staging",
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        JWT_SECRET_KEY="secure-staging-secret-key-32ch-min!",
    )
    assert staging_cfg.ALLOW_VERCEL_PREVIEWS is False

    # Default in development: True
    dev_cfg = Settings(ENVIRONMENT="development")
    assert dev_cfg.ALLOW_VERCEL_PREVIEWS is True

    # Default in test: True
    test_cfg = Settings(ENVIRONMENT="test")
    assert test_cfg.ALLOW_VERCEL_PREVIEWS is True

    # Explicit configuration in production: enabled
    prod_explicit_true = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        JWT_SECRET_KEY="secure-production-secret-key-32ch-min!",
        ALLOW_VERCEL_PREVIEWS=True,
    )
    assert prod_explicit_true.ALLOW_VERCEL_PREVIEWS is True

    # Explicit configuration in production: disabled
    prod_explicit_false = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        JWT_SECRET_KEY="secure-production-secret-key-32ch-min!",
        ALLOW_VERCEL_PREVIEWS=False,
    )
    assert prod_explicit_false.ALLOW_VERCEL_PREVIEWS is False

    # Explicit configuration in development: disabled
    dev_explicit_false = Settings(ENVIRONMENT="development", ALLOW_VERCEL_PREVIEWS=False)
    assert dev_explicit_false.ALLOW_VERCEL_PREVIEWS is False

    # Environment variable string parsing ("true", "1", "false", "0", "")
    monkeypatch.setenv("ALLOW_VERCEL_PREVIEWS", "true")
    assert Settings(ENVIRONMENT="production", DATABASE_URL="postgresql+psycopg://u:p@h/d", JWT_SECRET_KEY="x"*32).ALLOW_VERCEL_PREVIEWS is True

    monkeypatch.setenv("ALLOW_VERCEL_PREVIEWS", "1")
    assert Settings(ENVIRONMENT="production", DATABASE_URL="postgresql+psycopg://u:p@h/d", JWT_SECRET_KEY="x"*32).ALLOW_VERCEL_PREVIEWS is True

    monkeypatch.setenv("ALLOW_VERCEL_PREVIEWS", "false")
    assert Settings(ENVIRONMENT="development").ALLOW_VERCEL_PREVIEWS is False

    monkeypatch.setenv("ALLOW_VERCEL_PREVIEWS", "0")
    assert Settings(ENVIRONMENT="development").ALLOW_VERCEL_PREVIEWS is False

    # Empty string should fall back to environment default
    monkeypatch.setenv("ALLOW_VERCEL_PREVIEWS", "")
    assert Settings(ENVIRONMENT="production", DATABASE_URL="postgresql+psycopg://u:p@h/d", JWT_SECRET_KEY="x"*32).ALLOW_VERCEL_PREVIEWS is False
    assert Settings(ENVIRONMENT="development").ALLOW_VERCEL_PREVIEWS is True


def test_environment_aware_cors_origins(monkeypatch):
    """Verify get_cors_origins omits localhost in production/staging and includes localhost in dev/test."""
    from backend.main import get_cors_origins

    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("RENDER_SERVICE_ID", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("KUBERNETES_SERVICE_HOST", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    # 1. Development: localhost origins included by default
    dev_cfg = Settings(_env_file=None, ENVIRONMENT="development", FRONTEND_URL="https://sat-query-ai-two.vercel.app")
    dev_origins = get_cors_origins(dev_cfg)
    assert "http://localhost:5173" in dev_origins
    assert "http://127.0.0.1:5173" in dev_origins
    assert "http://localhost:3000" in dev_origins
    assert "https://sat-query-ai-two.vercel.app" in dev_origins

    # 2. Test: localhost origins included by default
    test_cfg = Settings(_env_file=None, ENVIRONMENT="test")
    test_origins = get_cors_origins(test_cfg)
    assert "http://localhost:5173" in test_origins

    # 3. Production: localhost origins strictly excluded by default
    prod_cfg = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@h/d",
        JWT_SECRET_KEY="x"*32,
        FRONTEND_URL="https://sat-query-ai-two.vercel.app",
    )
    prod_origins = get_cors_origins(prod_cfg)
    assert "http://localhost:5173" not in prod_origins
    assert "http://127.0.0.1:5173" not in prod_origins
    assert "http://localhost:3000" not in prod_origins
    assert "https://sat-query-ai-two.vercel.app" in prod_origins

    # 4. Staging: localhost origins strictly excluded by default
    staging_cfg = Settings(
        _env_file=None,
        ENVIRONMENT="staging",
        DATABASE_URL="postgresql+psycopg://u:p@h/d",
        JWT_SECRET_KEY="x"*32,
        FRONTEND_URL="https://sat-query-ai-two.vercel.app",
    )
    staging_origins = get_cors_origins(staging_cfg)
    assert "http://localhost:5173" not in staging_origins

    # 5. Production with explicitly configured CORS_ORIGINS: localhost honored
    prod_custom_cfg = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@h/d",
        JWT_SECRET_KEY="x"*32,
        FRONTEND_URL="https://sat-query-ai-two.vercel.app",
        CORS_ORIGINS="http://localhost:5173,https://admin.custom-domain.com",
    )
    custom_origins = get_cors_origins(prod_custom_cfg)
    assert "http://localhost:5173" in custom_origins
    assert "https://admin.custom-domain.com" in custom_origins


def test_cors_preflight_localhost_rejected_in_production_allowed_in_dev():
    """Verify preflight requests from localhost are rejected in production but accepted in dev."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.testclient import TestClient
    from backend.main import get_cors_origins

    # 1. Production app (default: localhost rejected)
    prod_cfg = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@h/d",
        JWT_SECRET_KEY="x"*32,
        FRONTEND_URL="https://sat-query-ai-two.vercel.app",
    )
    app_prod = FastAPI()
    app_prod.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(prod_cfg),
        allow_origin_regex=r"^https://.*\.vercel\.app$" if prod_cfg.ALLOW_VERCEL_PREVIEWS else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    @app_prod.get("/test")
    def test_prod():
        return {"ok": True}

    client_prod = TestClient(app_prod)

    # Localhost origin rejected in production
    res_local_prod = client_prod.options(
        "/test",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert res_local_prod.headers.get("access-control-allow-origin") is None

    # Configured frontend origin allowed in production
    res_fe_prod = client_prod.options(
        "/test",
        headers={"Origin": "https://sat-query-ai-two.vercel.app", "Access-Control-Request-Method": "GET"},
    )
    assert res_fe_prod.headers.get("access-control-allow-origin") == "https://sat-query-ai-two.vercel.app"

    # 2. Production app with explicit CORS_ORIGINS allowing localhost
    prod_explicit_cfg = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://u:p@h/d",
        JWT_SECRET_KEY="x"*32,
        CORS_ORIGINS="http://localhost:5173",
    )
    app_prod_explicit = FastAPI()
    app_prod_explicit.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(prod_explicit_cfg),
        allow_origin_regex=None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    client_prod_explicit = TestClient(app_prod_explicit)
    res_explicit_local = client_prod_explicit.options(
        "/test",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert res_explicit_local.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # 3. Development app (localhost allowed by default)
    dev_cfg = Settings(_env_file=None, ENVIRONMENT="development")
    app_dev = FastAPI()
    app_dev.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(dev_cfg),
        allow_origin_regex=r"^https://.*\.vercel\.app$" if dev_cfg.ALLOW_VERCEL_PREVIEWS else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    client_dev = TestClient(app_dev)
    res_dev_local = client_dev.options(
        "/test",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert res_dev_local.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_behavior_with_preview_enabled_and_disabled():
    """Verify CORS preflight headers when ALLOW_VERCEL_PREVIEWS is False (prod) vs True (preview/dev)."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.testclient import TestClient

    def create_cors_app(preview_allowed: bool) -> FastAPI:
        test_app = FastAPI()
        test_app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "https://sat-query-ai-two.vercel.app",
            ],
            allow_origin_regex=r"^https://.*\.vercel\.app$" if preview_allowed else None,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        @test_app.get("/health")
        def health():
            return {"status": "ok"}
        return test_app

    # 1. Preview origins DISABLED (production default)
    client_prod = TestClient(create_cors_app(preview_allowed=False))

    # Arbitrary Vercel preview origin rejected
    res_preview = client_prod.options(
        "/health",
        headers={
            "Origin": "https://satquery-preview-pr-42.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_preview.headers.get("access-control-allow-origin") is None

    # Explicit production origin allowed
    res_prod_orig = client_prod.options(
        "/health",
        headers={
            "Origin": "https://sat-query-ai-two.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_prod_orig.headers.get("access-control-allow-origin") == "https://sat-query-ai-two.vercel.app"

    # Random external origin rejected
    res_external = client_prod.options(
        "/health",
        headers={
            "Origin": "https://unauthorized-origin.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_external.headers.get("access-control-allow-origin") is None

    # 2. Preview origins ENABLED (explicit preview or dev default)
    client_preview = TestClient(create_cors_app(preview_allowed=True))

    # Arbitrary Vercel preview origin ALLOWED
    res_preview_ok = client_preview.options(
        "/health",
        headers={
            "Origin": "https://satquery-preview-pr-42.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_preview_ok.headers.get("access-control-allow-origin") == "https://satquery-preview-pr-42.vercel.app"

    # Production origin still allowed
    res_prod_still_ok = client_preview.options(
        "/health",
        headers={
            "Origin": "https://sat-query-ai-two.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_prod_still_ok.headers.get("access-control-allow-origin") == "https://sat-query-ai-two.vercel.app"

    # Random external origin still rejected
    res_ext_reject = client_preview.options(
        "/health",
        headers={
            "Origin": "https://unauthorized-origin.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_ext_reject.headers.get("access-control-allow-origin") is None


def test_procfile_and_dockerfile_startup_command_consistency():
    """Verify Procfile and Dockerfile start commands are consistent, target backend.main:app, and expand PORT via sh."""
    from pathlib import Path
    import re

    repo_root = Path(__file__).resolve().parent.parent

    # 1. Procfile inspection
    procfile_path = repo_root / "Procfile"
    assert procfile_path.exists(), "Procfile must exist"
    procfile_content = procfile_path.read_text(encoding="utf-8").strip()

    assert "backend.main:app" in procfile_content, "Procfile must target backend.main:app"
    assert "--host 0.0.0.0" in procfile_content, "Procfile must bind to 0.0.0.0"
    assert "sh -c" in procfile_content, "Procfile must use sh -c to expand environment variables"
    assert "${PORT" in procfile_content, "Procfile must use shell parameter expansion ${PORT...}"
    # Verify bare $PORT without sh -c is NOT present
    assert not re.search(r"--port\s+\$PORT\b", procfile_content), "Procfile must not pass raw $PORT without shell expansion"

    # 2. Dockerfile inspection
    dockerfile_path = repo_root / "Dockerfile"
    assert dockerfile_path.exists(), "Dockerfile must exist"
    dockerfile_content = dockerfile_path.read_text(encoding="utf-8")

    assert "backend.main:app" in dockerfile_content, "Dockerfile must target backend.main:app"
    assert "--host 0.0.0.0" in dockerfile_content, "Dockerfile must bind to 0.0.0.0"
    assert "sh" in dockerfile_content and "-c" in dockerfile_content, "Dockerfile CMD must execute via sh -c"
    assert "${PORT" in dockerfile_content, "Dockerfile CMD must expand ${PORT...}"


def test_uvicorn_port_validation_rejects_literal_string_and_accepts_integer():
    """Verify Uvicorn CLI Click parser rejects literal '$PORT' string and accepts integer ports."""
    import subprocess
    import sys

    # 1. Literal '$PORT' string -> Click rejects with code 2 and exact error message
    proc_bad = subprocess.run(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "$PORT"],
        capture_output=True,
        text=True,
    )
    assert proc_bad.returncode != 0
    assert "Invalid value for '--port': '$PORT' is not a valid integer." in proc_bad.stderr

    # 2. Integer port with --help -> Click accepts option without port error
    proc_good = subprocess.run(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000", "--help"],
        capture_output=True,
        text=True,
    )
    assert proc_good.returncode == 0
    assert "[OPTIONS]" in proc_good.stdout and "APP" in proc_good.stdout
    assert "is not a valid integer" not in proc_good.stderr


def test_procfile_sh_command_expands_numeric_port():
    """Parse and execute the actual startup command from Procfile with a controlled numeric PORT without launching a server."""
    import os
    import re
    import shutil
    import subprocess
    import sys
    from pathlib import Path

    repo_root = Path(__file__).resolve().parent.parent
    procfile_path = repo_root / "Procfile"
    assert procfile_path.exists(), "Procfile must exist"
    procfile_content = procfile_path.read_text(encoding="utf-8").strip()

    assert procfile_content.startswith("web: "), "Procfile must define a 'web: ' process"

    # Extract the exact shell command wrapped in sh -c "..." directly from Procfile
    match = re.search(r'sh\s+-c\s+["\'](.*?)["\']', procfile_content)
    assert match is not None, "Procfile command must be wrapped in sh -c \"...\""
    inner_cmd = match.group(1)

    # Assertions on the actual parsed Procfile command
    assert inner_cmd.startswith("uvicorn backend.main:app"), "Procfile must target backend.main:app"
    assert "--host 0.0.0.0" in inner_cmd, "Procfile must bind to 0.0.0.0"
    assert "--port ${PORT:-8000}" in inner_cmd, "Procfile must use ${PORT:-8000} expansion"

    # Extract the exact port expression from inner_cmd
    port_match = re.search(r'--port\s+([^\s]+)', inner_cmd)
    assert port_match is not None, "Procfile command must specify a --port argument"
    port_expr = port_match.group(1)
    assert port_expr == "${PORT:-8000}", f"Expected '${{PORT:-8000}}', got '{port_expr}'"

    sh_executable = shutil.which("sh")
    if not sh_executable:
        pytest.skip("POSIX shell 'sh' is not available in the current environment to execute shell expansion assertions.")

    # 1. Controlled numeric PORT=9050: verify expanded argument from Procfile is numeric
    test_env = dict(os.environ, PORT="9050")
    proc_custom = subprocess.run(
        [sh_executable, "-c", f"echo {port_expr}"],
        capture_output=True,
        text=True,
        env=test_env,
    )
    assert proc_custom.returncode == 0
    expanded_port = proc_custom.stdout.strip()
    assert expanded_port == "9050"
    assert expanded_port.isdigit()

    # 2. Unset PORT: verify default fallback from Procfile is numeric (8000)
    test_env_no_port = {k: v for k, v in os.environ.items() if k != "PORT"}
    proc_fallback = subprocess.run(
        [sh_executable, "-c", f"echo {port_expr}"],
        capture_output=True,
        text=True,
        env=test_env_no_port,
    )
    assert proc_fallback.returncode == 0
    fallback_port = proc_fallback.stdout.strip()
    assert fallback_port == "8000"
    assert fallback_port.isdigit()

    # 3. Execute the actual Procfile command with python interpreter and --help (safe, no persistent server)
    py_path = sys.executable.replace("\\", "/")
    # Drop-in python interpreter for uvicorn in the parsed command, appending --help
    test_help_cmd = inner_cmd.replace("uvicorn", f'"{py_path}" -m uvicorn', 1) + " --help"
    proc_help = subprocess.run(
        [sh_executable, "-c", test_help_cmd],
        capture_output=True,
        text=True,
        env=test_env,
    )
    assert proc_help.returncode == 0
    assert "[OPTIONS]" in proc_help.stdout and "APP" in proc_help.stdout
    assert "is not a valid integer" not in proc_help.stderr
