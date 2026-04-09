from __future__ import annotations

from typing import TYPE_CHECKING

from app.models import Alert, Confidence, Event, ResponseAction, Severity
from app.services.detection_service import DetectionService
from app.services.event_services import TelemetryService
from app.services.incident_service import IncidentService
from app.services.response_service import ResponseOrchestrator
from app.store import InMemoryStore

if TYPE_CHECKING:
    from app.services.risk_service import RiskScoringService


class EventPipelineService:
    """Phase 2 orchestration: every emitted event can produce detections/responses/incidents."""

    def __init__(
        self,
        *,
        telemetry: TelemetryService,
        detection: DetectionService,
        response: ResponseOrchestrator,
        incidents: IncidentService,
        store: InMemoryStore,
        risk: RiskScoringService | None = None,
    ) -> None:
        self.telemetry = telemetry
        self.detection = detection
        self.response = response
        self.incidents = incidents
        self.store = store
        self.risk = risk

    def process(self, event: Event) -> dict[str, int]:
        """Ingest an event through the full pipeline.

        All persistence writes within a single ``process()`` call are
        grouped in a SQLite transaction so that a crash cannot leave
        partial entity state on disk.
        """
        with self.store.transaction():
            return self._process_inner(event)

    def _process_inner(self, event: Event) -> dict[str, int]:
        self.telemetry.emit(event)
        self.incidents.register_event(event)

        alerts = self.detection.evaluate(event)
        if not alerts:
            return {"alerts": 0, "responses": 0}

        novel_alerts: list[Alert] = []
        for alert in alerts:
            signature = (alert.rule_id, alert.actor_id, alert.correlation_id)
            if self.store.add_alert_signature(signature):
                novel_alerts.append(alert)

        self.store.extend_alerts(novel_alerts)
        total_responses = 0
        for alert in novel_alerts:
            self._emit_detection_event(alert, source_event=event)
            incident = self.incidents.register_alert(alert, source_event=event)
            if self.risk is not None:
                self.risk.update_risk(alert)
            responses = self.response.execute(alert)
            total_responses += len(responses)
            for response_action in responses:
                self._emit_response_event(response_action, source_event=event)
                self.incidents.register_response(incident, response_action)

        return {"alerts": len(novel_alerts), "responses": total_responses}

    def _emit_detection_event(self, alert: Alert, source_event: Event) -> None:
        detection_event = Event(
            event_type="detection.rule.triggered",
            category="detection",
            actor_id=source_event.actor_id,
            actor_type="system",
            actor_role="detection-engine",
            target_type="alert",
            target_id=alert.alert_id,
            request_id=source_event.request_id,
            correlation_id=source_event.correlation_id,
            session_id=source_event.session_id,
            source_ip=source_event.source_ip,
            user_agent="aegisrange-detection-engine",
            origin="internal",
            status="success",
            severity=alert.severity,
            confidence=alert.confidence,
            payload={
                "rule_id": alert.rule_id,
                "rule_name": alert.rule_name,
                "matched_conditions": alert.payload,
                "contributing_event_ids": alert.contributing_event_ids,
            },
        )
        self.telemetry.emit(detection_event)

    def _emit_response_event(self, response_action: ResponseAction, source_event: Event) -> None:
        response_event = Event(
            event_type=f"response.{response_action.action_type}.executed",
            category="response",
            actor_id=source_event.actor_id,
            actor_type="system",
            actor_role="response-orchestrator",
            target_type="response",
            target_id=response_action.response_id,
            request_id=source_event.request_id,
            correlation_id=source_event.correlation_id,
            session_id=source_event.session_id,
            source_ip=source_event.source_ip,
            user_agent="aegisrange-response-orchestrator",
            origin="internal",
            status="success",
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
            payload={
                "playbook_id": response_action.playbook_id,
                "action_type": response_action.action_type,
                "reason": response_action.reason,
                "related_alert_id": response_action.related_alert_id,
            },
        )
        self.telemetry.emit(response_event)
