"""Dashboard metrics routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.store import STORE

router = APIRouter(tags=["metrics"])


@router.get("/metrics", dependencies=[Depends(require_role("viewer"))])
def get_metrics() -> dict:
    events_by_category: dict[str, int] = {}
    for e in STORE.events:
        events_by_category[e.category] = events_by_category.get(e.category, 0) + 1

    alerts_by_severity: dict[str, int] = {}
    for a in STORE.alerts:
        sev = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        alerts_by_severity[sev] = alerts_by_severity.get(sev, 0) + 1

    incidents_by_status: dict[str, int] = {}
    for inc in STORE.incidents_by_correlation.values():
        incidents_by_status[inc.status] = incidents_by_status.get(inc.status, 0) + 1

    active_containments = (
        len(STORE.step_up_required)
        + len(STORE.revoked_sessions)
        + len(STORE.download_restricted_actors)
        + len(STORE.disabled_services)
        + len(STORE.quarantined_artifacts)
    )

    return {
        "total_events": len(STORE.events),
        "total_alerts": len(STORE.alerts),
        "total_responses": len(STORE.responses),
        "total_incidents": len(STORE.incidents_by_correlation),
        "active_containments": active_containments,
        "events_by_category": events_by_category,
        "alerts_by_severity": alerts_by_severity,
        "incidents_by_status": incidents_by_status,
    }
