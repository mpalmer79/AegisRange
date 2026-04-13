"""Admin routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request

from app.dependencies import require_role
from app.schemas import AdminResetResponse
from app.services import audit_service
from app.store import STORE

logger = logging.getLogger("aegisrange")
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={401: {"description": "Missing or invalid token"}},
)


@router.post(
    "/reset",
    dependencies=[Depends(require_role("admin"))],
    response_model=AdminResetResponse,
)
def admin_reset(request: Request) -> dict[str, str]:
    from app.main import reset_rate_limits

    platform_user = getattr(request.state, "platform_user", None)
    reset_by = platform_user.sub if platform_user else "unknown"
    correlation_id = getattr(request.state, "correlation_id", None)
    logger.warning("Store reset initiated", extra={"reset_by": reset_by})
    STORE.reset()
    reset_rate_limits()
    audit_service.log_admin_action(
        "store_reset", reset_by, correlation_id=correlation_id
    )
    return {"status": "reset", "reset_by": reset_by}
