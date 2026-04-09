from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, Request

from app.models import utc_now as _utc_now

logger = logging.getLogger("aegisrange.auth")


# ---------------------------------------------------------------------------
# Role definitions
# ---------------------------------------------------------------------------

ROLES: dict[str, dict[str, object]] = {
    "admin": {"level": 100, "description": "Full platform access"},
    "soc_manager": {"level": 75, "description": "SOC operations and incident management"},
    "analyst": {"level": 50, "description": "Detection analysis and investigation"},
    "red_team": {"level": 50, "description": "Scenario execution and adversary emulation"},
    "viewer": {"level": 25, "description": "Read-only access to dashboards"},
}

# ---------------------------------------------------------------------------
# Password hashing (PBKDF2-HMAC-SHA256)
# ---------------------------------------------------------------------------

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
# Passwords follow the pattern {username}_pass.  Hashes are computed at
# module load time so the plain-text passwords are never stored.
# ---------------------------------------------------------------------------

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
        pw_hash, pw_salt = _hash_password(f"{username}_pass")
        result[username] = {
            "password_hash": pw_hash,
            "password_salt": pw_salt,
            "role": role,
            "display_name": display_name,
        }
    return result


DEFAULT_USERS: dict[str, dict[str, str]] = _build_default_users()

# ---------------------------------------------------------------------------
# Endpoint access matrix
# ---------------------------------------------------------------------------

ENDPOINT_ROLES: dict[str, str] = {
    "scenarios": "red_team",       # red_team, soc_manager, admin
    "incidents_write": "analyst",  # analyst, soc_manager, admin
    "incidents_read": "viewer",    # all roles
    "analytics": "analyst",        # analyst, soc_manager, admin
    "admin": "admin",              # admin only
    "events": "viewer",            # all roles
    "alerts": "viewer",            # all roles
}

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class AuthUser:
    user_id: str
    username: str
    role: str
    display_name: str
    created_at: datetime = field(default_factory=_utc_now)


@dataclass
class TokenPayload:
    sub: str
    role: str
    exp: datetime
    iat: datetime
    jti: str


# ---------------------------------------------------------------------------
# AuthService
# ---------------------------------------------------------------------------


