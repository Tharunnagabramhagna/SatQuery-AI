# SatQuery AI — Database Module (`backend.db`)

This package contains the core relational database infrastructure for SatQuery AI:

- `base.py`: SQLAlchemy 2.x `DeclarativeBase`.
- `models.py`: Declarative ORM models (`User`, `Analysis`).
- `session.py`: Connection engine, session factory (`SessionLocal`), FastAPI dependency (`get_db`), and safe health check (`check_db_connectivity`).

For full documentation on starting PostgreSQL, running Alembic migrations, and model design, refer to [Docs/database.md](../../Docs/database.md).
