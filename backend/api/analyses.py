"""Analysis history and retrieval endpoints for SatQuery AI.

Phase 4D provides authenticated access to persisted analysis records:
- GET /api/analyses — list current user's analysis history (newest first)
- GET /api/analyses/{analysis_id} — retrieve a single analysis by ID

Both endpoints require JWT authentication. Users can only access their own
analyses. No information leakage about other users' analyses.
"""

from __future__ import annotations

import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import Analysis, User
from backend.db.session import get_db
from backend.schemas.analysis import AnalysisDetailResponse, AnalysisHistoryItem
from backend.security import get_current_user

logger = logging.getLogger("satquery.api.analyses")

router = APIRouter(prefix="/api/analyses", tags=["Analysis History"])


def _format_analysis_date(analysis: Analysis) -> str:
    """Format analysis created_at as ISO 8601 string."""
    if analysis.created_at is not None:
        return analysis.created_at.isoformat()
    return ""


@router.get(
    "",
    response_model=List[AnalysisHistoryItem],
    status_code=status.HTTP_200_OK,
    summary="List authenticated user's analysis history",
    description=(
        "Returns all analyses belonging to the authenticated user, "
        "ordered by creation date (newest first). Requires JWT Bearer authentication."
    ),
)
def list_user_analyses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[AnalysisHistoryItem]:
    """Retrieve the authenticated user's analysis history.

    Returns only analyses with user_id matching the current user.
    Anonymous analyses (user_id=NULL) and other users' analyses are excluded.
    """
    analyses = db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
    ).scalars().all()

    return [
        AnalysisHistoryItem(
            id=str(analysis.id),
            query=analysis.query,
            mode=analysis.mode,
            capability=analysis.capability,
            status=analysis.status,
            date=_format_analysis_date(analysis),
            is_demo=False,
        )
        for analysis in analyses
    ]


@router.get(
    "/{analysis_id}",
    response_model=AnalysisDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a single analysis by ID",
    description=(
        "Returns the full analysis record including the complete response payload. "
        "Requires JWT Bearer authentication. Returns 404 if the analysis does not "
        "exist or belongs to another user."
    ),
)
def get_analysis_detail(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisDetailResponse:
    """Retrieve a single analysis owned by the authenticated user.

    Returns 404 for nonexistent analyses AND for analyses belonging to
    other users, preventing information leakage about other users' data.
    """
    # Parse analysis_id as UUID safely
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )

    # Query with ownership check: both id and user_id must match
    analysis = db.execute(
        select(Analysis).where(
            Analysis.id == analysis_uuid,
            Analysis.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )

    return AnalysisDetailResponse(
        id=str(analysis.id),
        query=analysis.query,
        mode=analysis.mode,
        capability=analysis.capability,
        status=analysis.status,
        date=_format_analysis_date(analysis),
        is_demo=False,
        response=analysis.response_json,
    )
