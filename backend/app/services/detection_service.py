from __future__ import annotations

from datetime import timedelta

from app.models import Alert, Confidence, Event, Severity
from app.services.event_services import TelemetryService


class DetectionService:
    """Deterministic rules for Phase 1."""

    def __init__(self, telemetry: TelemetryService) -> None:
        self.telemetry = telemetry

    def evaluate(self, event: Event) -> list[Alert]:
        alerts: list[Alert] = []

        auth_burst = self._detect_auth_failure_burst(event)
        if auth_burst:
            alerts.append(auth_burst)

        suspicious_success = self._detect_suspicious_success_after_failures(event)
        if suspicious_success:
            alerts.append(suspicious_success)

        abnormal_reads = self._detect_abnormal_bulk_reads(event)
        if abnormal_reads:
            alerts.append(abnormal_reads)

        return alerts

    def _detect_auth_failure_burst(self, event: Event) -> Alert | None:
        if event.event_type != "authentication.login.failure":
            return None

        failures = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"authentication.login.failure"},
            since_minutes=2,
        )
        if len(failures) < 5:
            return None

        return Alert(
            rule_id="DET-AUTH-001",
            rule_name="Repeated Authentication Failure Burst",
            severity=Severity.MEDIUM,
            confidence=Confidence.MEDIUM,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[failure.event_id for failure in failures],
            summary=f"Detected {len(failures)} authentication failures in 2 minutes.",
            payload={"failure_count": len(failures), "source_ip": event.source_ip},
        )

    def _detect_suspicious_success_after_failures(self, event: Event) -> Alert | None:
        if event.event_type != "authentication.login.success":
            return None

        failures = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"authentication.login.failure"},
            since_minutes=5,
        )
        if len(failures) < 3:
            return None

        latest_failure = failures[-1]
        if event.timestamp < latest_failure.timestamp:
            return None

        time_delta = event.timestamp - latest_failure.timestamp
        if time_delta > timedelta(minutes=5):
            return None

        return Alert(
            rule_id="DET-AUTH-002",
            rule_name="Suspicious Success After Failure Sequence",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[*map(lambda failure: failure.event_id, failures), event.event_id],
            summary="Successful authentication followed repeated failures within 5 minutes.",
            payload={
                "failure_count": len(failures),
                "success_event_id": event.event_id,
                "time_delta_seconds": int(time_delta.total_seconds()),
            },
        )

    def _detect_abnormal_bulk_reads(self, event: Event) -> Alert | None:
        if event.event_type != "document.read.success":
            return None

        reads = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"document.read.success"},
            since_minutes=5,
        )
        if len(reads) < 20:
            return None

        return Alert(
            rule_id="DET-DOC-005",
            rule_name="Abnormal Bulk Document Access",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[read.event_id for read in reads],
            summary=f"Detected {len(reads)} document reads in 5 minutes.",
            payload={"document_count": len(reads)},
        )
