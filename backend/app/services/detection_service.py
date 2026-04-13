"""Detection service — evaluates structured rules against incoming events.

Rules are defined in ``detection_rules.py`` as ``DetectionRule`` objects
with full metadata (version, MITRE mapping, explainability).  This
service iterates over enabled rules and passes each event through
the rule's ``evaluate`` callback with a ``RuleContext`` providing
access to telemetry lookups and store state.
"""

from __future__ import annotations

from app.models import Alert, Event
from app.services import audit_service
from app.services.detection_rules import (
    RuleContext,
    detection_metrics,
    get_enabled_rules,
)
from app.services.event_services import TelemetryService


class DetectionService:
    """Deterministic detection engine using structured rule definitions."""

    def __init__(self, telemetry: TelemetryService) -> None:
        self.telemetry = telemetry

    def _build_context(self, event: Event) -> RuleContext:
        """Build a ``RuleContext`` for rule evaluation.

        The context provides controlled access to telemetry lookups
        and store state, plus identity context from the event.
        """
        store = self.telemetry.store
        return RuleContext(
            lookup_events=self.telemetry.lookup_events,
            is_step_up_required=store.is_step_up_required,
            is_download_restricted=store.is_download_restricted,
            actor_identity_type=event.actor_type,
            actor_role=event.actor_role,
            platform_user=event.payload.get("platform_user_id"),
        )

    def evaluate(self, event: Event) -> list[Alert]:
        """Evaluate all enabled detection rules against an event."""
        ctx = self._build_context(event)
        alerts: list[Alert] = []
        detection_metrics.record_evaluation()

        for rule in get_enabled_rules():
            alert = rule.evaluate(event, ctx)
            if alert is not None:
                alerts.append(alert)
                detection_metrics.record_trigger(rule)
                audit_service.log_detection_triggered(
                    rule.rule_id,
                    rule.version,
                    event.actor_id,
                    event.correlation_id,
                    rule.severity.value,
                )

        return alerts
