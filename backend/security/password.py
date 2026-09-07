"""Secure password hashing and verification using Argon2id.

Uses argon2-cffi's recommended PasswordHasher configuration.
Argon2id provides state-of-the-art resistance against GPU/ASIC cracking
and side-channel timing attacks.
"""

import logging
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

logger = logging.getLogger("satquery.security")

# Initialize default PasswordHasher with standard Argon2id parameters:
# 64 MiB memory cost, 3 time iterations, 4 parallelism lanes
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id.

    Args:
        password: Raw password string to hash.

    Returns:
        str: Encoded Argon2id hash string.
    """
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a candidate password against an Argon2id hash string.

    Never raises authentication exceptions on mismatch; returns False safely.

    Args:
        password: Raw password candidate.
        password_hash: Stored Argon2id hash.

    Returns:
        bool: True if password matches hash, False otherwise.
    """
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False
    except Exception as exc:
        logger.warning("Unexpected error during password verification: %s", type(exc).__name__)
        return False
