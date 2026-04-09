"""Event telemetry routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_role, telemetry_service
from app.models import utc_now
from app.serializers import event_to_dict

router = APIRouter(tags=["events"])


@router.get("/events", dependencies=[Depends(require_role("viewer"))])
def list_events(
    actor_id: str | None = Query(default=None),
    correlation_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    since_minutes: int | None = Query(default=None, ge=1, le=1440),
) -> list[dict]:
    event_types = {event_type} if event_type else None
    events = telemetry_service.lookup_events(
        actor_id=actor_id,
        correlation_id=correlation_id,
        event_types=event_types,
        since_minutes=since_minutes,
    )
    return [event_to_dict(e) for e in events]


@router.get("/events/export", dependencies=[Depends(require_role("viewer"))])
def export_events(
    correlation_id: str | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    since_minutes: int | None = Query(default=None, ge=1, le=1440),
) -> dict:
    events = telemetry_service.lookup_events(
        actor_id=actor_id,
        correlation_id=correlation_id,
        since_minutes=since_minutes,
    )
    return {
        "export_timestamp": utc_now().isoformat(),
        "total_events": len(events),
        "events": [event_to_dict(e) for e in events],
    }
