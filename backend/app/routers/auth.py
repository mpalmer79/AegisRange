"""Platform authentication routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import auth_service, require_role
from app.schemas import LoginRequest
from app.serializers import auth_user_to_dict

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def platform_login(payload: LoginRequest) -> dict:
    success, token, expires_at = auth_service.authenticate(payload.username, payload.password)
    if not success or token is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = auth_service.get_user(payload.username)
    return {
        "token": token,
        "username": payload.username,
        "role": user.role if user else "unknown",
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


@router.get("/users", dependencies=[Depends(require_role("admin"))])
def list_platform_users() -> list[dict]:
    users = auth_service.list_users()
    return [auth_user_to_dict(u) for u in users]
