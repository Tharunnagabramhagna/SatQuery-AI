"""SQLAlchemy models for ML evaluation runs and cases."""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class EvaluationRun(Base):
    """A single evaluation execution against a dataset."""

    __tablename__ = "evaluation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    dataset_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    dataset_version: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    task: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    model_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    total_cases: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    metrics_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    cases: Mapped[list["EvaluationCase"]] = relationship(
        "EvaluationCase",
        back_populates="run",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class EvaluationCase(Base):
    """Individual prediction and ground-truth evaluation record."""

    __tablename__ = "evaluation_cases"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("evaluation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    case_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    query: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    prediction_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    ground_truth_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    metrics_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    run: Mapped[EvaluationRun] = relationship(
        "EvaluationRun",
        back_populates="cases",
    )
