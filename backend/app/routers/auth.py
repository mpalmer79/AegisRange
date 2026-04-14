"""Platform authentication routes.

Login sets an httpOnly cookie as the primary auth channel so the JWT
token never touches JavaScript.  The JSON body still returns non-secret
metadata (username, role, expires_at) for UI state.

A non-httpOnly CSRF cookie is also set on login so the frontend can
read it and include it as a header on state-changing requests.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import auth_service, require_role
from app.schemas import (
    AuthLoginResponse,
    AuthLogoutResponse,
    AuthMeResponse,
    AuthUserResponse,
    LoginRequest,
)
from app.serializers import auth_user_to_dict
from app.services import audit_service
from app.services.totp_service import totp_service
from app.store import STORE

logger = logging.getLogger("aegisrange.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# MFA request schemas (local to this router)
# ---------------------------------------------------------------------------


class _StrictInput(BaseModel):
    model_config = {"extra": "forbid"}


class MFAVerifyRequest(_StrictInput):
    username: str = Field(..., min_length=1, max_length=64)
    code: str = Field(..., min_length=6, max_length=6)


class MFAEnrollResponse(BaseModel):
    secret: str
    provisioning_uri: str


class MFAStatusResponse(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------


def _set_auth_cookie(response: JSONResponse, token: str) -> None:
    """Set the httpOnly auth cookie on a response."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.auth_cookie_secure,
        path="/",
    )


def _set_csrf_cookie(response: JSONResponse) -> None:
    """Set a non-httpOnly CSRF token cookie.

    The cookie is readable by JavaScript so the frontend can include
    the token value in the ``X-CSRF-Token`` header on state-changing
    requests.  The middleware validates that the header matches the
    cookie.
    """
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,  # must be readable by JS
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.auth_cookie_secure,
        path="/",
    )


def _clear_auth_cookie(response: JSONResponse) -> None:
    """Clear the httpOnly auth cookie."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.auth_cookie_secure,
        path="/",
    )


def _clear_csrf_cookie(response: JSONResponse) -> None:
    """Clear the CSRF cookie."""
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        httponly=False,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.auth_cookie_secure,
        path="/",
    )


def _issue_token_response(username: str) -> JSONResponse:
    """Create a JSONResponse with auth cookie and body for a successful login."""
    user = auth_service.get_user(username)
    token = auth_service.create_token(username, user.role if user else "viewer")
    payload = auth_service.verify_token(token)
    expires_at = payload.exp if payload else None
    body = {
        "username": username,
        "role": user.role if user else "unknown",
        "expires_at": expires_at.isoformat() if expires_at else None,
    }
    response = JSONResponse(content=body)
    _set_auth_cookie(response, token)
    _set_csrf_cookie(response)
    return response


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@router.post("/login", response_model=AuthLoginResponse)
def platform_login(payload: LoginRequest, request: Request) -> JSONResponse:
    client_ip = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)

    # Check lockout before attempting authentication
    if auth_service.is_account_locked(payload.username):
        remaining = auth_service.get_lockout_remaining(payload.username)
        audit_service.log_account_lockout(
            payload.username,
            remaining,
            client_ip=client_ip,
            correlation_id=correlation_id,
        )
        raise HTTPException(
            status_code=423,
            detail="Account temporarily locked due to too many failed attempts",
        )

    success, token, expires_at, mfa_status = auth_service.authenticate(
        payload.username, payload.password
    )
    audit_service.log_login_attempt(
        payload.username, success, client_ip=client_ip, correlation_id=correlation_id
    )
    if not success or (token is None and mfa_status is None):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # MFA required — password was correct but we need TOTP verification
    if mfa_status == "mfa_required":
        mfa_user = auth_service.get_user(payload.username)
        return JSONResponse(
            status_code=200,
            content={
                "username": payload.username,
                "role": mfa_user.role if mfa_user else "unknown",
                "mfa_required": True,
            },
        )

    # Normal login — issue token
    user = auth_service.get_user(payload.username)
    body = {
        "username": payload.username,
        "role": user.role if user else "unknown",
        "expires_at": expires_at.isoformat() if expires_at else None,
    }
    response = JSONResponse(content=body)
    if token is None:
        raise HTTPException(status_code=500, detail="Token issuance failed")
    _set_auth_cookie(response, token)
    _set_csrf_cookie(response)
    return response


@router.post("/logout", response_model=AuthLogoutResponse)
def platform_logout(request: Request) -> JSONResponse:
    """Log out by revoking the JWT token ID and clearing the cookie."""
    # Extract JTI from the cookie before clearing it.
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    correlation_id = getattr(request.state, "correlation_id", None)
    if cookie_token:
        jti = auth_service.extract_jti(cookie_token)
        if jti:
            STORE.revoke_jti(jti)
            audit_service.log_logout(jti=jti, correlation_id=correlation_id)
            logger.info("Revoked JTI on logout", extra={"jti": jti})
    response = JSONResponse(content={"status": "logged_out"})
    _clear_auth_cookie(response)
    _clear_csrf_cookie(response)
    return response


@router.get(
    "/me", dependencies=[Depends(require_role("viewer"))], response_model=AuthMeResponse
)
def get_current_user(request: Request) -> dict:
    """Return the authenticated platform user's identity from the cookie/token."""
    platform_user = getattr(request.state, "platform_user", None)
    if platform_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = auth_service.get_user(platform_user.sub)
    return {
        "username": platform_user.sub,
        "role": platform_user.role,
        "display_name": user.display_name if user else platform_user.sub,
    }


