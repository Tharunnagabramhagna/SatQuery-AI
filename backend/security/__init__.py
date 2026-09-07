"""Security module for SatQuery AI.

Provides password hashing, verification, JWT authentication, and optional
authentication utilities.
"""

from backend.security.jwt import create_access_token, decode_access_token, get_current_user
from backend.security.optional_auth import get_optional_current_user
from backend.security.password import hash_password, verify_password
from backend.security.verification import (
    generate_oauth_exchange_code,
    generate_oauth_state,
    generate_verification_code,
    hash_oauth_token,
    hash_verification_code,
    verify_oauth_token,
    verify_verification_code,
)

__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_optional_current_user",
    "generate_verification_code",
    "hash_verification_code",
    "verify_verification_code",
    "generate_oauth_state",
    "hash_oauth_token",
    "verify_oauth_token",
    "generate_oauth_exchange_code",
]
