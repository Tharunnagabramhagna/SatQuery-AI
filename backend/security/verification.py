"""Cryptographic verification code, state, and token helpers for SatQuery AI.

Provides utilities for:
1. 6-digit numeric OTP generation using secure random number generators.
2. SHA-256 hashing and timing-safe verification for OTP codes.
3. Cryptographically secure OAuth state generation and verification.
4. Single-use OAuth exchange code generation and verification.

All secrets and verification codes are strictly protected:
- Plaintext codes are never stored in databases.
- Plaintext codes are never logged.
- Comparisons use constant-time `hmac.compare_digest` to prevent timing attacks.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets


def generate_verification_code() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(6))


def hash_verification_code(code: str) -> str:
    """Compute SHA-256 hex digest of a verification OTP code."""
    normalized = code.strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def verify_verification_code(candidate_code: str, stored_code_hash: str) -> bool:
    """Perform constant-time comparison of a candidate OTP against a stored SHA-256 digest."""
    if not candidate_code or not stored_code_hash:
        return False
    candidate_hash = hash_verification_code(candidate_code)
    return hmac.compare_digest(candidate_hash, stored_code_hash)


def generate_oauth_state() -> str:
    """Generate a cryptographically secure URL-safe OAuth CSRF state token."""
    return secrets.token_urlsafe(32)


def hash_oauth_token(token: str) -> str:
    """Compute SHA-256 hex digest of an OAuth state token or one-time exchange code."""
    normalized = token.strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def verify_oauth_token(candidate_token: str, stored_hash: str) -> bool:
    """Perform constant-time comparison of an OAuth token against a stored SHA-256 digest."""
    if not candidate_token or not stored_hash:
        return False
    candidate_hash = hash_oauth_token(candidate_token)
    return hmac.compare_digest(candidate_hash, stored_hash)


def generate_oauth_exchange_code() -> str:
    """Generate a cryptographically secure single-use OAuth exchange code."""
    return secrets.token_urlsafe(32)
