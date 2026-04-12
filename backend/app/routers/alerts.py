"""Alert routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_role
from app.serializers import alert_to_dict
from app.store import STORE

router = APIRouter(tags=["alerts"])


@router.get("/alerts", dependencies=[Depends(require_role("viewer"))])
def list_alerts(
    actor_id: str | None = Query(default=None),
    correlation_id: str | None = Query(default=None),
    rule_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict:
    alerts = STORE.get_alerts()
    if actor_id:
        alerts = [a for a in alerts if a.actor_id == actor_id]
    if correlation_id:
        alerts = [a for a in alerts if a.correlation_id == correlation_id]
    if rule_id:
        alerts = [a for a in alerts if a.rule_id == rule_id]
    total = len(alerts)
    start = (page - 1) * page_size
    end = start + page_size
    page_alerts = alerts[start:end]
    return {
        "items": [alert_to_dict(a) for a in page_alerts],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 0,
    }
