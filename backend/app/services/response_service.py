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
        }

        handler = handlers.get(alert.rule_id)
        if handler is None:
            return []

        responses = handler(alert)
        self.store.responses.extend(responses)
        return responses

    def _auth_failure_containment(self, alert: Alert) -> list[ResponseAction]:
        self.store.rate_limited_actors.add(alert.actor_id)
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
        self.store.step_up_required.add(alert.actor_id)
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
        session_id = str(alert.payload.get("session_id", ""))
        if session_id:
            self.store.revoked_sessions.add(session_id)
        return [
            ResponseAction(
                playbook_id="PB-SESSION-003",
                action_type="session_revocation",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={"session_id": session_id, "source_ip_list": alert.payload.get("source_ip_list", [])},
            )
        ]

    def _restricted_access_enforcement(self, alert: Alert) -> list[ResponseAction]:
        return [
            ResponseAction(
                playbook_id="PB-DOC-004",
                action_type="deny_access",
                actor_id=alert.actor_id,
                correlation_id=alert.correlation_id,
                reason=alert.summary,
                related_alert_id=alert.alert_id,
                payload={"document_id": alert.payload.get("document_id")},
            )
        ]

    def _bulk_access_constraint(self, alert: Alert) -> list[ResponseAction]:
        self.store.download_restricted_actors.add(alert.actor_id)
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
