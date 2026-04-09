from __future__ import annotations

from app.models import Alert, ResponseAction
from app.store import InMemoryStore


class ResponseOrchestrator:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def execute(self, alert: Alert) -> list[ResponseAction]:
        handlers = {
            "DET-AUTH-001": self._auth_failure_containment,
            "DET-AUTH-002": self._suspicious_login_containment,
            "DET-SESSION-003": self._session_hijack_containment,
            "DET-DOC-004": self._restricted_access_enforcement,
            "DET-DOC-005": self._bulk_access_constraint,
            "DET-DOC-006": self._data_exfiltration_containment,
            "DET-SVC-007": self._service_identity_containment,
            "DET-ART-008": self._artifact_quarantine,
            "DET-POL-009": self._privileged_change_control,
            "DET-CORR-010": self._multi_signal_incident_containment,
        }

        handler = handlers.get(alert.rule_id)
        if handler is None:
            return []

        responses = handler(alert)
        self.store.extend_responses(responses)
        return responses

    def _auth_failure_containment(self, alert: Alert) -> list[ResponseAction]:
        return [
            ResponseAction(
                playbook_id="PB-AUTH-001",
                action_type="rate_limit",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={"failure_count": alert.payload.get("failure_count")},
            )
        ]

    def _suspicious_login_containment(self, alert: Alert) -> list[ResponseAction]:
        self.store.require_step_up(alert.actor_id)
        return [
            ResponseAction(
                playbook_id="PB-AUTH-002",
                action_type="step_up_authentication",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={"enforcement_scope": "current_session"},
            )
        ]

    def _session_hijack_containment(self, alert: Alert) -> list[ResponseAction]:
        session_id = alert.payload.get("session_id")
        if session_id:
            self.store.revoke_session(session_id)
        return [
            ResponseAction(
                playbook_id="PB-SESSION-003",
                action_type="session_revocation",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={"session_id": session_id, "source_ip_list": alert.payload.get("source_ip_list")},
            )
        ]

    def _restricted_access_enforcement(self, alert: Alert) -> list[ResponseAction]:
        return [
            ResponseAction(
                playbook_id="PB-DOC-004",
                action_type="access_denied",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={
                    "document_id": alert.payload.get("document_id"),
                    "classification": alert.payload.get("classification"),
                    "actor_role": alert.payload.get("actor_role"),
                },
            )
        ]

    def _bulk_access_constraint(self, alert: Alert) -> list[ResponseAction]:
        self.store.restrict_downloads(alert.actor_id)
        return [
            ResponseAction(
                playbook_id="PB-DOC-005",
                action_type="download_restriction",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={"document_count": alert.payload.get("document_count")},
            )
        ]

    def _data_exfiltration_containment(self, alert: Alert) -> list[ResponseAction]:
        self.store.restrict_downloads(alert.actor_id)
        return [
            ResponseAction(
                playbook_id="PB-DOC-006",
                action_type="download_block",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={
                    "read_count": alert.payload.get("read_count"),
                    "download_count": alert.payload.get("download_count"),
                    "overlapping_documents": alert.payload.get("overlapping_documents"),
                },
            )
        ]

    def _service_identity_containment(self, alert: Alert) -> list[ResponseAction]:
        service_id = alert.payload.get("service_id")
        route_list = alert.payload.get("route_list", [])
        if service_id:
            self.store.disable_service(service_id)
            self.store.block_routes(service_id, route_list)
        return [
            ResponseAction(
                playbook_id="PB-SVC-007",
                action_type="service_disabled",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={
                    "service_id": service_id,
                    "route_list": route_list,
                },
            )
        ]

    def _artifact_quarantine(self, alert: Alert) -> list[ResponseAction]:
        artifact_ids = alert.payload.get("artifact_ids", [])
        for artifact_id in artifact_ids:
            self.store.quarantine_artifact(artifact_id)
        return [
            ResponseAction(
                playbook_id="PB-ART-008",
                action_type="artifact_quarantine",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={
                    "artifact_ids": artifact_ids,
                    "failure_count": alert.payload.get("failure_count"),
                },
            )
        ]

    def _privileged_change_control(self, alert: Alert) -> list[ResponseAction]:
        self.store.restrict_policy_changes(alert.actor_id)
        self.store.require_step_up(alert.actor_id)
        return [
            ResponseAction(
                playbook_id="PB-POL-009",
                action_type="policy_change_restricted",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={
                    "policy_id": alert.payload.get("policy_id"),
                    "actor_risk_context": alert.payload.get("actor_risk_context"),
                },
            )
        ]

    def _multi_signal_incident_containment(self, alert: Alert) -> list[ResponseAction]:
        # Apply strongest reversible containment: step-up + download restriction
        self.store.require_step_up(alert.actor_id)
        self.store.restrict_downloads(alert.actor_id)
        return [
            ResponseAction(
                playbook_id="PB-CORR-010",
                action_type="multi_signal_containment",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={
                    "detection_ids": alert.payload.get("detection_ids"),
                    "containment_actions": ["step_up_authentication", "download_restriction"],
                },
            )
        ]
