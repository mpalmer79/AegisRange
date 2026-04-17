"""Password hashing (PBKDF2-HMAC-SHA256) and default user bootstrap.

Defines the PBKDF2 tunables, ``_hash_password`` / ``_verify_password``
helpers, and the in-memory ``DEFAULT_PASSWORDS`` / ``DEFAULT_USERS``
fixtures that the :class:`AuthService` seeds at startup.
"""

from __future__ import annotations

import hashlib
import hmac
import os

_PBKDF2_ITERATIONS = 260_000
_PBKDF2_HASH_NAME = "sha256"
_PBKDF2_DK_LEN = 32


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    """Hash a password with PBKDF2-HMAC-SHA256.

    Returns (hex_hash, hex_salt).
    """
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(
        _PBKDF2_HASH_NAME,
        password.encode(),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=_PBKDF2_DK_LEN,
    )
    return dk.hex(), salt.hex()


def _verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    """Verify a password against a stored PBKDF2 hash and salt."""
    salt = bytes.fromhex(stored_salt)
    dk = hashlib.pbkdf2_hmac(
        _PBKDF2_HASH_NAME,
        password.encode(),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=_PBKDF2_DK_LEN,
    )
    return hmac.compare_digest(dk.hex(), stored_hash)


# ---------------------------------------------------------------------------
# Default simulation users (in-memory only)
#
# Passwords meet complexity requirements (uppercase, lowercase, digit,
# special character, ≥12 characters). Hashes are computed at module
# load time so the plain-text passwords are never stored.
# ---------------------------------------------------------------------------

DEFAULT_PASSWORDS: dict[str, str] = {
    "admin": "Admin_Pass_2025!",
    "soc_lead": "SocLead_Pass_2025!",
    "analyst1": "Analyst1_Pass_2025!",
    "red_team1": "RedTeam1_Pass_2025!",
    "viewer1": "Viewer1_Pass_2025!",
}


def _build_default_users() -> dict[str, dict[str, str]]:
    """Build default user entries with PBKDF2-hashed passwords."""
    users_spec = [
        ("admin", "admin", "Platform Admin"),
        ("soc_lead", "soc_manager", "SOC Manager"),
        ("analyst1", "analyst", "Security Analyst"),
        ("red_team1", "red_team", "Red Team Operator"),
        ("viewer1", "viewer", "Dashboard Viewer"),
    ]
    result: dict[str, dict[str, str]] = {}
    for username, role, display_name in users_spec:
        pw_hash, pw_salt = _hash_password(DEFAULT_PASSWORDS[username])
        result[username] = {
            "password_hash": pw_hash,
            "password_salt": pw_salt,
            "role": role,
            "display_name": display_name,
        }
    return result


DEFAULT_USERS: dict[str, dict[str, str]] = _build_default_users()
