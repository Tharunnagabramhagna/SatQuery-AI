"""Comprehensive tests for Email Verification flow in SatQuery AI.

Covers:
1. Registration creates unverified user (email_verified=False).
2. Verification code is generated and stored as SHA-256 hash (never plaintext).
3. Plaintext OTP is NOT present in API response or logs.
4. Email sender captures OTP in memory safely.
5. Unverified user receives HTTP 403 Forbidden upon login.
6. Correct OTP verifies account (email_verified=True, email_verified_at set).
7. Verified user logs in with password and receives JWT without OTP prompt.
8. Subsequent logins do NOT require verification code.
9. Wrong verification code is rejected with HTTP 400 and remaining attempts count.
10. Attempt limit (5 attempts) marks verification failed and returns HTTP 429.
11. Expired verification code is rejected.
12. Already used / verified code cannot be reused.
13. Resend invalidates previous pending codes and generates fresh OTP.
14. Resend enforces 60-second cooldown with HTTP 429 and Retry-After header.
15. Resend for unknown email returns generic safe message (prevents enumeration).
16. Social-only account (password_hash=None) attempting password login returns controlled 401.
"""

import datetime
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings
from backend.db.base import Base
from backend.db.models import EmailVerification, User
from backend.db.session import get_db
from backend.main import app
from backend.services.email import InMemoryEmailSender, get_email_sender, set_email_sender


@pytest.fixture(autouse=True)
def email_mock():
    """Inject an in-memory email sender to capture emails safely."""
    sender = InMemoryEmailSender()
    set_email_sender(sender)
    yield sender
    sender.clear()


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
    """Direct database session for inspecting DB records."""
    SessionTesting = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = SessionTesting()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ─── 1. Registration & Initial State ──────────────────────────────────────────


def test_registration_creates_unverified_user_and_sends_otp(client, db_session: Session, email_mock):
    """Verify registration creates email_verified=False and sends 6-digit OTP."""
    email = f"unverified_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "display_name": "Unverified User"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == email
    assert data["email_verified"] is False
    assert "password" not in data
    assert "password_hash" not in data
    assert "code" not in data
    assert "otp" not in data

    # Verify DB user record
    user = db_session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    assert user is not None
    assert user.email_verified is False
    assert user.email_verified_at is None
    assert user.auth_provider == "local"

    # Verify EmailVerification record in DB
    ver = db_session.execute(
        select(EmailVerification).where(EmailVerification.user_id == user.id)
    ).scalar_one_or_none()
    assert ver is not None
    assert ver.status == "pending"
    assert ver.attempts == 0
    assert len(ver.code_hash) == 64  # SHA-256 length

    # Email sender captured email
    sent = email_mock.get_last_email()
    assert sent is not None
    assert sent["to_email"] == email
    assert len(sent["code"]) == 6
    assert sent["code"].isdigit()

    # Plaintext OTP is NEVER stored directly in code_hash
    assert sent["code"] != ver.code_hash


# ─── 2. Login Blocked for Unverified Account ──────────────────────────────────


def test_unverified_user_cannot_login(client):
    """Verify login for unverified user returns HTTP 403 with clear message."""
    email = f"blocked_login_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})

    # Attempt login before verification
    login_resp = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login_resp.status_code == 403
    assert "verify your email" in login_resp.json()["detail"].lower()


# ─── 3. Successful Email Verification & Permanent Login ───────────────────────


def test_successful_verification_and_subsequent_logins(client, db_session: Session, email_mock):
    """Verify correct OTP activates account and allows repeated password login without OTP."""
    email = f"verified_login_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})
    code = email_mock.get_last_code_for(email)
    assert code is not None

    # Submit verification code
    ver_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert ver_resp.status_code == 200
    ver_data = ver_resp.json()
    assert ver_data["email_verified"] is True
    assert "verified" in ver_data["message"].lower()

    # DB user is marked verified
    user = db_session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    assert user.email_verified is True
    assert user.email_verified_at is not None

    # First login with password -> receives JWT
    login_1 = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login_1.status_code == 200
    token_1 = login_1.json()["access_token"]
    assert token_1 is not None

    # Second login with password -> NO OTP required, receives JWT again
    login_2 = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login_2.status_code == 200
    token_2 = login_2.json()["access_token"]
    assert token_2 is not None

    # Verify /api/auth/me works with issued JWT
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_2}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email
    assert me_resp.json()["email_verified"] is True


# ─── 4. Verification Errors: Wrong Code, Attempts, Expiry, Reuse ─────────────


