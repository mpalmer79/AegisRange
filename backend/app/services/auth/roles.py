"""Role / scope tables and FastAPI role enforcement dependencies.

- ``IdentityType`` / ``AuthChannel`` enums
- ``ROLES`` — role ladder with numeric levels
- ``ROLE_SCOPES`` — scopes granted to each role
- ``ENDPOINT_ROLES`` — human-readable access matrix
- ``_extract_bearer_token`` — cookie-or-header extractor
- ``require_role`` / ``require_scope`` / ``require_identity_type`` —
  FastAPI dependency factories
"""

from __future__ import annotations

from enum import Enum

from fastapi import HTTPException, Request


class IdentityType(str, Enum):
    USER = "user"
    SERVICE = "service"
    SYSTEM = "system"


class AuthChannel(str, Enum):
    COOKIE = "cookie"
    BEARER = "bearer"
    SERVICE = "service"


ROLE_SCOPES: dict[str, list[str]] = {
    "admin": ["read", "write", "admin", "scenarios", "analytics", "incidents"],
    "soc_manager": ["read", "write", "analytics", "incidents"],
    "analyst": ["read", "write", "analytics", "incidents"],
    "red_team": ["read", "scenarios"],
    "viewer": ["read"],
}


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


ENDPOINT_ROLES: dict[str, str] = {
    "scenarios": "red_team",  # red_team, soc_manager, admin
    "incidents_write": "analyst",  # analyst, soc_manager, admin
    "incidents_read": "viewer",  # all roles
    "analytics": "analyst",  # analyst, soc_manager, admin
    "admin": "admin",  # admin only
    "events": "viewer",  # all roles
    "alerts": "viewer",  # all roles
}


def _extract_bearer_token(request: Request) -> tuple[str | None, AuthChannel | None]:
    """Extract the bearer token and identify the auth channel.

    Priority: httpOnly cookie > Authorization header.
    Returns (token, channel) so downstream code knows how the
    request was authenticated.
    """
    from app.config import settings

    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token, AuthChannel.COOKIE

    auth_header: str | None = request.headers.get("authorization")
    if not auth_header:
        return None, None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None, None
    return parts[1], AuthChannel.BEARER


def require_role(minimum_role: str):
    """Return a FastAPI dependency that enforces a minimum role level."""
    from .service import _auth_service  # avoid circular import at module load

    minimum_level: int = ROLES.get(minimum_role, {}).get("level", 0)  # type: ignore[union-attr, assignment]

    def _dependency(request: Request):
        token, channel = _extract_bearer_token(request)
        if token is None:
            raise HTTPException(status_code=401, detail="Missing authentication token")

        payload = _auth_service.verify_token(token)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

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

        request.state.platform_user = payload
        request.state.auth_channel = channel
        return payload

    return _dependency


def require_scope(required_scope: str):
    """Return a FastAPI dependency that enforces a specific scope."""
    from .service import _auth_service

    def _dependency(request: Request):
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
    """Return a FastAPI dependency that enforces a specific identity type."""
    from .service import _auth_service

    def _dependency(request: Request):
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
