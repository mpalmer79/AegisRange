"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.models import utc_now
from app.schemas import HealthResponse
from app.store import STORE

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    return {
        "status": "ok",
        "timestamp": utc_now().isoformat(),
        "stats": {
            "events": len(STORE.events),
            "alerts": len(STORE.alerts),
            "incidents": len(STORE.incidents_by_correlation),
            "responses": len(STORE.responses),
        },
        "containment": STORE.get_containment_counts(),
        "persistence": STORE._persistence is not None,
    }
