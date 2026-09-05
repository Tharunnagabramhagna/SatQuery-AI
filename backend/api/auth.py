"""Authentication endpoints for SatQuery AI.

Phase 4B provides user registration with Argon2id password hashing and
safe conflict / transaction handling.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.db.models import User
from backend.db.session import get_db
from backend.schemas.auth import RegisterRequest, UserResponse
from backend.security import hash_password

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
