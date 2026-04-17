"""AuthService — JWT lifecycle, lockout, and user store.

Wraps PyJWT for HS256 token issuance and verification (with key
rotation), tracks failed login attempts for NIST 800-53 AC-7 lockout,
and owns the in-memory simulation user directory seeded from
``DEFAULT_USERS``.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import HTTPException

from app.models import utc_now as _utc_now

from .passwords import (
    DEFAULT_USERS,
    _hash_password,
    _verify_password,
)
from .roles import ROLES, ROLE_SCOPES, IdentityType

logger = logging.getLogger("aegisrange.auth")

# ---------------------------------------------------------------------------
# JWT algorithm — only HS256 allowed; reject all others at decode time.
# ---------------------------------------------------------------------------

_JWT_ALGORITHM = "HS256"
_JWT_ALLOWED_ALGORITHMS = ["HS256"]
_JWT_ISSUER = "aegisrange"
_JWT_AUDIENCE = "aegisrange"


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
        *,
        previous_secret_key: str | None = None,
        lockout_threshold: int | None = None,
        lockout_window_seconds: int | None = None,
        lockout_duration_seconds: int | None = None,
    ) -> None:
        from app.config import settings

        self._secret_key = secret_key or settings.jwt_secret_key
        self._previous_secret_key = (
            previous_secret_key or settings.jwt_previous_secret_key
        )
        self._token_expiry_hours = token_expiry_hours or settings.TOKEN_EXPIRY_HOURS
        self._lockout_threshold = (
            lockout_threshold
            if lockout_threshold is not None
            else settings.LOCKOUT_THRESHOLD
        )
        self._lockout_window_seconds = (
            lockout_window_seconds
            if lockout_window_seconds is not None
            else settings.LOCKOUT_WINDOW_SECONDS
        )
        self._lockout_duration_seconds = (
            lockout_duration_seconds
            if lockout_duration_seconds is not None
            else settings.LOCKOUT_DURATION_SECONDS
        )
        self._users: dict[str, AuthUser] = {}
        self._password_store: dict[
            str, tuple[str, str]
        ] = {}  # username -> (hash, salt)
        # Account lockout: track failed login attempt timestamps per username
        self._login_attempts: dict[str, list[float]] = defaultdict(list)
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

    # -- account lockout (NIST 800-53 AC-7) -----------------------------------

    def is_account_locked(self, username: str) -> bool:
        """Return True if the account has exceeded the failed-attempt threshold.

        Two-step check per NIST 800-53 AC-7:
        1. Count failures within the lockout *window* (e.g. 5 min).
        2. If >= threshold, check if the most recent failure is within
           the lockout *duration* (e.g. 15 min). If yes, account is locked.
        """
        attempts = self._login_attempts.get(username)
        if not attempts:
            return False
        now = time.monotonic()
        recent_in_window = [
            t for t in attempts if now - t < self._lockout_window_seconds
        ]
        if len(recent_in_window) < self._lockout_threshold:
            return False
        most_recent = max(attempts)
        return (now - most_recent) < self._lockout_duration_seconds

    def record_failed_attempt(self, username: str) -> None:
        """Record a failed login attempt for lockout tracking."""
        now = time.monotonic()
        max_age = self._lockout_window_seconds + self._lockout_duration_seconds
        self._login_attempts[username] = [
            t for t in self._login_attempts[username] if now - t < max_age
        ]
        self._login_attempts[username].append(now)

    def clear_failed_attempts(self, username: str) -> None:
        """Clear failed-attempt history after a successful login."""
        self._login_attempts.pop(username, None)

    def get_lockout_remaining(self, username: str) -> int:
        """Return seconds remaining in the lockout window, or 0 if not locked."""
        attempts = self._login_attempts.get(username)
        if not attempts:
            return 0
        now = time.monotonic()
        most_recent = max(attempts)
        remaining = self._lockout_duration_seconds - (now - most_recent)
        return max(0, int(remaining))

    # -- public API ----------------------------------------------------------

    def authenticate(
        self, username: str, password: str
    ) -> tuple[bool, str | None, datetime | None, str | None]:
        """Authenticate a user and return ``(success, token, expires_at, mfa_status)``."""
        from app.services import audit_service

        if self.is_account_locked(username):
            remaining = self.get_lockout_remaining(username)
            logger.warning(
                "Authentication blocked: account %s is locked (%ds remaining)",
                username,
                remaining,
            )
            audit_service.log_login_attempt(
                username,
                False,
                details={"locked_out": True, "remaining_seconds": remaining},
            )
            return False, None, None, None

        user = self._users.get(username)
        if user is None:
            _hash_password(password)
            logger.warning("Authentication failed: unknown user %s", username)
            return False, None, None, None

        stored_hash, stored_salt = self._password_store[username]
        if not _verify_password(password, stored_hash, stored_salt):
            self.record_failed_attempt(username)
            logger.warning("Authentication failed: bad password for %s", username)
            return False, None, None, None

        self.clear_failed_attempts(username)

        from app.config import settings
        from app.store import STORE

        if user.role in settings.MFA_REQUIRED_ROLES and username in STORE.totp_enabled:
            logger.info("User %s requires MFA verification", username)
            return True, None, None, "mfa_required"

        token = self.create_token(username, user.role)
        payload = self.verify_token(token)
        expires_at = payload.exp if payload else None
        logger.info("User %s authenticated successfully", username)
        return True, token, expires_at, None

    def create_token(
        self,
        username: str,
        role: str,
        *,
        identity_type: str = IdentityType.USER,
        audience: str = _JWT_AUDIENCE,
        scopes: list[str] | None = None,
    ) -> str:
        """Create a JWT token using PyJWT (HS256)."""
        from app.config import settings

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
        return jwt.encode(
            payload,
            self._secret_key,
            algorithm=_JWT_ALGORITHM,
            headers={"kid": settings.JWT_KEY_ID},
        )

    def create_service_token(
        self,
        service_id: str,
        scopes: list[str] | None = None,
    ) -> str:
        """Create a service-to-service authentication token."""
        from app.config import settings

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
        return jwt.encode(
            payload,
            self._secret_key,
            algorithm=_JWT_ALGORITHM,
            headers={"kid": settings.JWT_KEY_ID},
        )

    def _decode_token(self, token: str, secret: str) -> dict | None:
        """Attempt to decode a JWT with the given secret."""
        try:
            return jwt.decode(
                token,
                secret,
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

    def verify_token(self, token: str) -> TokenPayload | None:
        """Verify a JWT token and return the decoded payload, or ``None``."""
        raw = self._decode_token(token, self._secret_key)
        if raw is None and self._previous_secret_key:
            raw = self._decode_token(token, self._previous_secret_key)
            if raw is not None:
                logger.info(
                    "Token verified with previous key (kid rotation in progress)"
                )
        if raw is None:
            return None

        token_iss = raw.get("iss")
        if token_iss is not None and token_iss != _JWT_ISSUER:
            return None
        token_aud = raw.get("aud")
        if token_aud is not None and token_aud != _JWT_AUDIENCE:
            return None

        jti = raw.get("jti")
        if jti is None:
            return None

        from app.store import STORE

        if STORE.is_jti_revoked(jti):
            return None

        identity_type = raw.get("identity_type", IdentityType.USER)

        if identity_type == IdentityType.USER and raw.get("role") not in ROLES:
            return None

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
        """Extract the JTI from a token without full verification."""
        for secret in (self._secret_key, self._previous_secret_key):
            if not secret:
                continue
            try:
                raw = jwt.decode(
                    token,
                    secret,
                    algorithms=_JWT_ALLOWED_ALGORITHMS,
                    options={
                        "verify_exp": False,
                        "verify_iat": False,
                        "verify_aud": False,
                    },
                )
                return raw.get("jti")
            except jwt.InvalidTokenError:
                continue
        return None


# ---------------------------------------------------------------------------
# Module-level service instance (reads secret from config)
# ---------------------------------------------------------------------------

auth_service = AuthService()
# DEPRECATED: the underscore name shipped as the canonical public singleton
# through 0.8.x. Use ``auth_service`` instead. Scheduled for removal in 0.10.0.
_auth_service = auth_service


def get_current_user(token: str) -> TokenPayload:
    """FastAPI dependency: decode a bearer token string into a ``TokenPayload``.

    Raises ``HTTPException(401)`` when the token is missing or invalid.
    """
    payload = auth_service.verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload
