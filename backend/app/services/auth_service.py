from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import uuid4

import jwt
from fastapi import HTTPException, Request

from app.models import utc_now as _utc_now

logger = logging.getLogger("aegisrange.auth")

# ---------------------------------------------------------------------------
# JWT algorithm — only HS256 allowed; reject all others at decode time.
# ---------------------------------------------------------------------------

_JWT_ALGORITHM = "HS256"
_JWT_ALLOWED_ALGORITHMS = ["HS256"]
_JWT_ISSUER = "aegisrange"
_JWT_AUDIENCE = "aegisrange"

# ---------------------------------------------------------------------------
# Identity types — every token must declare what kind of identity it represents.
# ---------------------------------------------------------------------------


class IdentityType(str, Enum):
    USER = "user"
    SERVICE = "service"
    SYSTEM = "system"


# ---------------------------------------------------------------------------
# Auth channel — tracks how a request was authenticated.
# ---------------------------------------------------------------------------


class AuthChannel(str, Enum):
    COOKIE = "cookie"
    BEARER = "bearer"
    SERVICE = "service"


# ---------------------------------------------------------------------------
# Scopes — granular permission model layered on top of roles.
# ---------------------------------------------------------------------------

ROLE_SCOPES: dict[str, list[str]] = {
    "admin": ["read", "write", "admin", "scenarios", "analytics", "incidents"],
    "soc_manager": ["read", "write", "analytics", "incidents"],
    "analyst": ["read", "write", "analytics", "incidents"],
    "red_team": ["read", "scenarios"],
    "viewer": ["read"],
}

# ---------------------------------------------------------------------------
# Role definitions
# ---------------------------------------------------------------------------

