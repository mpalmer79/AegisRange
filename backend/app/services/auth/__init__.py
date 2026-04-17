"""Auth package — split form of the former ``app.services.auth_service``.

Layout:
- ``passwords.py``    — PBKDF2 hashing, ``DEFAULT_PASSWORDS``, ``DEFAULT_USERS``
- ``roles.py``        — ``ROLES``, ``ROLE_SCOPES``, ``ENDPOINT_ROLES``,
                        ``IdentityType``, ``AuthChannel``,
                        ``_extract_bearer_token``,
                        ``require_role``/``require_scope``/``require_identity_type``
- ``correlation.py``  — ``validate_correlation_id``
- ``service.py``      — ``AuthService``, ``AuthUser``, ``TokenPayload``,
                        module-level ``_auth_service`` singleton,
                        ``get_current_user``, JWT constants

Public API is preserved via ``app.services.auth_service`` shim.
"""

from __future__ import annotations

from .correlation import validate_correlation_id
from .passwords import (
    DEFAULT_PASSWORDS,
    DEFAULT_USERS,
    _build_default_users,
    _hash_password,
    _verify_password,
)
from .roles import (
    ENDPOINT_ROLES,
    ROLE_SCOPES,
    ROLES,
    AuthChannel,
    IdentityType,
    _extract_bearer_token,
    require_identity_type,
    require_role,
    require_scope,
)
from .service import (
    _JWT_ALGORITHM,
    _JWT_ALLOWED_ALGORITHMS,
    _JWT_AUDIENCE,
    _JWT_ISSUER,
    AuthService,
    AuthUser,
    TokenPayload,
    _auth_service,
    get_current_user,
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
