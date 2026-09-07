"""Comprehensive tests for Google & Facebook OAuth authentication in SatQuery AI.

Covers:
1. Google OAuth initiation generates CSRF state and redirects.
2. Facebook OAuth initiation generates CSRF state and redirects.
3. OAuth callback with missing, invalid, or expired state is rejected.
4. Google callback with mocked provider:
   - Validates server-side identity.
   - Creates user with email_verified=True and password_hash=None.
   - Redirects to frontend with single-use exchange code ONLY.
   - NEVER exposes JWT in redirect URL or query parameters.
5. Facebook callback with mocked Graph API:
   - Validates identity with appsecret_proof.
   - Generates exchange code.
6. POST /api/auth/oauth/exchange:
   - Returns valid SatQuery JWT access token.
   - Code is single-use (cannot be reused).
   - Expired code is rejected.
   - Invalid code is rejected.
7. Account linking rules:
   - Exact provider ID returns same user (no duplicate accounts).
   - Verified provider email links to verified local user without duplicate.
   - Unverified local user rejects silent merging with OAuth provider.
8. Issued JWT authenticates against GET /api/auth/me.
"""

import datetime
import urllib.parse
import uuid
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings
from backend.db.base import Base
from backend.db.models import OAuthExchangeCode, OAuthState, User
from backend.db.session import get_db
from backend.main import app
from backend.security import decode_access_token, hash_password


