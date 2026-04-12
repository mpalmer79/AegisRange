"""Event telemetry routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_role, telemetry_service
from app.models import utc_now
from app.schemas import EventResponse, EventsExportResponse, PaginatedResponse
from app.serializers import event_to_dict

router = APIRouter(tags=["events"])


@router.get("/events", response_model=PaginatedResponse[EventResponse], dependencies=[Depends(require_role("viewer"))])
def list_events(
    actor_id: str | None = Query(default=None),
    correlation_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    since_minutes: int | None = Query(default=None, ge=1, le=1440),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict:
    event_types = {event_type} if event_type else None
    events = telemetry_service.lookup_events(
        actor_id=actor_id,
        correlation_id=correlation_id,
        event_types=event_types,
        since_minutes=since_minutes,
    )
    total = len(events)
    start = (page - 1) * page_size
    end = start + page_size
    page_events = events[start:end]
    return {
        "items": [event_to_dict(e) for e in page_events],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 0,
    }


@router.get("/events/export", response_model=EventsExportResponse, dependencies=[Depends(require_role("viewer"))])
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
