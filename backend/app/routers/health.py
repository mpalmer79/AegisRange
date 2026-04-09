"""Health check endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from app.models import utc_now

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": utc_now().isoformat()}