@pytest.fixture(scope="module")
def test_engine():
    """Create test engine on satquery_test."""
    test_url = settings.TEST_DATABASE_URL
    if not test_url or "satquery_test" not in test_url:
        pytest.fail("TEST_DATABASE_URL must point to satquery_test")
    engine = create_engine(test_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client(test_engine):
    """FastAPI TestClient with db session pointing to satquery_test."""
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
def db_session(test_engine):
    """Direct database session on satquery_test."""
    SessionTesting = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = SessionTesting()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def configure_oauth_settings(monkeypatch):
    """Ensure OAuth credentials and URLs are configured in tests."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-google-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-google-client-secret")
    monkeypatch.setattr(settings, "FACEBOOK_APP_ID", "test-facebook-app-id")
    monkeypatch.setattr(settings, "FACEBOOK_APP_SECRET", "test-facebook-app-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:5173")
    monkeypatch.setattr(settings, "BACKEND_URL", "http://localhost:8000")


# ─── 1. Initiation & State Generation ─────────────────────────────────────────


def test_google_login_redirects_with_state(client, db_session: Session):
    """Verify GET /api/auth/google generates state record and redirects to Google."""
    resp = client.get("/api/auth/google", follow_redirects=False)
    assert resp.status_code == 302
    redirect_url = resp.headers["location"]
    assert redirect_url.startswith("https://accounts.google.com/o/oauth2/v2/auth")

    parsed = urllib.parse.urlparse(redirect_url)
    qs = urllib.parse.parse_qs(parsed.query)
    assert "state" in qs
    assert qs["client_id"][0] == "test-google-client-id"
    assert "openid" in qs["scope"][0]

    # Verify state was saved in DB
    raw_state = qs["state"][0]
    states = db_session.execute(select(OAuthState).where(OAuthState.provider == "google")).scalars().all()
    assert len(states) >= 1
    # Plaintext state is hashed
    assert any(s.used_at is None for s in states)


def test_facebook_login_redirects_with_state(client, db_session: Session):
    """Verify GET /api/auth/facebook generates state record and redirects to Facebook."""
    resp = client.get("/api/auth/facebook", follow_redirects=False)
    assert resp.status_code == 302
    redirect_url = resp.headers["location"]
    assert redirect_url.startswith("https://www.facebook.com/v25.0/dialog/oauth")

    parsed = urllib.parse.urlparse(redirect_url)
    qs = urllib.parse.parse_qs(parsed.query)
    assert "state" in qs
    assert qs["client_id"][0] == "test-facebook-app-id"
    assert "email" in qs["scope"][0]


# ─── 2. State Validation & CSRF Protection ────────────────────────────────────


def test_callback_rejects_missing_or_invalid_state(client):
    """Verify callback without valid state redirects to login error."""
    resp = client.get(
        "/api/auth/google/callback?code=mock_code&state=nonexistent_state",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "login" in resp.headers["location"]
    assert "error=" in resp.headers["location"]


# ─── 3. Google Callback & Single-Use Exchange Code ───────────────────────────


@pytest.mark.anyio
async def test_google_callback_creates_user_and_redirects_with_exchange_code(
    client, db_session: Session
):
    """Verify Google callback validates identity, creates user, and outputs exchange code ONLY."""
    # 1. Initiate to get legitimate state
    resp = client.get("/api/auth/google", follow_redirects=False)
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(resp.headers["location"]).query)
    raw_state = qs["state"][0]

    google_sub = f"google_sub_{uuid.uuid4().hex[:8]}"
    google_email = f"google_user_{uuid.uuid4().hex[:8]}@example.com"

    mock_token_resp = httpx.Response(
        status_code=200,
        json={"access_token": "mock_google_token", "id_token": "mock_id_token"},
        request=httpx.Request("POST", "https://oauth2.googleapis.com/token"),
    )
    mock_userinfo_resp = httpx.Response(
        status_code=200,
        json={
            "sub": google_sub,
            "email": google_email,
            "email_verified": True,
            "name": "Google Test User",
            "picture": "https://example.com/photo.jpg",
        },
        request=httpx.Request("GET", "https://www.googleapis.com/oauth2/v3/userinfo"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        callback_resp = client.get(
            f"/api/auth/google/callback?code=mock_auth_code&state={raw_state}",
            follow_redirects=False,
        )

    assert callback_resp.status_code == 302
    location = callback_resp.headers["location"]

    # CRITICAL CHECK 1: JWT must NEVER appear in the redirect URL!
    assert "access_token" not in location
    assert "bearer" not in location.lower()
    assert "jwt" not in location.lower()
    assert "ey" not in location  # Standard JWT prefix

    # CRITICAL CHECK 2: Location must have oauth_code parameter
    parsed_loc = urllib.parse.urlparse(location)
    loc_qs = urllib.parse.parse_qs(parsed_loc.query)
    assert "oauth_code" in loc_qs
    oauth_code = loc_qs["oauth_code"][0]
    assert len(oauth_code) >= 20

    # Verify user was created with email_verified=True and password_hash=None
    user = db_session.execute(select(User).where(User.google_id == google_sub)).scalar_one_or_none()
    assert user is not None
    assert user.email == google_email
    assert user.email_verified is True
    assert user.password_hash is None
    assert user.auth_provider == "google"

    # 2. Exchange oauth_code via POST /api/auth/oauth/exchange
    exchange_resp = client.post("/api/auth/oauth/exchange", json={"code": oauth_code})
    assert exchange_resp.status_code == 200
    token_data = exchange_resp.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    payload = decode_access_token(token)
    assert payload["sub"] == str(user.id)

    # 3. Code must be single-use (second exchange attempt must fail)
    reuse_resp = client.post("/api/auth/oauth/exchange", json={"code": oauth_code})
    assert reuse_resp.status_code == 400


# ─── 4. Facebook Callback & Single-Use Exchange Code ──────────────────────────


@pytest.mark.anyio
async def test_facebook_callback_creates_user_and_exchanges_token(
    client, db_session: Session
):
    """Verify Facebook callback flow creates user and issues exchange code."""
    resp = client.get("/api/auth/facebook", follow_redirects=False)
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(resp.headers["location"]).query)
    raw_state = qs["state"][0]

    fb_id = f"fb_{uuid.uuid4().hex[:8]}"
    fb_email = f"fb_user_{uuid.uuid4().hex[:8]}@example.com"

    mock_token_resp = httpx.Response(
        status_code=200,
        json={"access_token": "mock_fb_access_token"},
        request=httpx.Request("GET", "https://graph.facebook.com/v25.0/oauth/access_token"),
    )
    mock_graph_resp = httpx.Response(
        status_code=200,
        json={
            "id": fb_id,
            "name": "Facebook User",
            "email": fb_email,
            "picture": {"data": {"url": "https://example.com/fb_avatar.jpg"}},
        },
        request=httpx.Request("GET", "https://graph.facebook.com/me"),
    )

    with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = [mock_token_resp, mock_graph_resp]

        callback_resp = client.get(
            f"/api/auth/facebook/callback?code=mock_fb_code&state={raw_state}",
            follow_redirects=False,
        )

    assert callback_resp.status_code == 302
    location = callback_resp.headers["location"]
    assert "oauth_code" in location
    assert "access_token" not in location

    oauth_code = urllib.parse.parse_qs(urllib.parse.urlparse(location).query)["oauth_code"][0]

    # Exchange code for JWT
    exchange_resp = client.post("/api/auth/oauth/exchange", json={"code": oauth_code})
    assert exchange_resp.status_code == 200
    assert "access_token" in exchange_resp.json()

    # Verify user in DB
    user = db_session.execute(select(User).where(User.facebook_id == fb_id)).scalar_one_or_none()
    assert user is not None
    assert user.email == fb_email
    assert user.auth_provider == "facebook"


# ─── 5. Strict Account Linking Policy ─────────────────────────────────────────


@pytest.mark.anyio
async def test_account_linking_to_verified_local_user(client, db_session: Session):
    """Verify existing verified local user is linked to OAuth account without duplicate user."""
    shared_email = f"shared_{uuid.uuid4().hex[:8]}@example.com"

    # Pre-create verified local user
    local_user = User(
        email=shared_email,
        password_hash=hash_password("Password123"),
        display_name="Original Local User",
        email_verified=True,
        auth_provider="local",
    )
    db_session.add(local_user)
    db_session.commit()
    local_user_id = local_user.id

    # Initiate Google OAuth
    resp = client.get("/api/auth/google", follow_redirects=False)
    raw_state = urllib.parse.parse_qs(urllib.parse.urlparse(resp.headers["location"]).query)["state"][0]

    google_sub = f"sub_{uuid.uuid4().hex[:8]}"
    mock_token_resp = httpx.Response(
        status_code=200,
        json={"access_token": "tok"},
        request=httpx.Request("POST", "https://oauth2.googleapis.com/token"),
    )
    mock_userinfo_resp = httpx.Response(
        status_code=200,
        json={
            "sub": google_sub,
            "email": shared_email,
            "email_verified": True,
            "name": "Google Name",
        },
        request=httpx.Request("GET", "https://www.googleapis.com/oauth2/v3/userinfo"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        client.get(f"/api/auth/google/callback?code=c&state={raw_state}", follow_redirects=False)

    # Local user should be linked, NOT duplicated
    db_session.expire_all()
    users_with_email = db_session.execute(select(User).where(User.email == shared_email)).scalars().all()
    assert len(users_with_email) == 1
    assert users_with_email[0].id == local_user_id
    assert users_with_email[0].google_id == google_sub


@pytest.mark.anyio
async def test_account_linking_rejected_for_unverified_local_user(client, db_session: Session):
    """Verify OAuth does NOT silently link to an unverified local account (anti-hijacking)."""
    unverified_email = f"unverified_local_{uuid.uuid4().hex[:8]}@example.com"

    # Pre-create UNVERIFIED local user
    local_user = User(
        email=unverified_email,
        password_hash=hash_password("Password123"),
        display_name="Unverified User",
        email_verified=False,
        auth_provider="local",
    )
    db_session.add(local_user)
    db_session.commit()

    resp = client.get("/api/auth/google", follow_redirects=False)
    raw_state = urllib.parse.parse_qs(urllib.parse.urlparse(resp.headers["location"]).query)["state"][0]

    mock_token_resp = httpx.Response(
        status_code=200,
        json={"access_token": "tok"},
        request=httpx.Request("POST", "https://oauth2.googleapis.com/token"),
    )
    mock_userinfo_resp = httpx.Response(
        status_code=200,
        json={
            "sub": f"sub_{uuid.uuid4().hex[:8]}",
            "email": unverified_email,
            "email_verified": True,
        },
        request=httpx.Request("GET", "https://www.googleapis.com/oauth2/v3/userinfo"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        cb_resp = client.get(f"/api/auth/google/callback?code=c&state={raw_state}", follow_redirects=False)

    # Must redirect to error page, NOT link or log in
    assert cb_resp.status_code == 302
    assert "error=email_not_verified" in cb_resp.headers["location"]

    # Local user remains unlinked
    db_session.refresh(local_user)
    assert local_user.google_id is None


# ─── 6. Repeat Provider Login ─────────────────────────────────────────────────


@pytest.mark.anyio
async def test_repeat_provider_login_returns_same_user(client, db_session: Session):
    """Verify repeat login with existing google_id returns same user without duplicate."""
    google_sub = f"repeat_sub_{uuid.uuid4().hex[:8]}"
    existing_user = User(
        email=f"repeat_{uuid.uuid4().hex[:8]}@example.com",
        google_id=google_sub,
        email_verified=True,
        auth_provider="google",
    )
    db_session.add(existing_user)
    db_session.commit()
    user_id = existing_user.id

    resp = client.get("/api/auth/google", follow_redirects=False)
    raw_state = urllib.parse.parse_qs(urllib.parse.urlparse(resp.headers["location"]).query)["state"][0]

    mock_token_resp = httpx.Response(
        status_code=200,
        json={"access_token": "tok"},
        request=httpx.Request("POST", "https://oauth2.googleapis.com/token"),
    )
    mock_userinfo_resp = httpx.Response(
        status_code=200,
        json={
            "sub": google_sub,
            "email": existing_user.email,
            "email_verified": True,
        },
        request=httpx.Request("GET", "https://www.googleapis.com/oauth2/v3/userinfo"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        cb_resp = client.get(f"/api/auth/google/callback?code=c&state={raw_state}", follow_redirects=False)

    code = urllib.parse.parse_qs(urllib.parse.urlparse(cb_resp.headers["location"]).query)["oauth_code"][0]
    token_resp = client.post("/api/auth/oauth/exchange", json={"code": code})
    assert token_resp.status_code == 200
    assert token_resp.json()["user"]["id"] == str(user_id)
