"""Backwards-compatible re-export shim.

The contents of this module were split into the ``app.services.auth``
package in 0.9.0. Every name that used to live here still imports from
here — only the implementation moved. See
``app/services/auth/__init__.py`` for the current layout.
"""

from __future__ import annotations

from app.services.auth import (  # noqa: F401
    DEFAULT_PASSWORDS,
    DEFAULT_USERS,
    ENDPOINT_ROLES,
    ROLE_SCOPES,
    ROLES,
    AuthChannel,
    AuthService,
    AuthUser,
    IdentityType,
    TokenPayload,
    _auth_service,
    _build_default_users,
    _extract_bearer_token,
    _hash_password,
    _JWT_ALGORITHM,
    _JWT_ALLOWED_ALGORITHMS,
    _JWT_AUDIENCE,
    _JWT_ISSUER,
    _verify_password,
    get_current_user,
    require_identity_type,
    require_role,
    require_scope,
    validate_correlation_id,
)

__all__ = [
    "AuthService",
    "AuthUser",
    "TokenPayload",
    "IdentityType",
    "AuthChannel",
    "ROLES",
    "ROLE_SCOPES",
    "ENDPOINT_ROLES",
    "DEFAULT_PASSWORDS",
    "DEFAULT_USERS",
    "_auth_service",
    "_hash_password",
    "_verify_password",
    "_build_default_users",
    "_extract_bearer_token",
    "_JWT_ALGORITHM",
    "_JWT_ALLOWED_ALGORITHMS",
    "_JWT_ISSUER",
    "_JWT_AUDIENCE",
    "require_role",
    "require_scope",
    "require_identity_type",
    "get_current_user",
    "validate_correlation_id",
]
