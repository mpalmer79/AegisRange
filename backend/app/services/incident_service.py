from __future__ import annotations

from app.models import Alert, Event, Incident, ResponseAction, Severity
from app.store import InMemoryStore


class IncidentService:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def register_event(self, event: Event) -> None:
        incident = self.store.incidents_by_correlation.get(event.correlation_id)
        if not incident:
            return
        self._append_event(incident, event)
        self.store.upsert_incident(incident)

    def register_alert(self, alert: Alert, source_event: Event) -> Incident:
        incident = self.store.incidents_by_correlation.get(alert.correlation_id)

        should_create = alert.severity in {Severity.HIGH, Severity.CRITICAL} or alert.rule_id == "DET-AUTH-002"
        if incident is None and should_create:
            incident = Incident(
                incident_type=self._classify_incident(alert),
                primary_actor_id=alert.actor_id,
                actor_type=source_event.actor_type,
                actor_role=source_event.actor_role,
                correlation_id=alert.correlation_id,
                severity=alert.severity,
                confidence=alert.confidence,
            )
            incident.add_timeline_entry(
                entry_type="state_transition",
                reference_id=incident.incident_id,
                summary="Incident created from high-confidence detection.",
            )
            self.store.upsert_incident(incident)

        if incident is None:
            return Incident(
                incident_type="none",
                primary_actor_id=alert.actor_id,
                actor_type=source_event.actor_type,
                correlation_id=alert.correlation_id,
                severity=alert.severity,
                confidence=alert.confidence,
                status="not_created",
            )

        # Escalate severity if new alert is more severe
        severity_order = [Severity.INFORMATIONAL, Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]
        if severity_order.index(alert.severity) > severity_order.index(incident.severity):
            old_severity = incident.severity
            incident.severity = alert.severity
            incident.add_timeline_entry(
                entry_type="state_transition",
                reference_id=alert.alert_id,
                summary=f"Severity escalated from {old_severity.value} to {alert.severity.value}.",
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

        # Track affected resources
        if source_event.category == "document" and source_event.target_id:
            if source_event.target_id not in incident.affected_documents:
                incident.affected_documents.append(source_event.target_id)
        if source_event.session_id:
            if source_event.session_id not in incident.affected_sessions:
                incident.affected_sessions.append(source_event.session_id)
        if source_event.actor_type == "service" and source_event.actor_id:
            if source_event.actor_id not in incident.affected_services:
                incident.affected_services.append(source_event.actor_id)

        self.store.upsert_incident(incident)
        return incident

    def register_response(self, incident: Incident, response: ResponseAction) -> None:
        if incident.status == "not_created":
            return
        incident.response_ids.append(response.response_id)
        incident.containment_status = "partial"
        incident.add_timeline_entry(
            entry_type="response",
            reference_id=response.response_id,
            summary=f"{response.playbook_id}: {response.action_type}",
        )
        self.store.upsert_incident(incident)

    @staticmethod
    def _classify_incident(alert: Alert) -> str:
        rule_to_type = {
            "DET-AUTH-001": "credential_abuse",
            "DET-AUTH-002": "credential_compromise",
            "DET-SESSION-003": "session_hijack",
            "DET-DOC-004": "policy_violation",
            "DET-DOC-005": "data_exfiltration",
            "DET-DOC-006": "data_exfiltration",
            "DET-SVC-007": "service_misuse",
            "DET-ART-008": "artifact_tampering",
            "DET-POL-009": "privileged_change_abuse",
            "DET-CORR-010": "multi_signal_compromise",
        }
        return rule_to_type.get(alert.rule_id, "suspicious_account_activity")

    @staticmethod
    def _append_event(incident: Incident, event: Event) -> None:
        if event.event_id not in incident.event_ids:
            incident.event_ids.append(event.event_id)
        incident.add_timeline_entry(
            entry_type="source_event",
            reference_id=event.event_id,
            summary=f"{event.event_type} ({event.status})",
        )