ROLES: dict[str, dict[str, object]] = {
    "admin": {"level": 100, "description": "Full platform access"},
    "soc_manager": {
        "level": 75,
        "description": "SOC operations and incident management",
    },
    "analyst": {"level": 50, "description": "Detection analysis and investigation"},
    "red_team": {
        "level": 50,
        "description": "Scenario execution and adversary emulation",
    },
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
    "scenarios": "red_team",  # red_team, soc_manager, admin
    "incidents_write": "analyst",  # analyst, soc_manager, admin
    "incidents_read": "viewer",  # all roles
    "analytics": "analyst",  # analyst, soc_manager, admin
    "admin": "admin",  # admin only
    "events": "viewer",  # all roles
    "alerts": "viewer",  # all roles
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
    identity_type: str = IdentityType.USER
    created_at: datetime = field(default_factory=_utc_now)


@dataclass
class TokenPayload:
    sub: str
    role: str
    exp: datetime
    iat: datetime
    jti: str
    identity_type: str = IdentityType.USER
    audience: str = _JWT_AUDIENCE
    issuer: str = _JWT_ISSUER
    scopes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Correlation ID validation
# ---------------------------------------------------------------------------

_CORRELATION_ID_PATTERN = re.compile(
    r"^corr-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def validate_correlation_id(correlation_id: str) -> bool:
    """Check that a correlation ID matches the expected format.

    Accepts the ``corr-{uuid4}`` format generated by the middleware
    or any string up to 128 characters (for externally provided IDs).
    """
    if not correlation_id or len(correlation_id) > 128:
        return False
    if correlation_id.startswith("corr-"):
        return bool(_CORRELATION_ID_PATTERN.match(correlation_id))
    # Allow external correlation IDs that are alphanumeric with dashes/underscores
    return bool(re.match(r"^[a-zA-Z0-9_-]{1,128}$", correlation_id))


# ---------------------------------------------------------------------------
# AuthService — standards-based JWT via PyJWT
# ---------------------------------------------------------------------------


class AuthService:
    """JWT authentication and user management for the AegisRange simulation platform.

    Uses PyJWT for standards-compliant token creation and verification.
    All tokens are signed with HS256 (HMAC-SHA256). The ``decode`` call
    enforces:
      - signature verification
      - expiration (``exp``) validation
      - issued-at (``iat``) validation
      - required claims (``sub``, ``role``, ``jti``, ``exp``, ``iat``)
      - algorithm restriction (HS256 only)
      - audience and issuer validation
    """

    def __init__(
        self,
        secret_key: str | None = None,
        token_expiry_hours: int | None = None,
    ) -> None:
        from app.config import settings

        self._secret_key = secret_key or settings.jwt_secret_key
        self._token_expiry_hours = token_expiry_hours or settings.TOKEN_EXPIRY_HOURS
        self._users: dict[str, AuthUser] = {}
        self._password_store: dict[
            str, tuple[str, str]
        ] = {}  # username -> (hash, salt)
        self._init_default_users()

    # -- bootstrap -----------------------------------------------------------

    def _init_default_users(self) -> None:
        for username, info in DEFAULT_USERS.items():
            user = AuthUser(
                user_id=f"user-{username}",
                username=username,
                role=info["role"],
                display_name=info["display_name"],
                identity_type=IdentityType.USER,
            )
            self._users[username] = user
            self._password_store[username] = (
                info["password_hash"],
                info["password_salt"],
            )

    # -- public API ----------------------------------------------------------

    def authenticate(
        self, username: str, password: str
    ) -> tuple[bool, str | None, datetime | None]:
        """Authenticate a user and return ``(success, token | None, expires_at | None)``."""
        user = self._users.get(username)
        if user is None:
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

    def create_token(
        self,
        username: str,
        role: str,
        *,
        identity_type: str = IdentityType.USER,
        audience: str = _JWT_AUDIENCE,
        scopes: list[str] | None = None,
    ) -> str:
        """Create a JWT token using PyJWT (HS256).

        Standard claims: sub, role, exp, iat, jti, iss, aud.
        Extended claims: identity_type, scopes.
        """
        now = _utc_now()
        resolved_scopes = scopes if scopes is not None else ROLE_SCOPES.get(role, [])
        payload = {
            "sub": username,
            "role": role,
            "exp": now + timedelta(hours=self._token_expiry_hours),
            "iat": now,
            "jti": str(uuid4()),
            "iss": _JWT_ISSUER,
            "aud": audience,
            "identity_type": identity_type,
            "scopes": resolved_scopes,
        }
        return jwt.encode(payload, self._secret_key, algorithm=_JWT_ALGORITHM)

    def create_service_token(
        self,
        service_id: str,
        scopes: list[str] | None = None,
    ) -> str:
        """Create a service-to-service authentication token.

        Service tokens use ``identity_type=service`` and have a
        shorter expiry (1 hour) to limit blast radius.
        """
        now = _utc_now()
        payload = {
            "sub": service_id,
            "role": "service",
            "exp": now + timedelta(hours=1),
            "iat": now,
            "jti": str(uuid4()),
            "iss": _JWT_ISSUER,
            "aud": _JWT_AUDIENCE,
            "identity_type": IdentityType.SERVICE,
            "scopes": scopes or ["internal"],
        }
        return jwt.encode(payload, self._secret_key, algorithm=_JWT_ALGORITHM)

    def verify_token(self, token: str) -> TokenPayload | None:
        """Verify a JWT token and return the decoded payload, or ``None``.

        PyJWT enforces:
          - signature verification (HS256 only)
          - exp claim validation (rejects expired tokens)
          - iat claim validation (rejects future-issued tokens)
          - required claims: sub, role, jti, exp, iat

        Application-level validation:
          - issuer (reject mismatches; accept missing for legacy tokens)
          - audience (reject mismatches; accept missing for legacy tokens)
          - JTI revocation check
          - role membership check
        """
        try:
            raw = jwt.decode(
                token,
                self._secret_key,
                algorithms=_JWT_ALLOWED_ALGORITHMS,
                options={
                    "require": ["sub", "role", "exp", "iat", "jti"],
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_signature": True,
                    "verify_aud": False,
                },
            )
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

        # Validate issuer/audience at application level.
        # Accept tokens that omit these claims (legacy) but reject
        # tokens that carry a *wrong* value.
        token_iss = raw.get("iss")
        if token_iss is not None and token_iss != _JWT_ISSUER:
            return None
        token_aud = raw.get("aud")
        if token_aud is not None and token_aud != _JWT_AUDIENCE:
            return None

        jti = raw.get("jti")
        if jti is None:
            return None

        # Check JTI deny-list (revoked tokens from logout)
        from app.store import STORE

        if STORE.is_jti_revoked(jti):
            return None

        identity_type = raw.get("identity_type", IdentityType.USER)

        # Validate role for user tokens; service/system tokens use their own role
        if identity_type == IdentityType.USER and raw.get("role") not in ROLES:
            return None

        # Convert exp/iat to datetime objects
        exp = datetime.fromtimestamp(raw["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(raw["iat"], tz=timezone.utc)

        return TokenPayload(
            sub=raw["sub"],
            role=raw["role"],
            exp=exp,
            iat=iat,
            jti=jti,
            identity_type=identity_type,
            audience=raw.get("aud", _JWT_AUDIENCE),
            issuer=raw.get("iss", _JWT_ISSUER),
            scopes=raw.get("scopes", []),
        )

    def get_user(self, username: str) -> AuthUser | None:
        """Look up a user by username."""
        return self._users.get(username)

    def list_users(self) -> list[AuthUser]:
        """Return all platform users."""
        return list(self._users.values())

    def extract_jti(self, token: str) -> str | None:
        """Extract the JTI from a token without full verification.

        Used during logout to revoke the token.  The cookie was set
        by us, but we still guard against malformed input.
        """
        try:
            raw = jwt.decode(
                token,
                self._secret_key,
                algorithms=_JWT_ALLOWED_ALGORITHMS,
                options={
                    "verify_exp": False,
                    "verify_iat": False,
                    "verify_aud": False,
                },
            )
            return raw.get("jti")
        except jwt.InvalidTokenError:
            return None


# ---------------------------------------------------------------------------
# Module-level service instance (reads secret from config)
# ---------------------------------------------------------------------------

_auth_service = AuthService()  # secret_key sourced from settings.jwt_secret_key

# ---------------------------------------------------------------------------
# FastAPI dependency helpers
# ---------------------------------------------------------------------------


def _extract_bearer_token(request: Request) -> tuple[str | None, AuthChannel | None]:
    """Extract the bearer token and identify the auth channel.

    Priority: httpOnly cookie > Authorization header.
    Returns (token, channel) so downstream code knows how the
    request was authenticated.
    """
    from app.config import settings

    # 1. httpOnly cookie (primary — browser clients)
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token, AuthChannel.COOKIE

    # 2. Authorization header (fallback — API clients / tests)
    auth_header: str | None = request.headers.get("authorization")
    if not auth_header:
        return None, None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None, None
    return parts[1], AuthChannel.BEARER


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

    The dependency extracts the bearer token, verifies it, checks the
    caller's role level, and stashes identity + auth channel on
    ``request.state``.

    Raises:
        HTTPException 401 - missing or invalid token
        HTTPException 403 - authenticated but insufficient role level
    """
    minimum_level: int = ROLES.get(minimum_role, {}).get("level", 0)  # type: ignore[union-attr, assignment]

    def _dependency(request: Request) -> TokenPayload:
        token, channel = _extract_bearer_token(request)
        if token is None:
            raise HTTPException(status_code=401, detail="Missing authentication token")

        payload = _auth_service.verify_token(token)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # Service tokens bypass role-level checks but still require valid identity
        if payload.identity_type == IdentityType.SERVICE:
            request.state.platform_user = payload
            request.state.auth_channel = channel
            return payload

        user_level: int = ROLES.get(payload.role, {}).get("level", 0)  # type: ignore[union-attr, assignment]
        if user_level < minimum_level:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Role '{payload.role}' (level {user_level}) does not meet "
                    f"minimum required role '{minimum_role}' (level {minimum_level})"
                ),
            )

        # Stash the verified identity and auth channel on request.state
        request.state.platform_user = payload
        request.state.auth_channel = channel

        return payload

    return _dependency


def require_scope(required_scope: str):
    """Return a FastAPI dependency that enforces a specific scope.

    Usage::

        @app.post("/reports", dependencies=[Depends(require_scope("analytics"))])
        def gen_report(): ...

    Raises:
        HTTPException 401 - missing or invalid token
        HTTPException 403 - token lacks required scope
    """

    def _dependency(request: Request) -> TokenPayload:
        token, channel = _extract_bearer_token(request)
        if token is None:
            raise HTTPException(status_code=401, detail="Missing authentication token")

        payload = _auth_service.verify_token(token)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        if required_scope not in payload.scopes:
            raise HTTPException(
                status_code=403,
                detail=f"Token lacks required scope '{required_scope}'",
            )

        request.state.platform_user = payload
        request.state.auth_channel = channel
        return payload

    return _dependency


def require_identity_type(allowed_type: str):
    """Return a FastAPI dependency that enforces a specific identity type.

    Usage::

        @app.post("/internal/sync", dependencies=[Depends(require_identity_type("service"))])
        def internal_sync(): ...

    Raises:
        HTTPException 401 - missing or invalid token
        HTTPException 403 - wrong identity type
    """

    def _dependency(request: Request) -> TokenPayload:
        token, channel = _extract_bearer_token(request)
        if token is None:
            raise HTTPException(status_code=401, detail="Missing authentication token")

        payload = _auth_service.verify_token(token)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        if payload.identity_type != allowed_type:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Identity type '{payload.identity_type}' is not allowed; "
                    f"required: '{allowed_type}'"
                ),
            )

        request.state.platform_user = payload
        request.state.auth_channel = channel
        return payload

    return _dependency
