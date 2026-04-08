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

        session_reuse = self._detect_token_reuse_conflicting_origins(event)
        if session_reuse:
            alerts.append(session_reuse)

        restricted_access = self._detect_restricted_document_access(event)
        if restricted_access:
            alerts.append(restricted_access)

        abnormal_reads = self._detect_abnormal_bulk_reads(event)
        if abnormal_reads:
            alerts.append(abnormal_reads)

        read_to_download = self._detect_read_to_download_staging(event)
        if read_to_download:
            alerts.append(read_to_download)

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

    def _detect_token_reuse_conflicting_origins(self, event: Event) -> Alert | None:
        if event.event_type not in ("authorization.check.success", "authorization.check.failure"):
            return None
        if not event.session_id:
            return None

        session_events = self.telemetry.lookup_events(
            event_types={"session.token.issued", "authorization.check.success", "authorization.check.failure"},
            since_minutes=5,
        )
        same_session = [e for e in session_events if e.session_id == event.session_id]
        source_ips = {e.source_ip for e in same_session if e.source_ip}

        if len(source_ips) < 2:
            return None

        return Alert(
            rule_id="DET-SESSION-003",
            rule_name="Token Reuse From Conflicting Origins",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[e.event_id for e in same_session],
            summary=f"Session {event.session_id} used from {len(source_ips)} different IPs within 5 minutes.",
            payload={
                "session_id": event.session_id,
                "source_ip_list": sorted(source_ips),
            },
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
            summary=f"Access attempt to document {event.target_id} denied due to classification mismatch.",
            payload={
                "document_id": event.target_id,
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
            since_minutes=10,
        )
        downloads = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"document.download.success"},
            since_minutes=10,
        )

        read_docs = {e.target_id for e in reads if e.target_id}
        download_docs = {e.target_id for e in downloads if e.target_id}
        overlap = read_docs & download_docs

        if len(reads) < 2 or len(downloads) < 2 or len(overlap) < 2:
            return None

        all_events = reads + downloads
        return Alert(
            rule_id="DET-DOC-006",
            rule_name="Read-To-Download Staging Pattern",
            severity=Severity.CRITICAL,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[e.event_id for e in all_events],
            summary=f"Detected read-to-download staging: {len(overlap)} overlapping documents.",
            payload={
                "read_count": len(reads),
                "download_count": len(downloads),
                "overlapping_documents": sorted(overlap),
            },
        )
