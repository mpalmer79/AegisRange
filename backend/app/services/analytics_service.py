"""Analytics computations over the event / alert / response / incident graph.

0.10.0 item 3 of the README's "Next Steps" asked for deeper analytics.
This service derives metrics from the entities the platform already
persists — it adds no new authoritative state of its own. Every result
is deterministic and re-computable from the store.

Metrics exposed:

- :meth:`mttd_mttr_summary` — platform-wide mean time to detect (first
  event → first alert) and mean time to respond (first alert → first
  response). Returns both aggregate means and per-correlation rows so
  the frontend can graph outliers.
- :meth:`risk_trajectory` — time-series of risk-score changes for an
  actor, derived from the existing ``RiskProfile.score_history``.
- :meth:`alert_disposition_summary` — counts by severity and by
  incident status, plus a stale-investigation watchlist.
- :meth:`coverage_summary` — per-rule last-fired timestamp and a
  list of rules that have never fired on the current data, so drills
  that never exercise a coverage gap are visible.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.models import Alert, ResponseAction, utc_now
from app.services.detection import RULE_REGISTRY
from app.store import InMemoryStore


@dataclass(frozen=True)
class IncidentTiming:
    """One row in the MTTD/MTTR breakdown."""

    correlation_id: str
    first_event_at: datetime
    first_alert_at: datetime | None
    first_response_at: datetime | None
    incident_closed_at: datetime | None

    @property
    def mttd_seconds(self) -> float | None:
        if self.first_alert_at is None:
            return None
        return (self.first_alert_at - self.first_event_at).total_seconds()

    @property
    def mttr_seconds(self) -> float | None:
        if self.first_alert_at is None or self.first_response_at is None:
            return None
        return (self.first_response_at - self.first_alert_at).total_seconds()

    @property
    def time_to_close_seconds(self) -> float | None:
        if self.incident_closed_at is None:
            return None
        return (self.incident_closed_at - self.first_event_at).total_seconds()


class AnalyticsService:
    """Derived-metrics service. Pure reads from :class:`InMemoryStore`."""

    # How long an investigation can sit in a non-terminal status before we
    # surface it on the stale watchlist. Deliberately small for demo data;
    # real deployments would likely set this by env / settings.
    STALE_INVESTIGATION_HOURS = 24

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    # -- MTTD / MTTR ---------------------------------------------------------

    def _per_incident_timings(self) -> list[IncidentTiming]:
        rows: list[IncidentTiming] = []
        incidents_by_corr = {
            inc.correlation_id: inc for inc in self.store.get_all_incidents()
        }
        # Bucket events / alerts / responses by correlation_id once so the
        # per-correlation loop is linear in the total count, not quadratic.
        events_by_corr: dict[str, list] = {}
        for ev in self.store.get_events():
            events_by_corr.setdefault(ev.correlation_id, []).append(ev)

        alerts_by_corr: dict[str, list[Alert]] = {}
        for al in self.store.get_alerts():
            alerts_by_corr.setdefault(al.correlation_id, []).append(al)

        responses_by_corr: dict[str, list[ResponseAction]] = {}
        for rsp in self.store.get_responses():
            responses_by_corr.setdefault(rsp.correlation_id, []).append(rsp)

        # Iterate every correlation that has at least one event. Incidents
        # without events would be data-model violations, so we skip them.
        for corr, events in events_by_corr.items():
            first_event = min(events, key=lambda e: e.timestamp)
            alerts = alerts_by_corr.get(corr) or []
            responses = responses_by_corr.get(corr) or []
            incident = incidents_by_corr.get(corr)
            rows.append(
                IncidentTiming(
                    correlation_id=corr,
                    first_event_at=first_event.timestamp,
                    first_alert_at=(
                        min(a.created_at for a in alerts) if alerts else None
                    ),
                    first_response_at=(
                        min(r.created_at for r in responses) if responses else None
                    ),
                    incident_closed_at=incident.closed_at if incident else None,
                )
            )
        return rows

    def mttd_mttr_summary(self) -> dict:
        """Aggregate MTTD/MTTR across all correlations plus a per-incident
        breakdown. Aggregates use only correlations where both ends of the
        interval are available (otherwise the mean would be skewed by
        in-flight investigations)."""
        rows = self._per_incident_timings()
        mttds = [r.mttd_seconds for r in rows if r.mttd_seconds is not None]
        mttrs = [r.mttr_seconds for r in rows if r.mttr_seconds is not None]
        closes = [
            r.time_to_close_seconds for r in rows if r.time_to_close_seconds is not None
        ]

        def _avg(values: list[float]) -> float | None:
            return sum(values) / len(values) if values else None

        return {
            "total_correlations": len(rows),
            "correlations_with_detection": len(mttds),
            "correlations_with_response": len(mttrs),
            "correlations_closed": len(closes),
            "mttd_seconds_mean": _avg(mttds),
            "mttr_seconds_mean": _avg(mttrs),
            "time_to_close_seconds_mean": _avg(closes),
            "per_incident": [
                {
                    "correlation_id": r.correlation_id,
                    "first_event_at": r.first_event_at.isoformat(),
                    "first_alert_at": (
                        r.first_alert_at.isoformat() if r.first_alert_at else None
                    ),
                    "first_response_at": (
                        r.first_response_at.isoformat() if r.first_response_at else None
                    ),
                    "incident_closed_at": (
                        r.incident_closed_at.isoformat()
                        if r.incident_closed_at
                        else None
                    ),
                    "mttd_seconds": r.mttd_seconds,
                    "mttr_seconds": r.mttr_seconds,
                    "time_to_close_seconds": r.time_to_close_seconds,
                }
                for r in sorted(rows, key=lambda x: x.first_event_at, reverse=True)
            ],
        }

    # -- Risk trajectory -----------------------------------------------------

    def risk_trajectory(self, actor_id: str, *, since: datetime | None = None) -> dict:
        """Return the score history for ``actor_id`` as a time series.

        ``since`` optionally filters out history entries older than the
        given UTC timestamp — handy for charting a rolling window. The
        response carries the current and peak scores so the frontend
        doesn't have to recompute them from the series."""
        profile = self.store.get_risk_profile(actor_id)
        if profile is None:
            return {
                "actor_id": actor_id,
                "current_score": 0,
                "peak_score": 0,
                "contributing_rules": [],
                "points": [],
            }

        points: list[dict] = []
        for entry in profile.score_history:
            ts_str = entry.get("timestamp")
            if ts_str is None:
                continue
            if since is not None:
                try:
                    if datetime.fromisoformat(ts_str) < since:
                        continue
                except ValueError:
                    continue
            points.append(
                {
                    "timestamp": ts_str,
                    "rule_id": entry.get("rule_id"),
                    "delta": entry.get("delta"),
                    "score": entry.get("new_score"),
                }
            )
        return {
            "actor_id": profile.actor_id,
            "current_score": profile.current_score,
            "peak_score": profile.peak_score,
            "contributing_rules": list(profile.contributing_rules),
            "points": points,
        }

    # -- Alert disposition / stale investigations ----------------------------

    def alert_disposition_summary(self) -> dict:
        """Breakdown of the current alert and incident pool.

        - ``alerts_by_severity`` — counts keyed by ``Severity.value``
        - ``incidents_by_status`` — open / investigating / contained /
          resolved / closed counts
        - ``stale_incidents`` — correlation ids of incidents in a
          non-terminal status (``open``, ``investigating``) whose last
          update is older than :attr:`STALE_INVESTIGATION_HOURS`.
        """
        alerts_by_severity: dict[str, int] = {}
        for alert in self.store.get_alerts():
            sev = alert.severity.value
            alerts_by_severity[sev] = alerts_by_severity.get(sev, 0) + 1

        incidents_by_status: dict[str, int] = {}
        stale: list[dict] = []
        cutoff = utc_now() - timedelta(hours=self.STALE_INVESTIGATION_HOURS)
        non_terminal = {"open", "investigating"}
        for inc in self.store.get_all_incidents():
            incidents_by_status[inc.status] = incidents_by_status.get(inc.status, 0) + 1
            if inc.status in non_terminal and inc.updated_at < cutoff:
                stale.append(
                    {
                        "correlation_id": inc.correlation_id,
                        "incident_id": inc.incident_id,
                        "status": inc.status,
                        "last_updated": inc.updated_at.isoformat(),
                        "primary_actor_id": inc.primary_actor_id,
                        "severity": inc.severity.value,
                    }
                )

        return {
            "alerts_total": sum(alerts_by_severity.values()),
            "alerts_by_severity": alerts_by_severity,
            "incidents_total": sum(incidents_by_status.values()),
            "incidents_by_status": incidents_by_status,
            "stale_investigations": stale,
            "stale_threshold_hours": self.STALE_INVESTIGATION_HOURS,
        }

    # -- Detection coverage --------------------------------------------------

    def coverage_summary(self) -> dict:
        """Per-rule last-fired timestamp plus a gap list of rules that
        have never fired against the current data. Useful for spotting
        scenarios / exercises that don't exercise a given rule."""
        last_fired: dict[str, datetime] = {}
        trigger_counts: dict[str, int] = {}
        for alert in self.store.get_alerts():
            trigger_counts[alert.rule_id] = trigger_counts.get(alert.rule_id, 0) + 1
            current = last_fired.get(alert.rule_id)
            if current is None or alert.created_at > current:
                last_fired[alert.rule_id] = alert.created_at

        per_rule = []
        gaps = []
        for rule_id in sorted(RULE_REGISTRY.keys()):
            rule = RULE_REGISTRY[rule_id]
            ts = last_fired.get(rule_id)
            row = {
                "rule_id": rule_id,
                "rule_name": rule.name,
                "enabled": rule.enabled,
                "trigger_count": trigger_counts.get(rule_id, 0),
                "last_fired_at": ts.isoformat() if ts else None,
            }
            per_rule.append(row)
            if row["trigger_count"] == 0:
                gaps.append(rule_id)

        return {
            "per_rule": per_rule,
            "rules_never_fired": gaps,
            "rules_total": len(RULE_REGISTRY),
            "rules_with_triggers": len(RULE_REGISTRY) - len(gaps),
        }