@router.get(
    "/users",
    dependencies=[Depends(require_role("admin"))],
    response_model=list[AuthUserResponse],
)
def list_platform_users() -> list[dict]:
    users = auth_service.list_users()
    return [auth_user_to_dict(u) for u in users]


# ---------------------------------------------------------------------------
# MFA / TOTP routes
# ---------------------------------------------------------------------------


@router.post("/mfa/enroll", dependencies=[Depends(require_role("viewer"))])
def mfa_enroll(request: Request) -> MFAEnrollResponse:
    """Enroll the authenticated user (or admin enrolling another user) in TOTP MFA."""
    platform_user = getattr(request.state, "platform_user", None)
    if platform_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    username = platform_user.sub

    if username in STORE.totp_enabled:
        raise HTTPException(status_code=409, detail="MFA already enrolled")

    secret = totp_service.generate_secret()
    STORE.totp_secrets[username] = secret
    STORE.totp_enabled.add(username)

    correlation_id = getattr(request.state, "correlation_id", None)
    audit_service.log_mfa_enrollment(username, correlation_id=correlation_id)

    return MFAEnrollResponse(
        secret=secret,
        provisioning_uri=totp_service.provisioning_uri(secret, username),
    )


@router.post("/mfa/verify")
def mfa_verify(payload: MFAVerifyRequest, request: Request) -> JSONResponse:
    """Verify a TOTP code after password authentication and issue a JWT token.

    This endpoint is called when ``/auth/login`` returns ``mfa_required: true``.
    """
    username = payload.username
    correlation_id = getattr(request.state, "correlation_id", None)

    if username not in STORE.totp_enabled:
        raise HTTPException(status_code=400, detail="MFA not enrolled for this user")

    secret = STORE.totp_secrets.get(username)
    if not secret:
        raise HTTPException(status_code=400, detail="MFA not enrolled for this user")

    if not totp_service.verify_code(secret, payload.code):
        audit_service.log_mfa_verification(
            username, False, correlation_id=correlation_id
        )
        raise HTTPException(status_code=401, detail="Invalid TOTP code")

    audit_service.log_mfa_verification(username, True, correlation_id=correlation_id)

    return _issue_token_response(username)


@router.post("/mfa/disable", dependencies=[Depends(require_role("admin"))])
def mfa_disable(request: Request) -> MFAStatusResponse:
    """Disable MFA for a user (admin-only emergency removal).

    Accepts a ``username`` query parameter specifying which user to disable.
    """
    target_username = request.query_params.get("username")
    if not target_username:
        raise HTTPException(status_code=422, detail="username query parameter required")

    platform_user = getattr(request.state, "platform_user", None)
    actor = platform_user.sub if platform_user else "unknown"

    if target_username not in STORE.totp_enabled:
        raise HTTPException(status_code=404, detail="MFA not enrolled for this user")

    STORE.totp_enabled.discard(target_username)
    STORE.totp_secrets.pop(target_username, None)

    correlation_id = getattr(request.state, "correlation_id", None)
    audit_service.log_mfa_disabled(
        target_username, actor, correlation_id=correlation_id
    )

    return MFAStatusResponse(status="mfa_disabled")
