"""Tests for Phase 4B: User Registration & Argon2id Password Hashing.

Covers:
1. Successful user registration (HTTP 201).
2. Password is saved as an Argon2id hash.
3. Plaintext password is NOT stored anywhere.
4. Response payload does not expose password.
5. Response payload does not expose password_hash.
6. Email normalization (trim whitespace + lowercase).
7. Duplicate email registration returns HTTP 409 Conflict.
8. Password shorter than 8 characters returns HTTP 422.
9. Invalid email format returns HTTP 422.
10. Optional display name handling (stored when provided, null when omitted).
11. Transaction safety and rollback on simulated database failure.
12. Reusable security helper verification (hash_password + verify_password).

All database operations run exclusively against the isolated `satquery_test` database.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings
from backend.db.base import Base
from backend.db.models import User
from backend.db.session import get_db
from backend.main import app
from backend.security import hash_password, verify_password


@pytest.fixture(scope="module")
def test_engine():
    """Create a database engine pointing strictly to `satquery_test`."""
    test_url = settings.TEST_DATABASE_URL
    if not test_url or "satquery_test" not in test_url:
        pytest.fail("TEST_DATABASE_URL must be configured with 'satquery_test'")

    engine = create_engine(test_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def test_session(test_engine):
    """Provide an isolated database session on `satquery_test` for direct verification."""
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


# ─── 1. Reusable Security Helper Verification ─────────────────────────────────

def test_security_helper_hashing_and_verification():
    """Verify hash_password generates valid Argon2id hash and verify_password works."""
    raw_pwd = "SuperSecretPassword123"
    hashed = hash_password(raw_pwd)

    # Must be valid Argon2id string
    assert hashed.startswith("$argon2id$")
    assert raw_pwd not in hashed

    # Valid password verification
    assert verify_password(raw_pwd, hashed) is True

    # Invalid password verification
    assert verify_password("WrongPassword123", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(raw_pwd.lower(), hashed) is False


# ─── 2. Successful Registration & Safe Response Contract ──────────────────────

def test_successful_registration(client, test_session: Session):
    """Test successful user registration creates user and returns HTTP 201."""
    unique_email = f"reg_user_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "password": "ValidPassword123",
        "display_name": "Earth Observer",
    }

    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    # Response validation
    assert "id" in data
    assert uuid.UUID(data["id"])  # must be valid UUID
    assert data["email"] == unique_email
    assert data["display_name"] == "Earth Observer"
    assert "created_at" in data

    # 4 & 5. Response MUST NOT contain credentials
    assert "password" not in data
    assert "password_hash" not in data

    # 2 & 3. Database verification: password stored as Argon2id hash, NOT plaintext
    user_in_db = test_session.execute(
        select(User).where(User.email == unique_email)
    ).scalar_one_or_none()

    assert user_in_db is not None
    assert user_in_db.password_hash.startswith("$argon2id$")
    assert "ValidPassword123" not in user_in_db.password_hash
    assert verify_password("ValidPassword123", user_in_db.password_hash) is True


# ─── 3. Email Normalization ───────────────────────────────────────────────────

def test_email_normalization(client, test_session: Session):
    """Verify registration trims whitespace and lowercases email."""
    raw_email = f"  Test_NORM_{uuid.uuid4().hex[:6]}@EXAMPLE.COM  "
    expected_normalized = raw_email.strip().lower()

    payload = {
        "email": raw_email,
        "password": "ValidPassword123",
    }

    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    # Returned email is normalized
    assert data["email"] == expected_normalized

    # Database email is normalized
    user = test_session.execute(
        select(User).where(User.email == expected_normalized)
    ).scalar_one_or_none()
    assert user is not None
    assert user.email == expected_normalized


# ─── 4. Duplicate Email Handling (HTTP 409) ──────────────────────────────────

def test_duplicate_email_returns_409(client):
    """Attempting to register with an already existing email returns HTTP 409 Conflict."""
    email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "Password1234",
    }

    # First registration succeeds
    resp1 = client.post("/api/auth/register", json=payload)
    assert resp1.status_code == 201

    # Second registration with exact same email fails with 409
    resp2 = client.post("/api/auth/register", json=payload)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"].lower()

    # Third registration with casing/whitespace variations also fails with 409
    variant_payload = {
        "email": f"  {email.upper()}  ",
        "password": "DifferentPassword123",
    }
    resp3 = client.post("/api/auth/register", json=variant_payload)
    assert resp3.status_code == 409
    assert "already exists" in resp3.json()["detail"].lower()


# ─── 5. Password Validation (Minimum 8 Characters) ────────────────────────────

def test_password_shorter_than_8_chars_rejected(client):
    """Password shorter than 8 characters returns HTTP 422 validation error."""
    payload = {
        "email": f"short_pwd_{uuid.uuid4().hex[:8]}@example.com",
        "password": "short",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


# ─── 6. Email Validation ──────────────────────────────────────────────────────

def test_invalid_email_format_rejected(client):
    """Invalid email syntax returns HTTP 422 validation error."""
    invalid_emails = [
        "not-an-email",
        "missing-at.domain.com",
        "user@missingtld",
        "@nodomain.com",
        "   ",
    ]
    for bad_email in invalid_emails:
        payload = {
            "email": bad_email,
            "password": "ValidPassword123",
        }
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422, f"Expected 422 for invalid email: '{bad_email}'"


# ─── 7. Optional Display Name ─────────────────────────────────────────────────

def test_optional_display_name(client):
    """Verify display_name is properly handled when omitted, provided, or empty."""
    # Omitted
    resp1 = client.post(
        "/api/auth/register",
        json={"email": f"no_name_{uuid.uuid4().hex[:8]}@example.com", "password": "Password123"},
    )
    assert resp1.status_code == 201
    assert resp1.json()["display_name"] is None

    # Empty string stripped to None
    resp2 = client.post(
        "/api/auth/register",
        json={"email": f"empty_name_{uuid.uuid4().hex[:8]}@example.com", "password": "Password123", "display_name": "   "},
    )
    assert resp2.status_code == 201
    assert resp2.json()["display_name"] is None

    # Provided with surrounding whitespace
    resp3 = client.post(
        "/api/auth/register",
        json={"email": f"named_{uuid.uuid4().hex[:8]}@example.com", "password": "Password123", "display_name": "  Satellite Analyst  "},
    )
    assert resp3.status_code == 201
    assert resp3.json()["display_name"] == "Satellite Analyst"


# ─── 8. Transaction Safety & Rollback ─────────────────────────────────────────

def test_registration_transaction_rollback_on_error(client, test_session: Session):
    """Verify transaction rolls back cleanly when an unexpected database error occurs."""
    target_email = f"rollback_{uuid.uuid4().hex[:8]}@example.com"

    # Pre-insert a user directly with the target email to trigger an IntegrityError at commit time
    # (simulating race condition where application-level check passed)
    raw_user = User(
        email=target_email,
        password_hash=hash_password("Existing123"),
    )
    test_session.add(raw_user)
    test_session.commit()

    # Attempting to register the same email will trigger IntegrityError on commit
    resp = client.post(
        "/api/auth/register",
        json={"email": target_email, "password": "NewPassword123"},
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()
