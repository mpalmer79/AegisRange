"""Dashboard metrics routes.

Two surfaces:

- ``GET /metrics`` — JSON dashboard metrics. Gated on ``viewer``.
- ``GET /metrics/prometheus`` — OpenMetrics text exposition for
  scraping by Prometheus / any compatible TSDB. Gated on ``admin``
  (or can be exposed through a reverse proxy with a dedicated scrape
  token).

The Prometheus endpoint emits counters by hand; we avoid adding
``prometheus_client`` as a dependency because the surface is small
enough that a hand-rolled serializer is a net simplification.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.dependencies import require_role
from app.schemas import MetricsResponse
from app.services.detection import RULE_REGISTRY
from app.store import STORE

router = APIRouter(
    tags=["metrics"], responses={401: {"description": "Missing or invalid token"}}
)


@router.get(
    "/metrics",
    response_model=MetricsResponse,
    dependencies=[Depends(require_role("viewer"))],
)
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


# ---------------------------------------------------------------------------
# Prometheus / OpenMetrics exposition (0.10.0)
# ---------------------------------------------------------------------------


def _escape_label_value(value: str) -> str:
    """Escape a label value per the OpenMetrics spec: backslash, quote,
    newline. Values are 1-line UTF-8."""
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _format_counter(
    name: str,
    help_text: str,
    value: float,
    labels: dict[str, str] | None = None,
) -> list[str]:
    """Format a single counter metric (# HELP + # TYPE + line)."""
    lines = [f"# HELP {name} {help_text}", f"# TYPE {name} counter"]
    if labels:
        label_text = ",".join(
            f'{k}="{_escape_label_value(v)}"' for k, v in sorted(labels.items())
        )
        lines.append(f"{name}{{{label_text}}} {value}")
    else:
        lines.append(f"{name} {value}")
    return lines


def _format_gauge(
    name: str,
    help_text: str,
    value: float,
    labels: dict[str, str] | None = None,
) -> list[str]:
    lines = [f"# HELP {name} {help_text}", f"# TYPE {name} gauge"]
    if labels:
        label_text = ",".join(
            f'{k}="{_escape_label_value(v)}"' for k, v in sorted(labels.items())
        )
        lines.append(f"{name}{{{label_text}}} {value}")
    else:
        lines.append(f"{name} {value}")
    return lines


@router.get(
    "/metrics/prometheus",
    dependencies=[Depends(require_role("admin"))],
    response_class=PlainTextResponse,
)
def get_prometheus_metrics() -> str:
    """Emit OpenMetrics-compatible text exposition.

    The metric families map 1:1 to the JSON dashboard surface so a
    Prometheus-scraping deployment and a JSON-reading dashboard
    describe the same world. Metric names follow the Prometheus naming
    convention: lower_snake_case with a ``aegisrange_`` prefix.
    """
    lines: list[str] = []

    # Totals — gauges because the store is authoritative and we snapshot.
    lines += _format_gauge(
        "aegisrange_events_total",
        "Current number of ingested events in the store.",
        len(STORE.get_events()),
    )
    lines += _format_gauge(
        "aegisrange_alerts_total",
        "Current number of alerts in the store.",
        len(STORE.get_alerts()),
    )
    lines += _format_gauge(
        "aegisrange_responses_total",
        "Current number of response actions in the store.",
        len(STORE.get_responses()),
    )
    lines += _format_gauge(
        "aegisrange_incidents_total",
        "Current number of incidents in the store.",
        len(STORE.get_all_incidents()),
    )

    # Active containments gauge
    containment = STORE.get_containment_counts()
    lines += _format_gauge(
        "aegisrange_active_containments",
        "Number of active containment actions of each kind.",
        sum(containment.values()),
    )
    for kind, count in sorted(containment.items()):
        lines += _format_gauge(
            "aegisrange_containments_by_kind",
            "Number of active containment actions, per kind.",
            count,
            labels={"kind": kind},
        )

    # Alerts-by-severity
    by_sev: dict[str, int] = {}
    for alert in STORE.get_alerts():
        sev = alert.severity.value
        by_sev[sev] = by_sev.get(sev, 0) + 1
    for sev, count in sorted(by_sev.items()):
        lines += _format_gauge(
            "aegisrange_alerts_by_severity",
            "Current alerts in the store, broken down by severity.",
            count,
            labels={"severity": sev},
        )

    # Rule trigger counts
    trigger_counts: dict[str, int] = {}
    for alert in STORE.get_alerts():
        trigger_counts[alert.rule_id] = trigger_counts.get(alert.rule_id, 0) + 1
    for rule_id in sorted(RULE_REGISTRY.keys()):
        lines += _format_counter(
            "aegisrange_rule_triggers_total",
            "Total alerts generated per detection rule since boot.",
            trigger_counts.get(rule_id, 0),
            labels={"rule_id": rule_id},
        )

    # Incidents-by-status
    by_status: dict[str, int] = {}
    for inc in STORE.get_all_incidents():
        by_status[inc.status] = by_status.get(inc.status, 0) + 1
    for status, count in sorted(by_status.items()):
        lines += _format_gauge(
            "aegisrange_incidents_by_status",
            "Current incidents in the store, broken down by lifecycle status.",
            count,
            labels={"status": status},
        )

    # Trailing newline is required by OpenMetrics spec.
    return "\n".join(lines) + "\n"
