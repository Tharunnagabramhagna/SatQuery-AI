import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.db.base import Base
from backend.db.session import get_db, check_db_connectivity
from backend.main import app
from backend.config import settings


@pytest.fixture(scope="session")
def test_engine():
    """Use PostgreSQL test database if reachable, otherwise fallback to SQLite."""
    pg_engine = None
    if settings.TEST_DATABASE_URL:
        try:
            cand_engine = create_engine(settings.TEST_DATABASE_URL, pool_pre_ping=True)
            if check_db_connectivity(target_engine=cand_engine, timeout=0.5):
                pg_engine = cand_engine
        except Exception:
            pg_engine = None

    if pg_engine is not None:
        Base.metadata.create_all(bind=pg_engine)
        yield pg_engine
        Base.metadata.drop_all(bind=pg_engine)
        pg_engine.dispose()
    else:
        sqlite_engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=sqlite_engine)
        yield sqlite_engine
        Base.metadata.drop_all(bind=sqlite_engine)
        sqlite_engine.dispose()


@pytest.fixture
def client(test_engine):
    """FastAPI client using the isolated test database."""
    TestingSessionLocal = sessionmaker(
        bind=test_engine,
        autocommit=False,
        autoflush=False,
    )

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
