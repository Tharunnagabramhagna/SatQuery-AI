"""Security module for SatQuery AI.

Provides password hashing, verification, JWT authentication, and optional
authentication utilities.
"""

from backend.security.jwt import create_access_token, decode_access_token, get_current_user
from backend.security.optional_auth import get_optional_current_user
from backend.security.password import hash_password, verify_password

__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_optional_current_user",
]
