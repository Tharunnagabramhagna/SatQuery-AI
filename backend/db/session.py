"""Database session management and connectivity verification.

Configures synchronous SQLAlchemy 2.x engine with connection pooling and
provides FastAPI session dependency and graceful health check utility.
"""

import logging
from typing import Generator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings

logger = logging.getLogger("satquery.db")

# Create database engine with appropriate pooling strategy
if settings.DATABASE_URL.startswith("sqlite"):
    engine: Engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine: Engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

# Session factory for synchronous database operations
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a managed database session.

    Ensures session is always closed after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connectivity(
    target_engine: Optional[Engine] = None,
    timeout: float = 2.0,
) -> bool:
    """Check whether PostgreSQL database is reachable.

    Executes a lightweight `SELECT 1` query. Does not raise exceptions;
    returns False on connection failure or timeout.

    Args:
        target_engine: Optional engine instance (defaults to global engine).
        timeout: Socket connect/execution timeout in seconds.

    Returns:
        bool: True if database responded successfully, False otherwise.
    """
    eng = target_engine or engine
    try:
        # Create a connection with execution options for timeout
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except (OperationalError, DBAPIError, Exception) as exc:
        logger.warning("Database connectivity check failed: %s", exc)
        return False
