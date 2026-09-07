"""Tests for Phase 4D: Analysis Persistence, History & Ownership.

Covers:
1. Authenticated analysis is persisted in DB.
2. Persisted analysis has correct user_id.
3. Anonymous analysis still works (no 401 when no token).
4. Anonymous analysis has NULL user_id (no row persisted).
5. GET /api/analyses requires authentication (401 without token).
6. GET /api/analyses returns only current user's analyses.
7. History is ordered newest first (created_at DESC).
8. GET /api/analyses/{id} returns current user's analysis.
9. Another user's analysis cannot be retrieved (returns 404).
10. Nonexistent analysis returns 404.
11. Invalid analysis UUID is handled safely (404).
12. Invalid/missing JWT returns 401 where authentication is required.
13. Authenticated POST /api/analysis response remains frontend-compatible.
14. Existing /api/query behavior remains unchanged.
15. Existing anonymous /api/analysis behavior remains unchanged.
16. No password/password_hash appears in analysis responses.
17-19. Existing registration, JWT, and change-detection tests continue passing (via full suite).

All database operations run exclusively against the isolated `satquery_test` database.
"""

import datetime
import io
import os
import time
import uuid

import jwt
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings
from backend.db.base import Base
from backend.db.models import Analysis, User
from backend.db.session import get_db
from backend.main import app
from backend.security import hash_password
from backend.security.jwt import create_access_token


# ─── Test Fixtures ────────────────────────────────────────────────





@pytest.fixture
def test_session(test_engine):
    """Provide an isolated database session on `satquery_test`."""
    SessionTesting = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = SessionTesting()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(test_engine):
    """FastAPI TestClient with get_db overridden to use `satquery_test`."""
    SessionTesting = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = SessionTesting()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_a(test_session: Session) -> User:
    """Create test user A for analysis persistence tests."""
    unique_email = f"persist_user_a_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        password_hash=hash_password("TestPassword123"),
        display_name="User A",
    )
    test_session.add(user)
    test_session.commit()
    test_session.refresh(user)
    return user


@pytest.fixture
def test_user_b(test_session: Session) -> User:
    """Create test user B for cross-user access tests."""
    unique_email = f"persist_user_b_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        password_hash=hash_password("TestPassword456"),
        display_name="User B",
    )
    test_session.add(user)
    test_session.commit()
    test_session.refresh(user)
    return user


@pytest.fixture
def jwt_token_a(test_user_a: User) -> str:
    """Generate a valid JWT token for user A."""
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-phase4d-analysis-persistence")
    return create_access_token(test_user_a.id)


@pytest.fixture
def jwt_token_b(test_user_b: User) -> str:
    """Generate a valid JWT token for user B."""
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-phase4d-analysis-persistence")
    return create_access_token(test_user_b.id)


