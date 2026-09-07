"""JWT authentication security module for SatQuery AI.

Provides stateless JSON Web Token (JWT) creation, decoding, and FastAPI
dependency injection for authenticated and optionally authenticated users.
"""

from __future__ import annotations

import datetime
import logging
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

bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_secret_key() -> str:
    """Return the configured JWT signing secret."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT authentication is not configured: JWT_SECRET_KEY is missing.")
    return settings.JWT_SECRET_KEY


CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


def create_access_token(
    subject: str,
    expires_delta: Optional[datetime.timedelta] = None,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.datetime.now(datetime.timezone.utc)

    if expires_delta is None:
        expires_delta = datetime.timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    expire = now + expires_delta

    payload = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        get_jwt_secret_key(),
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            get_jwt_secret_key(),
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.PyJWTError as exc:
        logger.info("JWT validation failed: %s", exc)
        raise CREDENTIALS_EXCEPTION from exc


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return the authenticated user when a valid token is supplied.

    Returns None for requests without an Authorization header, allowing
    guest/demo queries to continue working.
    """
    if not credentials or not credentials.credentials:
        return None

    if credentials.scheme.lower() != "bearer":
        raise CREDENTIALS_EXCEPTION

    payload = decode_access_token(credentials.credentials)

    sub_claim = payload.get("sub")
    if not sub_claim or not isinstance(sub_claim, str):
        raise CREDENTIALS_EXCEPTION

    try:
        user_uuid = uuid.UUID(sub_claim)
    except (ValueError, TypeError, AttributeError) as exc:
        logger.info("Optional authentication failed: invalid user UUID")
        raise CREDENTIALS_EXCEPTION from exc

    user = db.execute(
        select(User).where(User.id == user_uuid)
    ).scalar_one_or_none()

    if user is None:
        logger.info(
            "Optional authentication failed: user id=%s not found",
            user_uuid,
        )
        raise CREDENTIALS_EXCEPTION

    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    """Extract and authenticate the current user."""
    if not credentials or not credentials.credentials:
        logger.info(
            "Authentication failed: missing Authorization Bearer header"
        )
        raise CREDENTIALS_EXCEPTION

    if credentials.scheme.lower() != "bearer":
        logger.info(
            "Authentication failed: scheme is '%s', expected 'Bearer'",
            credentials.scheme,
        )
        raise CREDENTIALS_EXCEPTION

    payload = decode_access_token(credentials.credentials)

    sub_claim = payload.get("sub")
    if not sub_claim or not isinstance(sub_claim, str):
        logger.info(
            "Authentication failed: missing or non-string 'sub' claim"
        )
        raise CREDENTIALS_EXCEPTION

    try:
        user_uuid = uuid.UUID(sub_claim)
    except (ValueError, TypeError, AttributeError) as exc:
        logger.info(
            "Authentication failed: invalid UUID in 'sub' claim"
        )
        raise CREDENTIALS_EXCEPTION from exc

    user = db.execute(
        select(User).where(User.id == user_uuid)
    ).scalar_one_or_none()

    if user is None:
        logger.info(
            "Authentication failed: user id=%s not found in database",
            user_uuid,
        )
        raise CREDENTIALS_EXCEPTION

    return user

