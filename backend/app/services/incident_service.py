from __future__ import annotations

from datetime import datetime

from app.models import Alert, Event, Incident, ResponseAction, Severity
from app.store import InMemoryStore


class IncidentService:
    VALID_STATES = {"open", "investigating", "contained", "resolved"}
    ALLOWED_TRANSITIONS = {
        "open": {"investigating", "contained", "resolved"},
        "investigating": {"contained", "resolved"},
        "contained": {"resolved"},
        "resolved": set(),
    }

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def register_event(self, event: Event) -> None:
        incident = self.store.incidents_by_correlation.get(event.correlation_id)
        if not incident:
            return
        self._append_event(incident, event)

    def register_alert(self, alert: Alert, source_event: Event) -> Incident:
        incident = self.store.incidents_by_correlation.get(alert.correlation_id)

        should_create = alert.severity in {Severity.HIGH, Severity.CRITICAL} or alert.rule_id == "DET-AUTH-002"
        if incident is None and should_create:
            incident = Incident(
                incident_type="suspicious_account_activity",
                primary_actor_id=alert.actor_id,
                actor_type=source_event.actor_type,
                actor_role=source_event.actor_role,
                correlation_id=alert.correlation_id,
                severity=alert.severity,
                confidence=alert.confidence,
            )
            self.store.incidents_by_correlation[alert.correlation_id] = incident
            incident.add_timeline_entry(
                entry_type="state_transition",
                reference_id=incident.incident_id,
                summary="Incident created from high-confidence detection.",
            )

        if incident is None:
            # Medium/low confidence detections are kept as alerts without incident creation in Phase 1.
            return Incident(
                incident_type="none",
                primary_actor_id=alert.actor_id,
                actor_type=source_event.actor_type,
                correlation_id=alert.correlation_id,
                severity=alert.severity,
                confidence=alert.confidence,
                status="not_created",
            )

        incident.detection_ids.append(alert.rule_id)
        incident.detection_summary.append(alert.summary)
        incident.add_timeline_entry(
            entry_type="detection",
            reference_id=alert.alert_id,
            summary=f"{alert.rule_id}: {alert.summary}",
        )
        for event_id in alert.contributing_event_ids:
            if event_id not in incident.event_ids:
                incident.event_ids.append(event_id)
        return incident

    def register_response(self, incident: Incident, response: ResponseAction) -> None:
        if incident.status == "not_created":
            return
        incident.response_ids.append(response.response_id)
        if response.action_type in {"session_revocation", "download_block", "download_restriction"}:
            incident.containment_status = "full"
            if incident.status in {"open", "investigating"}:
                self.transition_status(
                    incident.correlation_id,
                    "contained",
                    reason=f"Containment action executed: {response.action_type}",
                )
        else:
            incident.containment_status = "partial"
            if incident.status == "open":
                self.transition_status(
                    incident.correlation_id,
                    "investigating",
                    reason=f"Response action executed: {response.action_type}",
                )
        incident.add_timeline_entry(
            entry_type="response",
            reference_id=response.response_id,
            summary=f"{response.playbook_id}: {response.action_type}",
        )

    def transition_status(self, correlation_id: str, target_status: str, reason: str) -> Incident:
        incident = self.store.incidents_by_correlation.get(correlation_id)
        if incident is None:
            raise ValueError("Incident not found")
        if target_status not in self.VALID_STATES:
            raise ValueError(f"Unsupported incident status: {target_status}")
        if target_status == incident.status:
            return incident

        allowed = self.ALLOWED_TRANSITIONS.get(incident.status, set())
        if target_status not in allowed:
            raise ValueError(f"Invalid transition from {incident.status} to {target_status}")

        incident.status = target_status
        incident.updated_at = datetime.utcnow()
        if target_status == "resolved":
            incident.closed_at = incident.updated_at
            incident.containment_status = "full"

        incident.add_timeline_entry(
            entry_type="state_transition",
            reference_id=incident.incident_id,
            summary=f"Incident moved to {target_status}: {reason}",
        )
        return incident

    @staticmethod
    def _append_event(incident: Incident, event: Event) -> None:
        if event.event_id not in incident.event_ids:
            incident.event_ids.append(event.event_id)
        incident.add_timeline_entry(
            entry_type="source_event",
            reference_id=event.event_id,
            summary=f"{event.event_type} ({event.status})",
        )