class AuthService:
    """JWT authentication and user management for the AegisRange simulation platform."""

    def __init__(self, secret_key: str | None = None, token_expiry_hours: int | None = None) -> None:
        from app.config import settings
        self._secret_key = secret_key or settings.jwt_secret_key
        self._token_expiry_hours = token_expiry_hours or settings.TOKEN_EXPIRY_HOURS
        self._users: dict[str, AuthUser] = {}
        self._password_store: dict[str, tuple[str, str]] = {}  # username -> (hash, salt)
        self._init_default_users()

    # -- bootstrap -----------------------------------------------------------

    def _init_default_users(self) -> None:
        for username, info in DEFAULT_USERS.items():
            user = AuthUser(
                user_id=f"user-{username}",
                username=username,
                role=info["role"],
                display_name=info["display_name"],
            )
            self._users[username] = user
            self._password_store[username] = (info["password_hash"], info["password_salt"])

    # -- public API ----------------------------------------------------------

    def authenticate(self, username: str, password: str) -> tuple[bool, str | None, datetime | None]:
        """Authenticate a user and return ``(success, token | None, expires_at | None)``.

        The returned ``expires_at`` is read back from the newly-created
        token so there is a single source of truth for expiration.

        Passwords are verified using PBKDF2-HMAC-SHA256.  For the
        simulation platform the accepted password is ``{username}_pass``
        (e.g. ``"admin_pass"`` for the admin user).
        """
        user = self._users.get(username)
        if user is None:
            # Perform a dummy hash to avoid timing side-channels
            _hash_password(password)
            logger.warning("Authentication failed: unknown user %s", username)
            return False, None, None

        stored_hash, stored_salt = self._password_store[username]
        if not _verify_password(password, stored_hash, stored_salt):
            logger.warning("Authentication failed: bad password for %s", username)
            return False, None, None

        token = self.create_token(username, user.role)
        payload = self.verify_token(token)
        expires_at = payload.exp if payload else None
        logger.info("User %s authenticated successfully", username)
        return True, token, expires_at

    def create_token(self, username: str, role: str) -> str:
        """Create a JWT-style token using stdlib only.

        Format: ``base64(header).base64(payload).base64(signature)``
        where the signature is HMAC-SHA256 of ``header_b64.payload_b64``.
        """
        now = _utc_now()
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": username,
            "role": role,
            "exp": (now + timedelta(hours=self._token_expiry_hours)).isoformat(),
            "iat": now.isoformat(),
            "jti": str(uuid4()),
        }

        header_b64 = self._b64_encode(json.dumps(header, separators=(",", ":")))
        payload_b64 = self._b64_encode(json.dumps(payload, separators=(",", ":")))
        signature = self._sign(f"{header_b64}.{payload_b64}")
        signature_b64 = self._b64_encode(signature)

        return f"{header_b64}.{payload_b64}.{signature_b64}"

    def verify_token(self, token: str) -> TokenPayload | None:
        """Verify a JWT token and return the decoded payload, or ``None``."""
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        expected_sig = self._sign(f"{header_b64}.{payload_b64}")
        try:
            actual_sig = self._b64_decode(signature_b64)
        except Exception:
            return None

        if not hmac.compare_digest(expected_sig.encode(), actual_sig.encode()):
            return None

        # Decode payload
        try:
            raw = json.loads(self._b64_decode(payload_b64))
        except Exception:
            return None

        # Check expiration (handle both tz-aware and tz-naive ISO strings)
        try:
            exp = datetime.fromisoformat(raw["exp"])
        except (KeyError, ValueError):
            return None

        now = _utc_now()
        # Normalise: if the stored exp is naive, treat it as UTC
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if now > exp:
            return None

        iat = datetime.fromisoformat(raw["iat"])
        if iat.tzinfo is None:
            iat = iat.replace(tzinfo=timezone.utc)

        try:
            return TokenPayload(
                sub=raw["sub"],
                role=raw["role"],
                exp=exp,
                iat=iat,
                jti=raw["jti"],
            )
        except (KeyError, ValueError):
            return None

    def get_user(self, username: str) -> AuthUser | None:
        """Look up a user by username."""
        return self._users.get(username)

    def list_users(self) -> list[AuthUser]:
        """Return all platform users."""
        return list(self._users.values())

    # -- internal helpers ----------------------------------------------------

    @staticmethod
    def _b64_encode(data: str) -> str:
        """URL-safe base64 encode without padding."""
        return base64.urlsafe_b64encode(data.encode()).rstrip(b"=").decode()

    @staticmethod
    def _b64_decode(data: str) -> str:
        """URL-safe base64 decode, re-adding padding as needed."""
        padded = data + "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode(padded.encode()).decode()

    def _sign(self, message: str) -> str:
        """HMAC-SHA256 hex digest of *message* using the configured secret."""
        return hmac.new(
            self._secret_key.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()


# ---------------------------------------------------------------------------
# Module-level service instance (reads secret from config)
# ---------------------------------------------------------------------------

_auth_service = AuthService()  # secret_key sourced from settings.jwt_secret_key

# ---------------------------------------------------------------------------
# FastAPI dependency helpers
# ---------------------------------------------------------------------------


def _extract_bearer_token(request: Request) -> str | None:
    """Extract the bearer token from an httpOnly cookie or Authorization header.

    Priority: httpOnly cookie > Authorization header.  The cookie path
    is the primary channel for browser clients (token never touches JS).
    The header fallback supports API clients and the test suite.
    """
    from app.config import settings

    # 1. httpOnly cookie (primary — browser clients)
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    # 2. Authorization header (fallback — API clients / tests)
    auth_header: str | None = request.headers.get("authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def get_current_user(token: str) -> TokenPayload:
    """FastAPI dependency: decode a bearer token string into a ``TokenPayload``.

    Raises ``HTTPException(401)`` when the token is missing or invalid.
    """
    payload = _auth_service.verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def require_role(minimum_role: str):
    """Return a FastAPI dependency that enforces a minimum role level.

    Usage::

        @app.get("/admin/stuff", dependencies=[Depends(require_role("admin"))])
        def admin_stuff(): ...

    The dependency extracts the bearer token from the ``Authorization``
    header, verifies it, and checks that the caller's role level meets or
    exceeds the level of *minimum_role*.

    Raises:
        HTTPException 401 - missing or invalid token
        HTTPException 403 - authenticated but insufficient role level
    """
    minimum_level: int = ROLES.get(minimum_role, {}).get("level", 0)  # type: ignore[union-attr]

    def _dependency(request: Request) -> TokenPayload:
        token = _extract_bearer_token(request)
        if token is None:
            raise HTTPException(status_code=401, detail="Missing authentication token")

        payload = _auth_service.verify_token(token)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_level: int = ROLES.get(payload.role, {}).get("level", 0)  # type: ignore[union-attr]
        if user_level < minimum_level:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{payload.role}' (level {user_level}) does not meet "
                       f"minimum required role '{minimum_role}' (level {minimum_level})",
            )

        # Stash the verified identity on request.state so handlers
        # can attribute actions to the authenticated platform user.
        request.state.platform_user = payload

        return payload

    return _dependency
