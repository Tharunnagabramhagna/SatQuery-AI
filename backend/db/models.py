"""SQLAlchemy relational models for SatQuery AI.

Phase 4A establishes the core User and Analysis models using SQLAlchemy 2.x
typed declarative mapping and PostgreSQL-native types.

Key Architectural Decisions:
- Primary Keys: Native PostgreSQL UUID (sa.Uuid(as_uuid=True)) generated with
  uuid.uuid4. Prevents enumeration attacks, supports distributed generation,
  and matches frontend analysisId conventions.
- Cascade Behavior:
  - Database-level: `ForeignKey("users.id", ondelete="CASCADE")` ensures relational
    integrity directly in PostgreSQL.
  - ORM-level: `cascade="all, delete-orphan", passive_deletes=True` on `User.analyses`
    delegates child deletion to PostgreSQL efficiently without redundant individual deletes.
- Anonymous Queries: `Analysis.user_id` is nullable to allow demo and guest analyses
  prior to full authentication enforcement (Phase 4B).
"""

from backend.db.evaluation_models import EvaluationCase, EvaluationRun

import datetime
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class User(Base):
    """User account model.

    Stores core user identity and credentials.
    Authentication logic and password verification are implemented in Phase 4B.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique user identifier (UUIDv4)",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        doc="User email address used for login",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Securely hashed user password (bcrypt/argon2)",
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        doc="Optional user display name",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Timestamp of account creation",
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        doc="Timestamp of last account update",
    )

    # 1-to-many relationship with Analysis
    analyses: Mapped[List["Analysis"]] = relationship(
        "Analysis",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        doc="All analyses requested by this user",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}'>"


class Analysis(Base):
    """Satellite analysis execution record.

    Persists query metadata, execution status, and structured results.
    Persistence is activated in Phase 4D; model infrastructure established in Phase 4A.
    """

    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique analysis identifier (UUIDv4)",
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Foreign key to users.id; nullable for guest/demo queries",
    )
    query: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Natural language query requested by the user",
    )
    mode: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        doc="Frontend analysis mode (e.g. compare_images, single_image)",
    )
    capability: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        doc="Frontend capability / task (e.g. change_detection, vqa)",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="completed",
        doc="Analysis outcome status (e.g. completed, error, failed)",
    )
    response_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        doc="Complete structured analysis result payload in JSONB format",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        doc="Timestamp when analysis was submitted",
    )

    # Many-to-1 relationship with User
    user: Mapped[Optional[User]] = relationship(
        "User",
        back_populates="analyses",
        doc="The user who initiated this analysis",
    )

    def __repr__(self) -> str:
        return f"<Analysis id={self.id} status='{self.status}' task='{self.capability}'>"

