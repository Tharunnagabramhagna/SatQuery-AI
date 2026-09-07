"""OAuth endpoints for Google and Facebook authentication in SatQuery AI.

Provides:
- GET /api/auth/google: initiates Google OAuth 2.0 / OIDC flow.
- GET /api/auth/google/callback: handles Google callback, validates identity, creates exchange code.
- GET /api/auth/facebook: initiates Facebook OAuth flow.
- GET /api/auth/facebook/callback: handles Facebook callback, validates identity, creates exchange code.
- POST /api/auth/oauth/exchange: exchanges single-use code for standard SatQuery JWT.

Critical Security Constraints:
- NEVER exposes JWT in redirect URLs, query params, or browser history.
- Redirects contain ONLY a short-lived (120s), single-use, hashed exchange code.
- Single-use CSRF state tokens protect against cross-site request forgery.
- Strict account linking requires verified provider emails matching verified local accounts.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.session import get_db
from backend.schemas.auth import OAuthExchangeRequest, TokenResponse, UserResponse
from backend.security import create_access_token
from backend.security.oauth import (
    create_oauth_exchange_code,
    exchange_oauth_code_for_user,
    find_or_create_oauth_user,
    get_facebook_auth_url,
    get_google_auth_url,
    verify_facebook_callback,
    verify_google_callback,
)

logger = logging.getLogger("satquery.auth.oauth")

router = APIRouter(prefix="/api/auth", tags=["OAuth"])


def _build_frontend_redirect(path: str, params: Optional[dict] = None) -> str:
    """Helper to construct frontend redirect URL with query parameters."""
    base = settings.FRONTEND_URL.rstrip("/")
    target = f"{base}/{path.lstrip('/')}"
    if params:
        import urllib.parse
        query_string = urllib.parse.urlencode(params)
        separator = "&" if "?" in target else "?"
        return f"{target}{separator}{query_string}"
    return target


@router.get(
    "/google",
    summary="Initiate Google OAuth authentication",
    description="Generates a CSRF state token and redirects browser to Google OAuth consent screen.",
)
def google_login(db: Session = Depends(get_db)) -> RedirectResponse:
    """Redirect to Google OAuth consent screen."""
    auth_url = get_google_auth_url(db)
    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/google/callback",
    summary="Handle Google OAuth callback",
    description=(
        "Exchanges Google authorization code, validates identity, links or creates user, "
        "generates a short-lived single-use exchange code, and redirects to frontend with oauth_code."
    ),
)
async def google_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Handle Google callback and redirect to frontend with single-use exchange code."""
    if error or not code or not state:
        logger.warning("Google callback received error or missing params: error=%s", error)
        redirect_url = _build_frontend_redirect("login", {"error": "google_auth_cancelled"})
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    try:
        profile = await verify_google_callback(db, code, state)
        user = find_or_create_oauth_user(db, profile)
        exchange_code = create_oauth_exchange_code(db, user.id)

        # Redirect to frontend dashboard with exchange code ONLY (never JWT!)
        redirect_url = _build_frontend_redirect("dashboard", {"oauth_code": exchange_code})
        logger.info("Google OAuth callback successful for user id=%s", user.id)
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    except HTTPException as exc:
        logger.error("Google callback failed with HTTP %s: %s", exc.status_code, exc.detail)
        err_type = "email_not_verified" if exc.status_code == 409 else "google_auth_failed"
        redirect_url = _build_frontend_redirect("login", {"error": err_type})
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    except Exception as exc:
        logger.exception("Unexpected error in Google callback: %s", type(exc).__name__)
        redirect_url = _build_frontend_redirect("login", {"error": "google_auth_failed"})
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/facebook",
    summary="Initiate Facebook OAuth authentication",
    description="Generates a CSRF state token and redirects browser to Facebook OAuth dialog.",
)
def facebook_login(db: Session = Depends(get_db)) -> RedirectResponse:
    """Redirect to Facebook OAuth dialog."""
    auth_url = get_facebook_auth_url(db)
    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/facebook/callback",
    summary="Handle Facebook OAuth callback",
    description=(
        "Exchanges Facebook authorization code, validates identity via Graph API, "
        "links or creates user, generates a single-use exchange code, and redirects to frontend with oauth_code."
    ),
)
async def facebook_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Handle Facebook callback and redirect to frontend with single-use exchange code."""
    if error or not code or not state:
        logger.warning("Facebook callback received error or missing params: error=%s", error)
        redirect_url = _build_frontend_redirect("login", {"error": "facebook_auth_cancelled"})
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    try:
        profile = await verify_facebook_callback(db, code, state)
        user = find_or_create_oauth_user(db, profile)
        exchange_code = create_oauth_exchange_code(db, user.id)

        # Redirect to frontend dashboard with exchange code ONLY (never JWT!)
        redirect_url = _build_frontend_redirect("dashboard", {"oauth_code": exchange_code})
        logger.info("Facebook OAuth callback successful for user id=%s", user.id)
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    except HTTPException as exc:
        logger.error("Facebook callback failed with HTTP %s: %s", exc.status_code, exc.detail)
        err_type = "email_not_verified" if exc.status_code == 409 else "facebook_auth_failed"
        redirect_url = _build_frontend_redirect("login", {"error": err_type})
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    except Exception as exc:
        logger.exception("Unexpected error in Facebook callback: %s", type(exc).__name__)
        redirect_url = _build_frontend_redirect("login", {"error": "facebook_auth_failed"})
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


@router.post(
    "/oauth/exchange",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Exchange one-time OAuth code for SatQuery JWT",
    description=(
        "Exchanges a short-lived single-use OAuth exchange code for a standard SatQuery JWT access token. "
        "The exchange code is invalidated immediately upon successful consumption."
    ),
)
def exchange_oauth_code(
    payload: OAuthExchangeRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Exchange single-use OAuth code for SatQuery JWT access token."""
    user = exchange_oauth_code_for_user(db, payload.code)

    token = create_access_token(user.id)
    expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    logger.info("Successfully exchanged OAuth code for user id=%s (email=%s)", user.id, user.email)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )
