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

import datetime
import uuid
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings
from backend.db.base import Base
from backend.db.models import Analysis, User
from backend.db.session import get_db
from backend.main import app
from backend.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from backend.security.jwt import get_jwt_secret_key


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


# ─── 9. Phase 4C: Login & Token Issuance ──────────────────────────────────────

@pytest.fixture(autouse=True)
def ensure_test_jwt_secret(monkeypatch):
    """Ensure a valid test secret key is configured for all auth tests."""
    if not settings.JWT_SECRET_KEY:
        monkeypatch.setattr(
            settings,
            "JWT_SECRET_KEY",
            "test-secret-key-32-chars-long-strictly-for-unit-tests",
        )


def test_successful_login_and_token_structure(client):
    """Verify login returns 200, JWT access token, and safe user profile without credentials."""
    email = f"login_user_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "ValidLoginPass123"

    # Register user first
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "display_name": "Login Tester"},
    )
    assert reg_resp.status_code == 201
    user_id_str = reg_resp.json()["id"]

    # 1. Login with valid credentials
    resp = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert resp.status_code == 200
    data = resp.json()

    # 2. Token response structure
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"
    assert data["expires_in"] == settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert "user" in data

    # 3, 4, 5. Token claims verification
    token = data["access_token"]
    payload = decode_access_token(token)
    assert payload["sub"] == user_id_str
    assert "exp" in payload
    assert "iat" in payload
    assert payload["exp"] > payload["iat"]

    # Profile in login response excludes password and password_hash
    user_info = data["user"]
    assert user_info["id"] == user_id_str
    assert user_info["email"] == email
    assert user_info["display_name"] == "Login Tester"
    assert "password" not in user_info
    assert "password_hash" not in user_info


def test_login_wrong_password_and_unknown_email(client):
    """Verify both incorrect password and unknown email return generic 401 Unauthorized."""
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "CorrectPassword123"

    # Register
    client.post("/api/auth/register", json={"email": email, "password": pwd})

    # Case A: Wrong password
    resp_wrong_pwd = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword999"})
    assert resp_wrong_pwd.status_code == 401
    assert resp_wrong_pwd.headers.get("www-authenticate") == "Bearer"
    assert resp_wrong_pwd.json()["detail"] == "Invalid email or password."

    # Case B: Unknown email
    resp_unknown_email = client.post(
        "/api/auth/login",
        json={"email": "nonexistent_email_404@example.com", "password": pwd},
    )
    assert resp_unknown_email.status_code == 401
    assert resp_unknown_email.headers.get("www-authenticate") == "Bearer"
    assert resp_unknown_email.json()["detail"] == "Invalid email or password."

    # Verify identical error message and code to prevent account enumeration
    assert resp_wrong_pwd.json() == resp_unknown_email.json()


def test_login_email_normalization(client):
    """Verify login handles case and whitespace variations identically."""
    base_email = f"norm_login_{uuid.uuid4().hex[:6]}@example.com"
    pwd = "NormPassword123"

    client.post("/api/auth/register", json={"email": base_email, "password": pwd})

    # Login with mixed case and leading/trailing whitespace
    noisy_email = f"  {base_email.upper()}  "
    resp = client.post("/api/auth/login", json={"email": noisy_email, "password": pwd})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


# ─── 10. Phase 4C: GET /api/auth/me (Current User Endpoint) ───────────────────

def test_current_user_me_endpoint_success(client):
    """Verify GET /api/auth/me returns safe profile of authenticated user."""
    email = f"me_test_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "MySecretPass123"

    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "display_name": "Me User"},
    )
    assert reg.status_code == 201
    user_id = reg.json()["id"]

    login = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    token = login.json()["access_token"]

    # Query /api/auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200

    me_data = me_resp.json()
    assert me_data["id"] == user_id
    assert me_data["email"] == email
    assert me_data["display_name"] == "Me User"
    assert "created_at" in me_data
    assert "password" not in me_data
    assert "password_hash" not in me_data


