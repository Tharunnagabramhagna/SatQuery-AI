"""Authentication schemas for user registration.

Phase 4B establishes secure registration input validation and safe user
response serialization.
"""

from __future__ import annotations

import datetime
import re
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
