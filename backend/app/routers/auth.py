"""Platform authentication routes.

Login sets an httpOnly cookie as the primary auth channel so the JWT
token never touches JavaScript.  The JSON body still returns non-secret
metadata (username, role, expires_at) for UI state.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.dependencies import auth_service, require_role
from app.schemas import LoginRequest
from app.serializers import auth_user_to_dict

router = APIRouter(prefix="/auth", tags=["auth"])


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


def _clear_auth_cookie(response: JSONResponse) -> None:
    """Clear the httpOnly auth cookie."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.auth_cookie_secure,
        path="/",
    )


@router.post("/login")
def platform_login(payload: LoginRequest) -> JSONResponse:
    success, token, expires_at = auth_service.authenticate(payload.username, payload.password)
    if not success or token is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = auth_service.get_user(payload.username)
    body = {
        "username": payload.username,
        "role": user.role if user else "unknown",
        "expires_at": expires_at.isoformat() if expires_at else None,
    }
    response = JSONResponse(content=body)
    _set_auth_cookie(response, token)
    return response


@router.post("/logout")
def platform_logout() -> JSONResponse:
    response = JSONResponse(content={"status": "logged_out"})
    _clear_auth_cookie(response)
    return response


@router.get("/me", dependencies=[Depends(require_role("viewer"))])
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


@router.get("/users", dependencies=[Depends(require_role("admin"))])
def list_platform_users() -> list[dict]:
    users = auth_service.list_users()
    return [auth_user_to_dict(u) for u in users]
