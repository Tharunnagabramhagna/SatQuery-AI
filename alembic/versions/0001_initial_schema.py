"""Initial database schema: users and analyses tables.

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-09-05 23:14:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 2. Create analyses table
    op.create_table(
        "analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("mode", sa.String(length=50), nullable=True),
        sa.Column("capability", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            server_default="completed",
            nullable=False,
        ),
        sa.Column(
            "response_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_analyses_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_analyses"),
    )
    op.create_index(
        op.f("ix_analyses_user_id"), "analyses", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_analyses_created_at"), "analyses", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_analyses_created_at"), table_name="analyses")
    op.drop_index(op.f("ix_analyses_user_id"), table_name="analyses")
    op.drop_table("analyses")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
