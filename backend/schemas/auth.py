"""Authentication schemas for user registration.

Phase 4B establishes secure registration input validation and safe user
response serialization.
"""

from __future__ import annotations

import datetime
import re
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Standard RFC-compliant email pattern for robust validation without extra dependencies
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class RegisterRequest(BaseModel):
    """User registration payload."""

    email: str = Field(
        ...,
        description="User email address for authentication",
        examples=["user@example.com"],
    )
    password: str = Field(
        ...,
        min_length=8,
        description="Plaintext password, minimum 8 characters",
        examples=["securepassword123"],
    )
    display_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional display name for the user",
        examples=["Earth Observation Analyst"],
    )

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, v: str) -> str:
        """Trim whitespace, lowercase, and validate email syntax."""
        if not isinstance(v, str):
            raise ValueError("Email must be a string")
        normalized = v.strip().lower()
        if not normalized:
            raise ValueError("Email cannot be empty")
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_not_empty(cls, v: str) -> str:
        """Ensure password is not only whitespace and meets minimum length."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @field_validator("display_name")
    @classmethod
    def sanitize_display_name(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace from display name and convert blank string to None."""
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None


class UserResponse(BaseModel):
    """Safe user profile response.

    Excludes password_hash and any sensitive credentials.
    """

    id: uuid.UUID = Field(..., description="Unique user identifier")
    email: str = Field(..., description="Normalized user email")
    display_name: Optional[str] = Field(default=None, description="User display name")
    email_verified: bool = Field(default=False, description="Whether email address has been verified")
    auth_provider: str = Field(default="local", description="Authentication provider (local, google, facebook)")
    avatar_url: Optional[str] = Field(default=None, description="User avatar image URL")
    created_at: datetime.datetime = Field(..., description="Account creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    """User authentication login payload."""

    email: str = Field(
        ...,
        description="User email address for authentication",
        examples=["user@example.com"],
    )
    password: str = Field(
        ...,
        min_length=1,
        description="Candidate plaintext password",
        examples=["securepassword123"],
    )

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, v: str) -> str:
        """Trim whitespace, lowercase, and validate email syntax."""
        if not isinstance(v, str):
            raise ValueError("Email must be a string")
        normalized = v.strip().lower()
        if not normalized:
            raise ValueError("Email cannot be empty")
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Invalid email format")
        return normalized


class TokenResponse(BaseModel):
    """JWT bearer access token response."""

    access_token: str = Field(..., description="Stateless JWT access token")
    token_type: str = Field(default="bearer", description="Authentication token type")
    expires_in: int = Field(..., description="Token validity duration in seconds")
    user: UserResponse = Field(..., description="Safe authenticated user representation")


class VerifyEmailRequest(BaseModel):
    """Email verification payload."""

    email: str = Field(
        ...,
        description="Registered email address to verify",
        examples=["user@example.com"],
    )
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="6-digit numeric verification OTP",
        examples=["123456"],
    )

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, v: str) -> str:
        """Trim whitespace, lowercase, and validate email syntax."""
        if not isinstance(v, str):
            raise ValueError("Email must be a string")
        normalized = v.strip().lower()
        if not normalized:
            raise ValueError("Email cannot be empty")
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("code")
    @classmethod
    def validate_numeric_code(cls, v: str) -> str:
        """Validate that code consists of exactly 6 digits."""
        stripped = v.strip()
        if len(stripped) != 6 or not stripped.isdigit():
            raise ValueError("Verification code must be exactly 6 digits")
        return stripped


class ResendVerificationRequest(BaseModel):
    """Resend verification code payload."""

    email: str = Field(
        ...,
        description="Registered email address to resend verification to",
        examples=["user@example.com"],
    )

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, v: str) -> str:
        """Trim whitespace, lowercase, and validate email syntax."""
        if not isinstance(v, str):
            raise ValueError("Email must be a string")
        normalized = v.strip().lower()
        if not normalized:
            raise ValueError("Email cannot be empty")
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Invalid email format")
        return normalized


class VerificationResponse(BaseModel):
    """Outcome of email verification operation."""

    message: str = Field(..., description="Status message")
    email: str = Field(..., description="Target email address")
    email_verified: bool = Field(..., description="Whether email is currently verified")


class OAuthExchangeRequest(BaseModel):
    """Single-use OAuth exchange code exchange payload."""

    code: Optional[str] = Field(
        default=None,
        description="Single-use OAuth exchange code received in callback redirect",
    )
    oauth_code: Optional[str] = Field(
        default=None,
        description="Alternative field name for exchange code",
    )

    @model_validator(mode="after")
    def resolve_exchange_code(self) -> "OAuthExchangeRequest":
        resolved = self.code or self.oauth_code
        if not resolved or len(resolved.strip()) < 10:
            raise ValueError("A valid exchange code is required (minimum 10 characters)")
        self.code = resolved.strip()
        return self
