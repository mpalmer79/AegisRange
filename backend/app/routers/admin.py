"""Admin routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request

from app.dependencies import require_role
from app.store import STORE

logger = logging.getLogger("aegisrange")
router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/reset", dependencies=[Depends(require_role("admin"))])
def admin_reset(request: Request) -> dict[str, str]:
    from app.main import reset_rate_limits

    platform_user = getattr(request.state, "platform_user", None)
    reset_by = platform_user.sub if platform_user else "unknown"
    logger.warning("Store reset initiated", extra={"reset_by": reset_by})
    STORE.reset()
    reset_rate_limits()
    return {"status": "reset", "reset_by": reset_by}
