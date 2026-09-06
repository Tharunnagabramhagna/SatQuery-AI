"""Authentication endpoints for SatQuery AI.

Phase 4B provides user registration with Argon2id password hashing and
safe conflict / transaction handling.
"""

import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import EmailVerification, User
from backend.db.session import get_db
from backend.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
    VerificationResponse,
    VerifyEmailRequest,
)
from backend.security import create_access_token, get_current_user, hash_password, verify_password
from backend.security.verification import (
    generate_verification_code,
    hash_verification_code,
    verify_verification_code,
)
from backend.services.email import send_verification_email

logger = logging.getLogger("satquery.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user account",
    description=(
        "Registers a new user account with secure Argon2id password hashing and unverified status. "
        "Generates a 6-digit verification code and dispatches it via email."
    ),
)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user account and dispatch email verification OTP."""
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

    # 3. Create user entity in unverified state
    new_user = User(
        email=payload.email,
        password_hash=password_hash,
        display_name=payload.display_name,
        email_verified=False,
        auth_provider="local",
    )

    # 4. Generate 6-digit OTP and store SHA-256 hash
    code = generate_verification_code()
    code_hash = hash_verification_code(code)
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = now + datetime.timedelta(minutes=settings.EMAIL_VERIFY_EXPIRE_MINUTES)

    try:
        db.add(new_user)
        db.flush()  # populate new_user.id

        verification = EmailVerification(
            user_id=new_user.id,
            code_hash=code_hash,
            expires_at=expires_at,
            attempts=0,
            status="pending",
        )
        db.add(verification)
        db.commit()
        db.refresh(new_user)
        logger.info("Successfully registered user id=%s (email=%s)", new_user.id, new_user.email)
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Database unique constraint conflict during registration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error during user registration: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating your account. Please try again later.",
        ) from exc

    # 5. Dispatch email via email service (safe delivery without logging code)
    send_verification_email(new_user.email, code, new_user.display_name)

    return UserResponse.model_validate(new_user)


@router.post(
    "/verify-email",
    response_model=VerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email address with 6-digit OTP",
    description="Submits the 6-digit verification code sent to the user's email to verify their account.",
)
def verify_email(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
) -> VerificationResponse:
    """Validate 6-digit verification OTP and mark account verified."""
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or verification code.",
        )

    if user.email_verified:
        return VerificationResponse(
            message="Account is already verified. Please sign in.",
            email=user.email,
            email_verified=True,
        )

    now = datetime.datetime.now(datetime.timezone.utc)

    # Find the latest pending verification record
    verification = db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user.id,
            EmailVerification.status == "pending",
        )
        .order_by(EmailVerification.created_at.desc())
    ).scalar_one_or_none()

    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code found. Please request a new code.",
        )

    # Check expiration
    if verification.expires_at < now:
        verification.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # Increment attempts
    verification.attempts += 1

    # Check max attempts limit
    if verification.attempts > settings.EMAIL_VERIFY_MAX_ATTEMPTS:
        verification.status = "max_attempts_exceeded"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please request a new verification code.",
        )

    # Constant-time comparison
    if not verify_verification_code(payload.code, verification.code_hash):
        if verification.attempts >= settings.EMAIL_VERIFY_MAX_ATTEMPTS:
            verification.status = "max_attempts_exceeded"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please request a new verification code.",
            )
        remaining = settings.EMAIL_VERIFY_MAX_ATTEMPTS - verification.attempts
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    # Success: mark verified
    verification.status = "verified"
    user.email_verified = True
    user.email_verified_at = now
    db.commit()

    logger.info("Successfully verified email for user id=%s (email=%s)", user.id, user.email)
    return VerificationResponse(
        message="Email verified successfully. You can now sign in.",
        email=user.email,
        email_verified=True,
    )


@router.post(
    "/resend-verification",
    response_model=VerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend email verification code",
    description="Generates and sends a new verification code if the account is unverified and cooldown elapsed.",
)
def resend_verification(
    payload: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> VerificationResponse:
    """Generate and dispatch a fresh verification code, enforcing cooldown and soft-invalidation."""
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    # Prevent account enumeration: return generic success if user does not exist
    if user is None:
        return VerificationResponse(
            message="If this email is registered and unverified, a verification code has been sent.",
            email=payload.email,
            email_verified=False,
        )

    if user.email_verified:
        return VerificationResponse(
            message="Account is already verified. Please sign in.",
            email=user.email,
            email_verified=True,
        )

    now = datetime.datetime.now(datetime.timezone.utc)

    # Check cooldown against the latest verification record
    latest = db.execute(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id)
        .order_by(EmailVerification.created_at.desc())
    ).scalar_one_or_none()

    if latest is not None:
        elapsed = (now - latest.created_at).total_seconds()
        if elapsed < settings.EMAIL_RESEND_COOLDOWN_SECONDS:
            retry_after = int(settings.EMAIL_RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {retry_after} seconds before requesting another verification code.",
                headers={"Retry-After": str(retry_after)},
            )

    # Invalidate previous pending codes
    db.execute(
        update(EmailVerification)
        .where(
            EmailVerification.user_id == user.id,
            EmailVerification.status == "pending",
        )
        .values(status="expired")
    )

    # Generate new code
    code = generate_verification_code()
    code_hash = hash_verification_code(code)
    expires_at = now + datetime.timedelta(minutes=settings.EMAIL_VERIFY_EXPIRE_MINUTES)

    new_verification = EmailVerification(
        user_id=user.id,
        code_hash=code_hash,
        expires_at=expires_at,
        attempts=0,
        status="pending",
    )
    db.add(new_verification)
    db.commit()

    # Dispatch email
    send_verification_email(user.email, code, user.display_name)
    logger.info("Resent verification code to email=%s", user.email)

    return VerificationResponse(
        message="A new verification code has been sent to your email address.",
        email=user.email,
        email_verified=False,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and return JWT access token",
    description=(
        "Authenticates a user via email and password. Returns a signed JWT access token "
        "and safe user profile. Verified users log in without an OTP code. "
        "Unverified users receive HTTP 403 Forbidden."
    ),
)
def login_user(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate user credentials and issue a stateless JWT access token."""
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if user is None:
        logger.info("Login failed: unknown email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Guard: Social login accounts have no password_hash
    if user.password_hash is None:
        logger.info("Login failed: password login attempted on social account email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account was created with social login. Please sign in with Google or Facebook.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify Argon2id password
    if not verify_password(payload.password, user.password_hash):
        logger.info("Login failed: password mismatch for email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Guard: Unverified accounts cannot sign in
    if not user.email_verified:
        logger.info("Login blocked: unverified email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="EMAIL_NOT_VERIFIED: Please verify your email address before signing in.",
        )

    # Issue JWT token (no verification code required during normal login)
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