def test_current_user_me_missing_token(client):
    """GET /api/auth/me without Authorization header returns 401."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


def test_current_user_me_invalid_scheme(client):
    """GET /api/auth/me with non-Bearer scheme returns 401."""
    resp = client.get("/api/auth/me", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


def test_current_user_me_malformed_token(client):
    """GET /api/auth/me with malformed token string returns 401."""
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


def test_current_user_me_invalid_signature(client):
    """GET /api/auth/me with token signed by a different secret returns 401."""
    fake_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "exp": 9999999999, "iat": 1},
        "completely-different-wrong-secret-key-12345",
        algorithm="HS256",
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


def test_current_user_me_expired_token(client):
    """GET /api/auth/me with expired token returns 401."""
    fake_id = uuid.uuid4()
    expired_token = create_access_token(
        fake_id,
        expires_delta=datetime.timedelta(seconds=-60),
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


def test_current_user_me_missing_sub_or_invalid_uuid(client):
    """GET /api/auth/me with missing sub or non-UUID sub returns 401."""
    secret = get_jwt_secret_key()

    # Missing sub
    token_no_sub = jwt.encode(
        {"exp": 9999999999, "iat": 1},
        secret,
        algorithm="HS256",
    )
    resp1 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_no_sub}"})
    assert resp1.status_code == 401

    # Invalid UUID format in sub
    token_bad_uuid = jwt.encode(
        {"sub": "not-a-uuid-string", "exp": 9999999999, "iat": 1},
        secret,
        algorithm="HS256",
    )
    resp2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_bad_uuid}"})
    assert resp2.status_code == 401


def test_current_user_me_nonexistent_user(client):
    """GET /api/auth/me with valid token for nonexistent user returns 401."""
    random_uuid = uuid.uuid4()
    token = create_access_token(random_uuid)
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


def test_jwt_secret_missing_raises_explicit_runtime_error(monkeypatch):
    """Calling JWT operations without configured JWT_SECRET_KEY raises clear RuntimeError."""
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", None)
    with pytest.raises(RuntimeError) as exc_info:
        create_access_token(uuid.uuid4())
    assert "JWT authentication is not configured" in str(exc_info.value)


def test_unconfigured_jwt_secret_causes_server_error_not_401(monkeypatch):
    """When JWT_SECRET_KEY is missing, auth endpoints return HTTP 500 without leaking internals."""
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", None)

    # Use client with raise_server_exceptions=False to inspect HTTP 500 response payload
    no_raise_client = TestClient(app, raise_server_exceptions=False)
    resp = no_raise_client.get("/api/auth/me", headers={"Authorization": "Bearer some.jwt.token"})
    assert resp.status_code == 500
    assert resp.status_code != 401

    # Security verification: ensure error response is strictly generic and leaks no internals
    body = resp.json()
    assert body["status"] == "error"
    assert body["error_type"] == "internal_server_error"
    assert body["detail"] == "An unexpected internal server error occurred."
    assert "JWT" not in resp.text
    assert "RuntimeError" not in resp.text
    assert "configured" not in resp.text.lower()
    assert "secret" not in resp.text.lower()

    # Anonymous endpoints continue functioning normally without JWT secret
    health_resp = no_raise_client.get("/api/health")
    assert health_resp.status_code == 200


def test_token_expiration_derived_dynamically_from_settings(client, monkeypatch):
    """Verify TokenResponse.expires_in and JWT exp claim dynamically match configured expiration."""
    test_minutes = 45
    monkeypatch.setattr(settings, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", test_minutes)

    email = f"dynamic_exp_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "DynamicPassword123"

    client.post("/api/auth/register", json={"email": email, "password": pwd})
    login_resp = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login_resp.status_code == 200
    data = login_resp.json()

    # Response expires_in must equal test_minutes * 60
    assert data["expires_in"] == test_minutes * 60

    # Token exp claim must equal iat + test_minutes * 60
    payload = decode_access_token(data["access_token"])
    assert payload["exp"] - payload["iat"] == test_minutes * 60


def test_query_persists_authenticated_user_id(client, test_engine):
    """Authenticated /api/query stores the analysis against the current user."""
    email = f"query-persist-{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPassword123!"
    display_name = "Query Persistence User"

    register = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )
    assert register.status_code in (200, 201)

    user_id = register.json()["id"]

    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200

    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/query",
        json={"query": "Locate all airplanes on the runway"},
        headers=headers,
    )
    assert response.status_code == 200

    TestingSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    db = TestingSessionLocal()
    try:
        analysis = db.scalar(
            select(Analysis)
            .where(Analysis.user_id == uuid.UUID(user_id))
            .order_by(Analysis.created_at.desc())
        )
        assert analysis is not None
        assert analysis.user_id == uuid.UUID(user_id)
        assert analysis.query == "Locate all airplanes on the runway"
    finally:
        db.close()




def test_analysis_history_returns_authenticated_users_analyses(client, test_engine):
    """Authenticated users can retrieve their own persisted analysis history."""
    email = "history_user@example.com"
    password = "HistoryPass123!"

    register = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": "History User",
        },
    )
    assert register.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200

    token = login.json()["access_token"]

    query_response = client.post(
        "/api/query",
        json={"query": "Locate all airplanes on the runway"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert query_response.status_code == 200

    history = client.get(
        "/api/analyses",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert history.status_code == 200

    data = history.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1
    assert data["items"][0]["query"] == "Locate all airplanes on the runway"


def test_analysis_history_isolated_between_users(client):
    """Users can only retrieve their own analysis history."""
    user_a = {
        "email": "isolation_a@example.com",
        "password": "IsolationPass123!",
        "display_name": "Isolation A",
    }
    user_b = {
        "email": "isolation_b@example.com",
        "password": "IsolationPass123!",
        "display_name": "Isolation B",
    }

    for user in (user_a, user_b):
        register = client.post("/api/auth/register", json=user)
        assert register.status_code == 201

    login_a = client.post(
        "/api/auth/login",
        json={"email": user_a["email"], "password": user_a["password"]},
    )
    login_b = client.post(
        "/api/auth/login",
        json={"email": user_b["email"], "password": user_b["password"]},
    )

    assert login_a.status_code == 200
    assert login_b.status_code == 200

    token_a = login_a.json()["access_token"]
    token_b = login_b.json()["access_token"]

    query = client.post(
        "/api/query",
        json={"query": "User A satellite analysis"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert query.status_code == 200

    history_a = client.get(
        "/api/analyses",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    history_b = client.get(
        "/api/analyses",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert history_a.status_code == 200
    assert history_b.status_code == 200

    data_a = history_a.json()
    data_b = history_b.json()

    assert any(
        item["query"] == "User A satellite analysis"
        for item in data_a["items"]
    )

    assert not any(
        item["query"] == "User A satellite analysis"
        for item in data_b["items"]
    )
