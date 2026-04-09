"""Incident management routes."""
from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from app.dependencies import require_role
from app.models import utc_now
from app.schemas import IncidentNote, IncidentStatusUpdate
from app.serializers import incident_to_dict
from app.store import STORE

logger = logging.getLogger("aegisrange")
router = APIRouter(tags=["incidents"])


def _serialize_incident(incident) -> dict:
    """Serialize an incident, injecting notes from the store."""
    return incident_to_dict(incident, notes=STORE.incident_notes.get(incident.correlation_id, []))


@router.get("/incidents", dependencies=[Depends(require_role("viewer"))])
def list_incidents() -> list[dict]:
    return [_serialize_incident(inc) for inc in STORE.incidents_by_correlation.values()]


@router.get("/incidents/{correlation_id}", dependencies=[Depends(require_role("viewer"))])
def get_incident(correlation_id: str) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(incident)


@router.patch("/incidents/{correlation_id}/status", dependencies=[Depends(require_role("analyst"))])
def update_incident_status(correlation_id: str, payload: IncidentStatusUpdate, request: Request) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    valid_transitions = {
        "open": {"investigating", "contained", "resolved"},
        "investigating": {"contained", "resolved"},
        "contained": {"resolved"},
        "resolved": {"closed"},
    }
    allowed = valid_transitions.get(incident.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{incident.status}' to '{payload.status}'. Allowed: {sorted(allowed)}",
        )

    platform_user = getattr(request.state, "platform_user", None)
    changed_by = platform_user.sub if platform_user else "unknown"
    old_status = incident.status
    logger.info("Incident status update", extra={"correlation_id": correlation_id, "from": old_status, "to": payload.status, "changed_by": changed_by})
    incident.status = payload.status
    if payload.status == "closed":
        incident.closed_at = utc_now()
    if payload.status == "contained":
        incident.containment_status = "full"

    incident.add_timeline_entry(
        entry_type="state_transition",
        reference_id=incident.incident_id,
        summary=f"Status changed from {old_status} to {payload.status} by {changed_by}.",
    )
    STORE.upsert_incident(incident)

    return _serialize_incident(incident)


@router.post("/incidents/{correlation_id}/notes", dependencies=[Depends(require_role("analyst"))])
def add_incident_note(correlation_id: str, note: IncidentNote, request: Request) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    platform_user = getattr(request.state, "platform_user", None)
    attributed_author = platform_user.sub if platform_user else note.author
    entry = {
        "note_id": f"note-{uuid4()}",
        "author": attributed_author,
        "content": note.content,
        "created_at": utc_now().isoformat(),
    }
    STORE.append_incident_note(correlation_id, entry)
    incident.add_timeline_entry(
        entry_type="analyst_note",
        reference_id=entry["note_id"],
        summary=f"Note by {attributed_author}: {note.content[:80]}",
    )
    STORE.upsert_incident(incident)
    return entry


@router.get("/incidents/{correlation_id}/notes", dependencies=[Depends(require_role("viewer"))])
def get_incident_notes(correlation_id: str) -> list[dict]:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return STORE.incident_notes.get(correlation_id, [])
