# SatQuery AI — Database Architecture & Engineering Guide

SatQuery AI uses **PostgreSQL** as its primary relational database with **SQLAlchemy 2.x** (synchronous declarative ORM) and the **psycopg 3** driver (`psycopg[binary]`). Schema evolution is strictly managed through **Alembic** migrations.

---

## 1. Database Architecture Overview

### Relational Schema: `users` 1 ─── N `analyses`

```text
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

---

## 2. Key Architectural Decisions

### 2.1 Why PostgreSQL?
- **Strict ACID Guarantees**: Ensures atomic transactions for multi-step query processing, user management, and execution logging.
- **Native JSONB Support**: Combines relational rigor (users, relationships, foreign keys, audit timestamps) with semi-structured document storage (multimodal outputs, model predictions, bounding boxes, agent traces).
- **Production Scalability**: Robust connection pooling, concurrent read/write isolation, and enterprise-grade backup/restore capabilities.

### 2.2 Why JSONB for `response_json`?
- **Multimodal AI Flexibility**: Analysis outputs contain heterogeneous data structures (bounding box coordinates, change masks, confidence scores, evidence lists, and visualization paths).
- **Binary Performance**: PostgreSQL stores JSONB in a decomposed binary format, allowing fast indexing, path extraction (`->`, `->>`), and containment queries (`@>`) without deserializing the whole document.
- **Future-Proof Schema**: Specialized agents can introduce new metadata attributes (e.g. sensor bands, cloud-cover percentages) without triggering schema migrations.

### 2.3 UUID Primary Keys
- Both `User.id` and `Analysis.id` use RFC 4122 UUIDv4 (`sa.Uuid(as_uuid=True)`).
- Eliminates predictable ID enumeration attacks.
- Supports decentralized ID generation across services and matches frontend conventions (`analysisId`).

### 2.4 Authenticated vs. Guest Analysis Behavior
- **Authenticated Requests**: When an `Authorization: Bearer <token>` header is present and valid, the API links the created analysis to `current_user.id`. The user can retrieve their analysis history via `GET /api/analyses`.
- **Guest / Demo Requests**: Anonymous users can submit queries without logging in. The system processes the query and persists the record with `user_id = None`. Guest analyses cannot be listed via `GET /api/analyses` (which requires authentication and returns `HTTP 401 Unauthorized`), protecting user privacy.
- **User Isolation**: Analysis history queries strictly filter `WHERE user_id = :user_id ORDER BY created_at DESC`, guaranteeing that one user can never view or enumerate another user's queries.

### 2.5 Cascade Deletion
- Foreign key: `ForeignKey("users.id", ondelete="CASCADE")`.
- ORM relationship: `relationship("Analysis", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)`.
- When a user account is deleted, all associated analyses are purged by the database engine efficiently.

---

## 3. Database Environments & Isolation

To prevent accidental data loss or state contamination, SatQuery strictly isolates development and testing environments:

| Environment | Database Name | Connection String Variable | Purpose |
| :--- | :--- | :--- | :--- |
| **Development** | `satquery` | `DATABASE_URL` | Local API server and development data |
| **Test** | `satquery_test` | `TEST_DATABASE_URL` | Automated test suite execution (pytest) |

> [!IMPORTANT]
> The automated test suite (`pytest`) connects **exclusively** to `satquery_test`. Fixtures drop and recreate test tables per session or test run. Tests **never** touch the `satquery` development database.

### Connection String Format
SatQuery uses the **psycopg 3** driver prefix `postgresql+psycopg://`:
```text
postgresql+psycopg://postgres:postgres@localhost:5432/satquery
postgresql+psycopg://postgres:postgres@localhost:5432/satquery_test
```

---

## 4. Alembic Migration Workflow

Alembic migrations are the **single source of truth** for schema state. Never rely on `create_all()` in production environments.

### 4.1 Applying Migrations
Apply all migrations to reach the latest schema:
```bash
python -m alembic upgrade head
```

### 4.2 Inspecting Migration State
Check current database migration version:
```bash
python -m alembic current
```

View complete migration history:
```bash
python -m alembic history --verbose
```

### 4.3 Rolling Back Migrations
Roll back the most recent migration step:
```bash
python -m alembic downgrade -1
```

Roll back all migrations to clean base:
```bash
python -m alembic downgrade base
```

### 4.4 Creating a New Migration
1. Update or create models in `backend/db/models.py`.
2. Generate an auto-detected migration:
   ```bash
   python -m alembic revision --autogenerate -m "add new field to analyses"
   ```
3. Inspect the generated file under `alembic/versions/` to verify operations.
4. Apply the migration:
   ```bash
   python -m alembic upgrade head
   ```

---

---

## 5. How Another Developer Runs My Work

### 5.1 Environment Prerequisites
Ensure PostgreSQL is running and test database `satquery_test` exists:
```powershell
Get-Service -Name "*postgres*"
```

### 5.2 Verify Alembic Migrations
```powershell
python -m pytest tests/test_database.py -k "alembic" -v
```

### 5.3 Run Database & History Integration Tests
```powershell
# Run database schema and live migration tests
python -m pytest tests/test_database.py -q

# Run authentication and analysis history tests
python -m pytest tests/test_auth.py -q
```

