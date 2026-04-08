from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, Request

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
# Default simulation users (in-memory only)
# ---------------------------------------------------------------------------

DEFAULT_USERS: dict[str, dict[str, str]] = {
    "admin": {"password_hash": "admin_hash", "role": "admin", "display_name": "Platform Admin"},
    "soc_lead": {"password_hash": "soc_hash", "role": "soc_manager", "display_name": "SOC Manager"},
    "analyst1": {"password_hash": "analyst_hash", "role": "analyst", "display_name": "Security Analyst"},
    "red_team1": {"password_hash": "redteam_hash", "role": "red_team", "display_name": "Red Team Operator"},
    "viewer1": {"password_hash": "viewer_hash", "role": "viewer", "display_name": "Dashboard Viewer"},
}

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
    created_at: datetime = field(default_factory=datetime.utcnow)


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

    DEFAULT_SECRET = "aegisrange-dev-secret-key-change-in-production"
    TOKEN_EXPIRY_HOURS = 24

    def __init__(self, secret_key: str = DEFAULT_SECRET) -> None:
        self._secret_key = secret_key
        self._users: dict[str, AuthUser] = {}
        self._password_map: dict[str, str] = {}
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
            self._password_map[username] = info["password_hash"]

    # -- public API ----------------------------------------------------------

    def authenticate(self, username: str, password: str) -> tuple[bool, str | None, datetime | None]:
        """Authenticate a user and return ``(success, token | None, expires_at | None)``.

        The returned ``expires_at`` is read back from the newly-created
        token so there is a single source of truth for expiration.

        For the simulation platform the accepted password is
        ``{username}_pass`` (e.g. ``"admin_pass"`` for the admin user).
        """
        user = self._users.get(username)
        if user is None:
            logger.warning("Authentication failed: unknown user %s", username)
            return False, None, None

        expected_password = f"{username}_pass"
        if password != expected_password:
            logger.warning("Authentication failed: bad password for %s", username)
            return False, None, None

        token = self.create_token(username, user.role)
        # Read expiry back from the token we just created so callers
        # never have to compute it independently.
        payload = self.verify_token(token)
        expires_at = payload.exp if payload else None
        logger.info("User %s authenticated successfully", username)
        return True, token, expires_at

    def create_token(self, username: str, role: str) -> str:
        """Create a JWT-style token using stdlib only.

        Format: ``base64(header).base64(payload).base64(signature)``
        where the signature is HMAC-SHA256 of ``header_b64.payload_b64``.
        """
        now = datetime.utcnow()
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": username,
            "role": role,
            "exp": (now + timedelta(hours=self.TOKEN_EXPIRY_HOURS)).isoformat(),
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

        # Check expiration
        try:
            exp = datetime.fromisoformat(raw["exp"])
        except (KeyError, ValueError):
            return None

        if datetime.utcnow() > exp:
            return None

        try:
            return TokenPayload(
                sub=raw["sub"],
                role=raw["role"],
                exp=exp,
                iat=datetime.fromisoformat(raw["iat"]),
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
# Module-level service instance
# ---------------------------------------------------------------------------

_auth_service = AuthService()

# ---------------------------------------------------------------------------
# FastAPI dependency helpers
# ---------------------------------------------------------------------------


def _extract_bearer_token(request: Request) -> str | None:
    """Pull the bearer token from the Authorization header."""
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
