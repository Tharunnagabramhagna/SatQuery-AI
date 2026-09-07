# SatQuery AI — Database Guide (PostgreSQL & Alembic)

SatQuery AI uses **PostgreSQL** as its primary relational database with **SQLAlchemy 2.x** (synchronous declarative ORM) and the **psycopg 3** driver (`psycopg[binary]`). Schema evolution is managed exclusively through **Alembic** migrations.

---

## 1. Database URL Format

Connection strings must use the psycopg 3 driver prefix `postgresql+psycopg://`:

```text
postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE
```

### Examples
- **Local Native PostgreSQL**:
  ```text
  postgresql+psycopg://postgres:postgres@localhost:5432/satquery
  ```
- **Local Test Database**:
  ```text
  postgresql+psycopg://postgres:postgres@localhost:5432/satquery_test
  ```

Set these in your local `.env` file (copied from `.env.example`):
```bash
cp .env.example .env
```

---

## 2. Starting PostgreSQL Locally

### Option A: Local Native PostgreSQL (Windows / Linux / macOS)
If PostgreSQL is installed locally:
- **Windows Service**: Started automatically (`postgresql-x64-17`). To check:
  ```powershell
  Get-Service -Name "*postgres*"
  ```
- Create the application and test databases:
  ```sql
  CREATE DATABASE satquery;
  CREATE DATABASE satquery_test;
  ```

### Option B: Docker Compose (Alternative for Docker environments)
```bash
docker compose up -d
```
This spins up PostgreSQL 17 on `localhost:5432` with persistent volume `satquery_postgres_data`.

---

## 3. Running Alembic Migrations

Migrations are the **single source of truth** for the database schema. Never rely on `Base.metadata.create_all()` in production.

### Apply all pending migrations to the latest revision:
```bash
alembic upgrade head
```

### Inspect the current migration version:
```bash
alembic current
```

### View migration history:
```bash
alembic history --verbose
```

### Roll back the last migration:
```bash
alembic downgrade -1
```

---

## 4. Creating a New Migration

1. Update or add declarative models in `backend/db/models.py`.
2. Generate an auto-detected migration script:
   ```bash
   alembic revision --autogenerate -m "describe changes"
   ```
3. Inspect the newly created script under `alembic/versions/` to verify operations.
4. Apply the migration:
   ```bash
   alembic upgrade head
   ```

---

## 5. Relational Architecture: User 1 ─── N Analysis

```
┌─────────────────────────────────┐       ┌───────────────────────────────────────┐
│              users              │       │               analyses                │
├─────────────────────────────────┤       ├───────────────────────────────────────┤
│ id            UUID (PK)         │◄──┐   │ id            UUID (PK)               │
│ email         VARCHAR(255) (UQ) │   │   │ user_id       UUID (FK, Nullable)     │───┐
│ password_hash VARCHAR(255)      │   └───│ query         TEXT                    │   │
│ display_name  VARCHAR(100)      │       │ mode          VARCHAR(50)             │   │
│ created_at    TIMESTAMPTZ       │       │ capability    VARCHAR(50)             │   │
│ updated_at    TIMESTAMPTZ       │       │ status        VARCHAR(50)             │   │
└─────────────────────────────────┘       │ response_json JSONB                   │   │
                                          │ created_at    TIMESTAMPTZ             │   │
                                          └───────────────────────────────────────┘   │
                                                      │                               │
                                                      └────── ON DELETE CASCADE ──────┘
```

### Design Decisions:
1. **UUID Primary Keys**:
   - Both `User.id` and `Analysis.id` use UUIDv4 (`sa.Uuid(as_uuid=True)`).
   - Prevents enumeration attacks, supports distributed generation, and matches the frontend `analysisId` convention.
2. **Nullable `user_id`**:
   - Supports anonymous and demo analyses before full user authentication (Phase 4B).
   - When users authenticate, their ID is associated with the record.
3. **Cascade Strategy**:
   - Database-level: `ForeignKey("users.id", ondelete="CASCADE")`.
   - ORM-level: `relationship("Analysis", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)`.
   - Eliminates contradictory deletion rules and allows PostgreSQL to optimize cascades.
4. **JSONB `response_json`**:
   - Stores the structured analysis output (visualizations, evidence, trace, metadata) in high-performance binary JSON format with full PostgreSQL indexing support.