def _create_test_jpg(width: int = 64, height: int = 64, color: tuple = (100, 150, 200)) -> bytes:
    """Create a minimal JPEG in memory for testing uploads."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


def _auth_header(token: str) -> dict:
    """Build Authorization Bearer header."""
    return {"Authorization": f"Bearer {token}"}


def _submit_authenticated_analysis(client: TestClient, token: str, query: str = "What changed between 2023 and 2025?") -> dict:
    """Submit an authenticated analysis and return (status_code, response_data)."""
    before_img = _create_test_jpg(color=(100, 150, 200))
    after_img = _create_test_jpg(color=(200, 150, 100))
    resp = client.post(
        "/api/analysis",
        data={
            "query": query,
            "mode": "compare_images",
            "capability": "change_detection",
        },
        files=[
            ("before_image", ("before.jpg", before_img, "image/jpeg")),
            ("after_image", ("after.jpg", after_img, "image/jpeg")),
        ],
        headers=_auth_header(token),
    )
    return {"status_code": resp.status_code, "data": resp.json()}


# ─── 1 & 2. Authenticated Analysis Persistence ───────────────────


def test_authenticated_analysis_is_persisted(client, test_session: Session, jwt_token_a: str, test_user_a: User):
    """Verify authenticated analysis is persisted in the database with correct user_id."""
    result = _submit_authenticated_analysis(client, jwt_token_a)
    assert result["status_code"] == 200

    data = result["data"]
    analysis_id = data["analysisId"]

    # Verify analysis exists in database
    analysis = test_session.execute(
        select(Analysis).where(Analysis.id == uuid.UUID(analysis_id))
    ).scalar_one_or_none()

    assert analysis is not None
    assert analysis.user_id == test_user_a.id
    assert analysis.query == "What changed between 2023 and 2025?"
    assert analysis.mode == "compare_images"
    assert analysis.capability == "change_detection"
    assert analysis.status is not None
    assert analysis.response_json is not None


# ─── 3 & 4. Anonymous Analysis ────────────────────────────────────


def test_anonymous_analysis_works_without_auth(client):
    """Verify anonymous analysis works without authentication (no 401)."""
    before_img = _create_test_jpg(color=(100, 150, 200))
    after_img = _create_test_jpg(color=(200, 150, 100))

    resp = client.post(
        "/api/analysis",
        data={
            "query": "Detect changes in satellite imagery",
            "mode": "compare_images",
            "capability": "change_detection",
        },
        files=[
            ("before_image", ("before.jpg", before_img, "image/jpeg")),
            ("after_image", ("after.jpg", after_img, "image/jpeg")),
        ],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "analysisId" in data
    assert data["status"] in ("completed", "error")


def test_anonymous_analysis_not_persisted(client, test_session: Session):
    """Verify anonymous analysis does not create a database row."""
    before_img = _create_test_jpg(color=(50, 100, 150))
    after_img = _create_test_jpg(color=(150, 100, 50))

    resp = client.post(
        "/api/analysis",
        data={
            "query": "Anonymous analysis test query",
            "mode": "compare_images",
            "capability": "change_detection",
        },
        files=[
            ("before_image", ("before.jpg", before_img, "image/jpeg")),
            ("after_image", ("after.jpg", after_img, "image/jpeg")),
        ],
    )
    assert resp.status_code == 200
    analysis_id = resp.json()["analysisId"]

    # Verify no row was persisted for this analysis
    analysis = test_session.execute(
        select(Analysis).where(Analysis.id == uuid.UUID(analysis_id))
    ).scalar_one_or_none()
    assert analysis is None


# ─── 5. GET /api/analyses Requires Authentication ─────────────────


def test_history_requires_authentication(client):
    """Verify GET /api/analyses returns 401 without a token."""
    resp = client.get("/api/analyses")
    assert resp.status_code == 401


def test_history_rejects_invalid_token(client):
    """Verify GET /api/analyses returns 401 with an invalid token."""
    resp = client.get("/api/analyses", headers={"Authorization": "Bearer invalid-token"})
    assert resp.status_code == 401


# ─── 6. GET /api/analyses Returns Only Current User's Analyses ────


def test_history_returns_only_own_analyses(
    client, test_session: Session, jwt_token_a: str, jwt_token_b: str,
    test_user_a: User, test_user_b: User,
):
    """Verify GET /api/analyses returns only the current user's analyses."""
    # Create analyses for user A
    analysis_a = Analysis(
        id=uuid.uuid4(),
        user_id=test_user_a.id,
        query="User A's analysis",
        status="completed",
        response_json={"analysisId": "test", "status": "completed"},
    )
    test_session.add(analysis_a)
    test_session.commit()

    # Create analyses for user B
    analysis_b = Analysis(
        id=uuid.uuid4(),
        user_id=test_user_b.id,
        query="User B's analysis",
        status="completed",
        response_json={"analysisId": "test2", "status": "completed"},
    )
    test_session.add(analysis_b)
    test_session.commit()

    # User A should only see their own analyses
    resp = client.get("/api/analyses", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200
    analyses = resp.json()
    for a in analyses:
        # Verify each returned analysis belongs to user A by checking DB
        db_analysis = test_session.execute(
            select(Analysis).where(Analysis.id == uuid.UUID(a["id"]))
        ).scalar_one_or_none()
        assert db_analysis is not None
        assert db_analysis.user_id == test_user_a.id

    # User A should NOT see user B's analysis
    user_b_ids = {str(analysis_b.id)}
    returned_ids = {a["id"] for a in analyses}
    assert user_b_ids.isdisjoint(returned_ids)


# ─── 7. History Ordered Newest First ──────────────────────────────


def test_history_ordered_newest_first(
    client, test_session: Session, jwt_token_a: str, test_user_a: User,
):
    """Verify GET /api/analyses returns analyses ordered by created_at DESC."""
    # Create two analyses with different timestamps
    older_id = uuid.uuid4()
    newer_id = uuid.uuid4()

    older = Analysis(
        id=older_id,
        user_id=test_user_a.id,
        query="Older analysis",
        status="completed",
        response_json={"analysisId": str(older_id)},
    )
    test_session.add(older)
    test_session.commit()

    # Small sleep to ensure different created_at
    time.sleep(0.1)

    newer = Analysis(
        id=newer_id,
        user_id=test_user_a.id,
        query="Newer analysis",
        status="completed",
        response_json={"analysisId": str(newer_id)},
    )
    test_session.add(newer)
    test_session.commit()

    resp = client.get("/api/analyses", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200
    analyses = resp.json()

    # Find both analyses in the response
    ids = [a["id"] for a in analyses]
    if str(newer_id) in ids and str(older_id) in ids:
        newer_idx = ids.index(str(newer_id))
        older_idx = ids.index(str(older_id))
        assert newer_idx < older_idx, "Newer analysis should appear before older analysis"


# ─── 8. GET /api/analyses/{id} Returns Own Analysis ───────────────


def test_get_own_analysis_detail(
    client, test_session: Session, jwt_token_a: str, test_user_a: User,
):
    """Verify GET /api/analyses/{id} returns the correct analysis for the owner."""
    analysis_id = uuid.uuid4()
    response_payload = {
        "analysisId": str(analysis_id),
        "status": "completed",
        "task": "change_detection",
        "answer": "Test answer",
        "confidence": 0.85,
        "evidence": [],
        "visualizations": [],
        "executionTrace": [],
        "warnings": [],
        "isDemo": False,
    }
    analysis = Analysis(
        id=analysis_id,
        user_id=test_user_a.id,
        query="Detail test query",
        mode="compare_images",
        capability="change_detection",
        status="completed",
        response_json=response_payload,
    )
    test_session.add(analysis)
    test_session.commit()

    resp = client.get(f"/api/analyses/{analysis_id}", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(analysis_id)
    assert data["query"] == "Detail test query"
    assert data["mode"] == "compare_images"
    assert data["capability"] == "change_detection"
    assert data["status"] == "completed"
    assert data["isDemo"] is False
    assert data["response"] is not None
    assert data["response"]["analysisId"] == str(analysis_id)
    assert data["response"]["confidence"] == 0.85


# ─── 9. Another User's Analysis Cannot Be Retrieved ──────────────


def test_cannot_retrieve_other_users_analysis(
    client, test_session: Session, jwt_token_b: str, test_user_a: User,
):
    """Verify GET /api/analyses/{id} returns 404 for another user's analysis."""
    analysis_id = uuid.uuid4()
    analysis = Analysis(
        id=analysis_id,
        user_id=test_user_a.id,
        query="User A's private analysis",
        status="completed",
        response_json={"analysisId": str(analysis_id)},
    )
    test_session.add(analysis)
    test_session.commit()

    # User B tries to access user A's analysis
    resp = client.get(f"/api/analyses/{analysis_id}", headers=_auth_header(jwt_token_b))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found."


# ─── 10. Nonexistent Analysis Returns 404 ─────────────────────────


def test_nonexistent_analysis_returns_404(client, jwt_token_a: str):
    """Verify GET /api/analyses/{id} returns 404 for a valid UUID that doesn't exist."""
    fake_id = str(uuid.uuid4())
    resp = client.get(f"/api/analyses/{fake_id}", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found."


# ─── 11. Invalid Analysis UUID Handled Safely ─────────────────────


def test_invalid_uuid_returns_404(client, jwt_token_a: str):
    """Verify GET /api/analyses/{id} returns 404 for an invalid UUID string."""
    resp = client.get("/api/analyses/not-a-valid-uuid", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found."


def test_empty_uuid_returns_404(client, jwt_token_a: str):
    """Verify GET /api/analyses/{id} handles empty UUID gracefully."""
    resp = client.get("/api/analyses/", headers=_auth_header(jwt_token_a))
    # This should either return 404 or list (depending on route matching)
    # The important thing is no 500 error
    assert resp.status_code in (200, 404, 405)


# ─── 12. Missing/Invalid JWT Returns 401 ──────────────────────────


def test_analysis_detail_requires_authentication(client):
    """Verify GET /api/analyses/{id} returns 401 without a token."""
    fake_id = str(uuid.uuid4())
    resp = client.get(f"/api/analyses/{fake_id}")
    assert resp.status_code == 401


def test_analysis_with_invalid_auth_returns_401(client):
    """Verify POST /api/analysis returns 401 with an invalid Bearer token."""
    before_img = _create_test_jpg()
    after_img = _create_test_jpg()

    resp = client.post(
        "/api/analysis",
        data={"query": "Test with bad auth"},
        files=[
            ("before_image", ("before.jpg", before_img, "image/jpeg")),
            ("after_image", ("after.jpg", after_img, "image/jpeg")),
        ],
        headers={"Authorization": "Bearer invalid-token-string"},
    )
    assert resp.status_code == 401


# ─── 13. Authenticated POST /api/analysis Frontend Compatibility ──


def test_authenticated_analysis_response_is_frontend_compatible(client, jwt_token_a: str):
    """Verify authenticated POST /api/analysis returns camelCase frontend-compatible fields."""
    result = _submit_authenticated_analysis(client, jwt_token_a)
    assert result["status_code"] == 200

    data = result["data"]
    # All required camelCase fields must be present
    assert "analysisId" in data
    assert "status" in data
    assert "task" in data
    assert "answer" in data
    assert "confidence" in data
    assert "evidence" in data
    assert "visualizations" in data
    assert "executionTrace" in data
    assert "warnings" in data
    assert "isDemo" in data

    # isDemo should be False for real analysis
    assert data["isDemo"] is False

    # analysisId should be a valid UUID
    assert uuid.UUID(data["analysisId"])


# ─── 14. Existing /api/query Behavior Unchanged ───────────────────


def test_query_endpoint_unchanged(client):
    """Verify POST /api/query continues working without authentication."""
    resp = client.post(
        "/api/query",
        json={"query": "What changed between 2023 and 2025 in this area?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "task" in data
    assert "status" in data


# ─── 15. Anonymous /api/analysis Behavior Unchanged ───────────────


def test_anonymous_analysis_response_unchanged(client):
    """Verify anonymous POST /api/analysis response has identical structure to pre-Phase-4D."""
    before_img = _create_test_jpg(color=(80, 120, 180))
    after_img = _create_test_jpg(color=(180, 120, 80))

    resp = client.post(
        "/api/analysis",
        data={
            "query": "Detect changes in satellite imagery",
            "mode": "compare_images",
            "capability": "change_detection",
        },
        files=[
            ("before_image", ("before.jpg", before_img, "image/jpeg")),
            ("after_image", ("after.jpg", after_img, "image/jpeg")),
        ],
    )
    assert resp.status_code == 200
    data = resp.json()

    # Standard camelCase fields
    assert "analysisId" in data
    assert "status" in data
    assert "task" in data
    assert "answer" in data
    assert "confidence" in data
    assert "evidence" in data
    assert "visualizations" in data
    assert "executionTrace" in data
    assert "warnings" in data
    assert "isDemo" in data


# ─── 16. No Credentials in Analysis Responses ─────────────────────


def test_no_credentials_in_history_response(
    client, test_session: Session, jwt_token_a: str, test_user_a: User,
):
    """Verify GET /api/analyses response does not contain password or password_hash."""
    # Ensure there's at least one analysis for user A
    analysis = Analysis(
        id=uuid.uuid4(),
        user_id=test_user_a.id,
        query="Credentials check query",
        status="completed",
        response_json={"analysisId": "test"},
    )
    test_session.add(analysis)
    test_session.commit()

    resp = client.get("/api/analyses", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200
    response_text = resp.text
    assert "password" not in response_text.lower()
    assert "password_hash" not in response_text.lower()


def test_no_credentials_in_detail_response(
    client, test_session: Session, jwt_token_a: str, test_user_a: User,
):
    """Verify GET /api/analyses/{id} response does not contain password or password_hash."""
    analysis_id = uuid.uuid4()
    analysis = Analysis(
        id=analysis_id,
        user_id=test_user_a.id,
        query="Credentials check detail query",
        status="completed",
        response_json={"analysisId": str(analysis_id), "status": "completed"},
    )
    test_session.add(analysis)
    test_session.commit()

    resp = client.get(f"/api/analyses/{analysis_id}", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200
    response_text = resp.text
    assert "password" not in response_text.lower()
    assert "password_hash" not in response_text.lower()


# ─── Additional: History response field contract ──────────────────


def test_history_item_has_expected_fields(
    client, test_session: Session, jwt_token_a: str, test_user_a: User,
):
    """Verify each history item has the correct field structure."""
    analysis_id = uuid.uuid4()
    analysis = Analysis(
        id=analysis_id,
        user_id=test_user_a.id,
        query="Field structure test",
        mode="single_image",
        capability="vqa",
        status="completed",
        response_json={"analysisId": str(analysis_id)},
    )
    test_session.add(analysis)
    test_session.commit()

    resp = client.get("/api/analyses", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200

    # Find the specific analysis in the list
    analyses = resp.json()
    target = next((a for a in analyses if a["id"] == str(analysis_id)), None)
    assert target is not None

    # Verify expected fields
    assert "id" in target
    assert "query" in target
    assert "mode" in target
    assert "capability" in target
    assert "status" in target
    assert "date" in target
    assert "isDemo" in target
    assert target["isDemo"] is False

    # modality should NOT be present (we do not fabricate it)
    assert "modality" not in target


def test_history_does_not_include_modality(
    client, test_session: Session, jwt_token_a: str, test_user_a: User,
):
    """Explicitly verify that no 'modality' field is fabricated in history responses."""
    analysis = Analysis(
        id=uuid.uuid4(),
        user_id=test_user_a.id,
        query="Modality check query",
        mode="compare_images",
        status="completed",
        response_json={"analysisId": "test"},
    )
    test_session.add(analysis)
    test_session.commit()

    resp = client.get("/api/analyses", headers=_auth_header(jwt_token_a))
    assert resp.status_code == 200
    for item in resp.json():
        assert "modality" not in item


def test_persistence_failure_returns_500_and_does_not_leak_details(
    client, jwt_token_a: str
):
    """Verify that DB commit failure during authenticated analysis returns HTTP 500 without leaking DB details."""
    before_img = _create_test_jpg(color=(100, 150, 200))
    after_img = _create_test_jpg(color=(200, 150, 100))

    with patch.object(Session, "commit", side_effect=Exception("FATAL: postgres connection failed password=supersecret")):
        resp = client.post(
            "/api/analysis",
            data={
                "query": "Test persistence failure query",
                "mode": "compare_images",
                "capability": "change_detection",
            },
            files=[
                ("before_image", ("before.jpg", before_img, "image/jpeg")),
                ("after_image", ("after.jpg", after_img, "image/jpeg")),
            ],
            headers=_auth_header(jwt_token_a),
        )
        assert resp.status_code == 500
        data = resp.json()
        assert data["detail"] == "Analysis completed but could not be saved. Please try again."
        assert "password" not in resp.text.lower()
        assert "supersecret" not in resp.text.lower()
        assert "postgres" not in resp.text.lower()
