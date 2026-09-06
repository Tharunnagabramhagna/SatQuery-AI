"""Authentication endpoints for SatQuery AI.

Phase 4B provides user registration with Argon2id password hashing and
safe conflict / transaction handling.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.session import get_db
from backend.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from backend.security import create_access_token, get_current_user, hash_password, verify_password

logger = logging.getLogger("satquery.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user account",
    description=(
        "Registers a new user account with secure Argon2id password hashing. "
        "Validates email syntax, enforces minimum 8-character password, and prevents duplicates."
    ),
)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user account.

    Flow:
        1. Validate normalized email and password constraints (Pydantic).
        2. Check for existing user with the same email (HTTP 409 if exists).
        3. Securely hash password with Argon2id.
        4. Insert user record and commit transaction.
        5. Return safe user representation without credentials.
    """
    # 1. Application-level check for duplicate email
    existing_user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # 2. Hash plaintext password with Argon2id
    password_hash = hash_password(payload.password)

    # 3. Create user entity
    new_user = User(
        email=payload.email,
        password_hash=password_hash,
        display_name=payload.display_name,
    )

    # 4. Transactional commit with safety rollback
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info("Successfully registered user id=%s (email=%s)", new_user.id, new_user.email)
        return UserResponse.model_validate(new_user)
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Database unique constraint conflict during registration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error during user registration: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating your account. Please try again later.",
        ) from exc


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and return JWT access token",
    description=(
        "Authenticates a user via email and password. Returns a signed JWT access token "
        "and safe user profile. Returns generic 401 on invalid credentials to prevent enumeration."
    ),
)
def login_user(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate user credentials and issue a stateless JWT access token.

    Flow:
        1. Validate and normalize email.
        2. Query user record in PostgreSQL by normalized email.
        3. Verify candidate password against stored Argon2id hash.
        4. If user not found OR password mismatch: return HTTP 401 Unauthorized.
        5. Generate signed JWT access token (HS256) with UUID subject and expiration.
        6. Return access token with safe user profile representation.
    """
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        logger.info("Login failed: invalid credentials for email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user.id)
    expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    logger.info("Successfully authenticated user id=%s (email=%s)", user.id, user.email)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
    description="Returns the profile of the user identified by the Authorization Bearer JWT token.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return profile representation for currently authenticated user."""
    return UserResponse.model_validate(current_user)
