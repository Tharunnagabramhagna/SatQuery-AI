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

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class User(Base):
    """User account model.

    Stores core user identity, credentials, verification state, and OAuth links.
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
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        doc="Securely hashed user password (bcrypt/argon2), nullable for social OAuth logins",
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        doc="Optional user display name",
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Whether the user email address has been verified",
    )
    email_verified_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp of email verification",
    )
    google_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
        doc="Google OAuth subject identifier",
    )
    facebook_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
        doc="Facebook OAuth user identifier",
    )
    auth_provider: Mapped[str] = mapped_column(
        String(50),
        default="local",
        nullable=False,
        doc="Primary authentication provider: local, google, or facebook",
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(1024),
        nullable=True,
        doc="Optional avatar profile picture URL",
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
    analyses: Mapped[List[Analysis]] = relationship(
        "Analysis",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        doc="All analyses requested by this user",
    )

    # 1-to-many relationship with EmailVerification
    verifications: Mapped[List[EmailVerification]] = relationship(
        "EmailVerification",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        doc="All email verification records for this user",
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


class EmailVerification(Base):
    """Email verification code entity.

    Tracks 6-digit verification codes (stored as SHA-256 digests),
    expiration, attempt limits, and verification status.
    """

    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique verification record identifier (UUIDv4)",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to users table",
    )
    code_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="SHA-256 digest of the 6-digit numeric verification OTP",
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        doc="Timestamp when this verification code expires",
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Number of verification attempts made with this code",
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        doc="Verification status: pending, verified, expired, max_attempts_exceeded",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Timestamp of verification code creation",
    )

    user: Mapped[User] = relationship("User", back_populates="verifications")

    def __repr__(self) -> str:
        return f"<EmailVerification id={self.id} user_id={self.user_id} status='{self.status}'>"


class OAuthState(Base):
    """OAuth CSRF state tracking entity.

    Stores cryptographically secure, short-lived, single-use state values
    to protect Google and Facebook OAuth initiation and callback flows.
    """

    __tablename__ = "oauth_states"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique OAuth state record identifier (UUIDv4)",
    )
    provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="OAuth provider: google or facebook",
    )
    state_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        doc="SHA-256 digest of the raw state token",
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        doc="Timestamp when this state expires",
    )
    used_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp when this state was consumed",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Timestamp of state creation",
    )

    def __repr__(self) -> str:
        return f"<OAuthState id={self.id} provider='{self.provider}'>"


class OAuthExchangeCode(Base):
    """Single-use OAuth exchange code entity.

    Stores short-lived, single-use codes issued after successful OAuth callback
    to prevent exposing JWTs in redirect URLs or browser history.
    """

    __tablename__ = "oauth_exchange_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique exchange code record identifier (UUIDv4)",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to users table",
    )
    code_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        doc="SHA-256 digest of the raw one-time exchange code",
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        doc="Timestamp when this exchange code expires (60-120s)",
    )
    used_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp when this exchange code was consumed",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Timestamp of exchange code creation",
    )

    user: Mapped[User] = relationship("User")

    def __repr__(self) -> str:
        return f"<OAuthExchangeCode id={self.id} user_id={self.user_id}>"
