"""Optional authentication dependency for SatQuery AI.

Provides a FastAPI dependency that resolves the current user when a valid
Bearer token is present, returns None for anonymous requests, and raises
HTTP 401 when an Authorization header is explicitly supplied but invalid.

This is distinct from the strict `get_current_user()` dependency, which
always requires authentication.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.session import get_db
from backend.security.jwt import CREDENTIALS_EXCEPTION, decode_access_token

logger = logging.getLogger("satquery.security.optional_auth")

# Security bearer scheme without auto-error so we can distinguish
# "no header" from "invalid header"
_optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """FastAPI dependency for optional authentication.

    Behavior:
        - No Authorization header present → returns None (anonymous).
        - Valid Bearer token → decodes JWT, resolves User, returns User.
        - Authorization header present but invalid/expired/malformed →
          raises HTTPException(401). Does NOT silently fall back to anonymous.

    Args:
        request: The incoming FastAPI request (used to check raw headers).
        credentials: Extracted HTTP Bearer credentials (None if no header).
        db: Active SQLAlchemy database session.

    Returns:
        Optional[User]: Authenticated User or None for anonymous requests.

    Raises:
        HTTPException: HTTP 401 if an Authorization header is supplied but invalid.
    """
    # Check if an Authorization header was explicitly supplied
    auth_header = request.headers.get("authorization")

    if not auth_header:
        # No Authorization header at all → anonymous request
        return None

    # An Authorization header IS present — authentication is now mandatory.
    # If credentials extraction failed (e.g. non-Bearer scheme), reject.
    if not credentials or not credentials.credentials:
        logger.info("Optional auth: Authorization header present but no valid Bearer credentials extracted")
        raise CREDENTIALS_EXCEPTION

    if credentials.scheme.lower() != "bearer":
        logger.info("Optional auth: scheme is '%s', expected 'Bearer'", credentials.scheme)
        raise CREDENTIALS_EXCEPTION

    # Decode and validate the JWT token
    payload = decode_access_token(credentials.credentials)

    sub_claim = payload.get("sub")
    if not sub_claim or not isinstance(sub_claim, str):
        logger.info("Optional auth: missing or non-string 'sub' claim")
        raise CREDENTIALS_EXCEPTION

    try:
        user_uuid = uuid.UUID(sub_claim)
    except (ValueError, TypeError, AttributeError):
        logger.info("Optional auth: 'sub' claim is not a valid UUID: %s", sub_claim)
        raise CREDENTIALS_EXCEPTION

    user = db.execute(select(User).where(User.id == user_uuid)).scalar_one_or_none()
    if user is None:
        logger.info("Optional auth: user id=%s not found in database", user_uuid)
        raise CREDENTIALS_EXCEPTION

    return user
