"""Dashboard metrics routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.store import STORE

router = APIRouter(tags=["metrics"])


@router.get("/metrics", dependencies=[Depends(require_role("viewer"))])
def get_metrics() -> dict:
    events_by_category: dict[str, int] = {}
    for e in STORE.get_events():
        events_by_category[e.category] = events_by_category.get(e.category, 0) + 1

    alerts_by_severity: dict[str, int] = {}
    for a in STORE.get_alerts():
        sev = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        alerts_by_severity[sev] = alerts_by_severity.get(sev, 0) + 1

    incidents_by_status: dict[str, int] = {}
    for inc in STORE.get_all_incidents():
        incidents_by_status[inc.status] = incidents_by_status.get(inc.status, 0) + 1

    containment = STORE.get_containment_counts()
    active_containments = sum(containment.values())

    return {
        "total_events": len(STORE.get_events()),
        "total_alerts": len(STORE.get_alerts()),
        "total_responses": len(STORE.get_responses()),
        "total_incidents": len(STORE.get_all_incidents()),
        "active_containments": active_containments,
        "events_by_category": events_by_category,
        "alerts_by_severity": alerts_by_severity,
        "incidents_by_status": incidents_by_status,
    }
