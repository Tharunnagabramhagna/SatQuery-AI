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
