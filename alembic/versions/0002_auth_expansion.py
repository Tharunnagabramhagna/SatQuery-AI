"""Authentication expansion: email verification, OAuth providers, and exchange codes.

Revision ID: 0002_auth_expansion
Revises: 0001_initial_schema
Create Date: 2026-09-06 14:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_auth_expansion"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter users table with verification and OAuth columns
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("google_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("facebook_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=50), server_default="local", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
    )
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )
    op.create_index(op.f("ix_users_google_id"), "users", ["google_id"], unique=True)
    op.create_index(op.f("ix_users_facebook_id"), "users", ["facebook_id"], unique=True)

    # Backwards compatibility: Mark existing users as email_verified = true
    op.execute("UPDATE users SET email_verified = true WHERE email_verified = false")

    # 2. Create email_verifications table
    op.create_table(
        "email_verifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_email_verifications_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_email_verifications"),
    )
    op.create_index(
        op.f("ix_email_verifications_user_id"),
        "email_verifications",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_verifications_expires_at"),
        "email_verifications",
        ["expires_at"],
        unique=False,
    )

    # 3. Create oauth_states table
    op.create_table(
        "oauth_states",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("state_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_oauth_states"),
    )
    op.create_index(
        op.f("ix_oauth_states_state_hash"),
        "oauth_states",
        ["state_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_oauth_states_expires_at"),
        "oauth_states",
        ["expires_at"],
        unique=False,
    )

    # 4. Create oauth_exchange_codes table
    op.create_table(
        "oauth_exchange_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_oauth_exchange_codes_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_oauth_exchange_codes"),
    )
    op.create_index(
        op.f("ix_oauth_exchange_codes_code_hash"),
        "oauth_exchange_codes",
        ["code_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_oauth_exchange_codes_user_id"),
        "oauth_exchange_codes",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("oauth_exchange_codes")
    op.drop_table("oauth_states")
    op.drop_table("email_verifications")
    op.drop_index(op.f("ix_users_facebook_id"), table_name="users")
    op.drop_index(op.f("ix_users_google_id"), table_name="users")
    op.execute("DELETE FROM users WHERE password_hash IS NULL")
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "facebook_id")
    op.drop_column("users", "google_id")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "email_verified")