def test_wrong_code_rejected_and_tracks_attempts(client, email_mock):
    """Verify wrong code is rejected with HTTP 400 and decrements remaining attempts."""
    email = f"wrong_code_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})

    resp = client.post("/api/auth/verify-email", json={"email": email, "code": "000000"})
    assert resp.status_code == 400
    assert "invalid verification code" in resp.json()["detail"].lower()
    assert "4 attempt" in resp.json()["detail"].lower()


def test_max_attempts_exceeded_locks_code(client, db_session: Session):
    """Verify exceeding 5 failed attempts marks status as max_attempts_exceeded and locks code."""
    email = f"max_attempts_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})

    # Attempt 1 through 4
    for _ in range(4):
        client.post("/api/auth/verify-email", json={"email": email, "code": "999999"})

    # Attempt 5 -> should lock out with 429
    resp_5 = client.post("/api/auth/verify-email", json={"email": email, "code": "999999"})
    assert resp_5.status_code == 429
    assert "too many failed attempts" in resp_5.json()["detail"].lower()

    # Verify status in database is normalized to max_attempts_exceeded
    user = db_session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    ver = db_session.execute(
        select(EmailVerification).where(EmailVerification.user_id == user.id)
    ).scalar_one_or_none()
    assert ver.status == "max_attempts_exceeded"
    assert ver.attempts >= 5


def test_expired_code_rejected(client, db_session: Session, email_mock):
    """Verify expired verification code is rejected with HTTP 400."""
    email = f"expired_code_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})
    code = email_mock.get_last_code_for(email)

    # Manually expire the code in DB
    user = db_session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    ver = db_session.execute(
        select(EmailVerification).where(EmailVerification.user_id == user.id)
    ).scalar_one_or_none()
    ver.expires_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1)
    db_session.commit()

    resp = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_reused_code_returns_already_verified(client, email_mock):
    """Verify submitting code for an already verified user is handled safely."""
    email = f"reuse_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})
    code = email_mock.get_last_code_for(email)

    # Verify first time
    client.post("/api/auth/verify-email", json={"email": email, "code": code})

    # Submit again
    resp_again = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert resp_again.status_code == 200
    assert resp_again.json()["email_verified"] is True
    assert "already verified" in resp_again.json()["message"].lower()


# ─── 5. Resend Verification Flow & Cooldown ───────────────────────────────────


def test_resend_verification_invalidates_old_and_generates_fresh_code(
    client, db_session: Session, email_mock, monkeypatch
):
    """Verify resend creates a new OTP and soft-invalidates previous pending codes."""
    # Temporarily set cooldown to 0 to test code generation immediately
    monkeypatch.setattr(settings, "EMAIL_RESEND_COOLDOWN_SECONDS", 0)

    email = f"resend_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})
    code_1 = email_mock.get_last_code_for(email)

    # Resend
    resend_resp = client.post("/api/auth/resend-verification", json={"email": email})
    assert resend_resp.status_code == 200
    code_2 = email_mock.get_last_code_for(email)

    # Old code should no longer work
    fail_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code_1})
    # If code_1 happens to differ from code_2, code_1 is rejected
    if code_1 != code_2:
        assert fail_resp.status_code == 400

    # New code must verify successfully
    ok_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code_2})
    assert ok_resp.status_code == 200
    assert ok_resp.json()["email_verified"] is True


def test_resend_cooldown_enforced(client, email_mock):
    """Verify requesting resend before cooldown elapses returns HTTP 429."""
    email = f"cooldown_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecurePassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})

    # Immediate second request
    resp = client.post("/api/auth/resend-verification", json={"email": email})
    assert resp.status_code == 429
    assert "wait" in resp.json()["detail"].lower()
    assert "retry-after" in resp.headers


def test_resend_unknown_email_returns_safe_message(client):
    """Verify resending for unregistered email does not leak account existence."""
    resp = client.post(
        "/api/auth/resend-verification",
        json={"email": "nonexistent_999@example.com"},
    )
    assert resp.status_code == 200
    assert "if this email is registered" in resp.json()["message"].lower()


# ─── 6. Social Account Guard on Password Login ────────────────────────────────


def test_social_only_account_password_login_returns_guided_401(client, db_session: Session):
    """Verify an OAuth-only user (password_hash=None) receives a guided error on password login."""
    email = f"oauth_only_{uuid.uuid4().hex[:8]}@example.com"
    social_user = User(
        email=email,
        password_hash=None,
        display_name="Social User",
        email_verified=True,
        auth_provider="google",
        google_id=f"gid_{uuid.uuid4().hex[:8]}",
    )
    db_session.add(social_user)
    db_session.commit()

    resp = client.post("/api/auth/login", json={"email": email, "password": "AnyPassword123"})
    assert resp.status_code == 401
    assert "social login" in resp.json()["detail"].lower()
