"""JWT authentication security module for SatQuery AI.

Provides stateless JSON Web Token (JWT) creation, decoding, and FastAPI
dependency injection for authenticated user resolution.
"""

from __future__ import annotations

import datetime
import logging
import os
import uuid
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.session import get_db

logger = logging.getLogger("satquery.security.jwt")

# Security bearer scheme without automatic 403/auto-error to enforce consistent 401 semantics
bearer_scheme = HTTPBearer(auto_error=False)

# Generic authentication failure exception
CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid, expired, or malformed authentication credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_jwt_secret_key() -> str:
    """Retrieve and validate the JWT secret key from application settings.

    Fails explicitly if no secret or an unconfigured placeholder is provided.
    Never prints or logs the secret key.

    Returns:
        str: Secret key string for HMAC signing.

    Raises:
        RuntimeError: If JWT_SECRET_KEY is not configured.
    """
    secret = settings.JWT_SECRET_KEY
    if not secret or secret.strip() in ("", "replace-with-a-random-secret"):
        raise RuntimeError("JWT authentication is not configured on this server.")
    return secret.strip()


def create_access_token(
    user_id: uuid.UUID | str,
    expires_delta: Optional[datetime.timedelta] = None,
) -> str:
    """Generate a signed JWT access token for a user.

    Claims:
        - sub: Subject identifier (user UUID string)
        - iat: Issued-at timestamp (UTC)
        - exp: Expiration timestamp (UTC)

    Args:
        user_id: The UUID of the user.
        expires_delta: Optional custom lifetime duration. Defaults to
            settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        str: Signed JWT string.
    """
    secret_key = get_jwt_secret_key()
    algorithm = settings.JWT_ALGORITHM or "HS256"

    now = datetime.datetime.now(datetime.timezone.utc)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    token = jwt.encode(payload, secret_key, algorithm=algorithm)
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a signed JWT access token.

    Validates signature, algorithm, and expiration.

    Args:
        token: Raw JWT string.

    Returns:
        Dict[str, Any]: Decoded payload claims dictionary.

    Raises:
        HTTPException: HTTP 401 if token is invalid or expired.
    """
    secret_key = get_jwt_secret_key()
    algorithm = settings.JWT_ALGORITHM or "HS256"

    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[algorithm],
            options={"require": ["sub", "exp", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.info("Authentication failed: token has expired")
        raise CREDENTIALS_EXCEPTION
    except jwt.InvalidTokenError as exc:
        logger.info("Authentication failed: invalid token (%s)", type(exc).__name__)
        raise CREDENTIALS_EXCEPTION


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency to extract and authenticate the current user.

    Enforces:
        1. Authorization header present with Bearer scheme.
        2. Valid JWT signature and unexpired timestamp.
        3. Valid UUID in 'sub' claim.
        4. User entity exists in PostgreSQL database.

    Args:
        credentials: Extracted HTTP Bearer credentials from request header.
        db: Active SQLAlchemy database session.

    Returns:
        User: Authenticated User database model instance.

    Raises:
        HTTPException: HTTP 401 with WWW-Authenticate header on any validation failure.
    """
    if not credentials or not credentials.credentials:
        logger.info("Authentication failed: missing Authorization Bearer header")
        raise CREDENTIALS_EXCEPTION

    if credentials.scheme.lower() != "bearer":
        logger.info("Authentication failed: scheme is '%s', expected 'Bearer'", credentials.scheme)
        raise CREDENTIALS_EXCEPTION

    payload = decode_access_token(credentials.credentials)

    sub_claim = payload.get("sub")
    if not sub_claim or not isinstance(sub_claim, str):
        logger.info("Authentication failed: missing or non-string 'sub' claim")
        raise CREDENTIALS_EXCEPTION

    try:
        user_uuid = uuid.UUID(sub_claim)
    except (ValueError, TypeError, AttributeError):
        logger.info("Authentication failed: 'sub' claim is not a valid UUID: %s", sub_claim)
        raise CREDENTIALS_EXCEPTION

    user = db.execute(select(User).where(User.id == user_uuid)).scalar_one_or_none()
    if user is None:
        logger.info("Authentication failed: user id=%s not found in database", user_uuid)
        raise CREDENTIALS_EXCEPTION

    return user
