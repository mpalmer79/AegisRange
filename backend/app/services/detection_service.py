from __future__ import annotations

from datetime import timedelta

from app.models import Alert, Confidence, Event, Severity
from app.services.event_services import TelemetryService


class DetectionService:
    """Deterministic detection rules aligned to detection docs."""

    def __init__(self, telemetry: TelemetryService) -> None:
        self.telemetry = telemetry

    def evaluate(self, event: Event) -> list[Alert]:
        alerts: list[Alert] = []

        for detector in (
            self._detect_auth_failure_burst,
            self._detect_suspicious_success_after_failures,
            self._detect_token_reuse_conflicting_origin,
            self._detect_restricted_document_access,
            self._detect_abnormal_bulk_reads,
            self._detect_read_to_download_staging,
        ):
            match = detector(event)
            if match:
                alerts.append(match)

        return alerts

    def _detect_auth_failure_burst(self, event: Event) -> Alert | None:
        if event.event_type != "authentication.login.failure":
            return None

        failures_actor = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"authentication.login.failure"},
            since_minutes=2,
        )
        failures_source = self.telemetry.lookup_events(
            source_ip=event.source_ip,
            event_types={"authentication.login.failure"},
            since_minutes=2,
        )

        # DET-AUTH-001 allows same actor OR same source context.
        actor_scope = len(failures_actor) >= len(failures_source)
        candidate_failures = failures_actor if actor_scope else failures_source
        if len(candidate_failures) < 5:
            return None

        return Alert(
            rule_id="DET-AUTH-001",
            rule_name="Repeated Authentication Failure Burst",
            severity=Severity.MEDIUM,
            confidence=Confidence.MEDIUM,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[failure.event_id for failure in candidate_failures],
            summary=f"Detected {len(candidate_failures)} authentication failures in 2 minutes.",
            payload={"failure_count": len(candidate_failures), "source_ip": event.source_ip, "scope": "actor" if actor_scope else "source_ip"},
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

        if event.source_ip != latest_failure.source_ip:
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

    def _detect_token_reuse_conflicting_origin(self, event: Event) -> Alert | None:
        if event.event_type != "authorization.check.success" or not event.session_id:
            return None

        authz_events = self.telemetry.lookup_events(
            session_id=event.session_id,
            event_types={"authorization.check.success"},
            since_minutes=5,
        )
        unique_ips = sorted({item.source_ip for item in authz_events})
        if len(unique_ips) < 2:
            return None

        return Alert(
            rule_id="DET-SESSION-003",
            rule_name="Token Reuse From Conflicting Origins",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[item.event_id for item in authz_events],
            summary="Session token reused from multiple source IPs in 5 minutes.",
            payload={"session_id": event.session_id, "source_ip_list": unique_ips},
        )

    def _detect_restricted_document_access(self, event: Event) -> Alert | None:
        if event.event_type != "document.read.failure":
            return None
        if event.error_message != "classification_mismatch":
            return None

        return Alert(
            rule_id="DET-DOC-004",
            rule_name="Restricted Document Access Outside Role Scope",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[event.event_id],
            summary="Document access attempted beyond role classification scope.",
            payload={
                "document_id": event.payload.get("document_id"),
                "classification": event.payload.get("classification"),
                "actor_role": event.actor_role,
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

    def _detect_read_to_download_staging(self, event: Event) -> Alert | None:
        if event.event_type != "document.download.success":
            return None

        reads = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"document.read.success"},
            since_minutes=5,
        )
        downloads = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"document.download.success"},
            since_minutes=5,
        )

        read_docs = {item.payload.get("document_id") for item in reads}
        download_docs = {item.payload.get("document_id") for item in downloads}
        overlap_docs = sorted(doc for doc in read_docs.intersection(download_docs) if doc)

        if len(overlap_docs) < 3:
            return None

        contributing_ids = [item.event_id for item in reads if item.payload.get("document_id") in overlap_docs]
        contributing_ids.extend([item.event_id for item in downloads if item.payload.get("document_id") in overlap_docs])

        return Alert(
            rule_id="DET-DOC-006",
            rule_name="Read-To-Download Exfiltration Pattern",
            severity=Severity.CRITICAL,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=contributing_ids,
            summary="Detected staged read-to-download behavior for overlapping sensitive documents.",
            payload={
                "overlap_documents": overlap_docs,
                "overlap_count": len(overlap_docs),
                "session_id": event.session_id,
            },
        )
