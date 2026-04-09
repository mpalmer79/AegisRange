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

        service_route = self._detect_unauthorized_service_route_access(event)
        if service_route:
            alerts.append(service_route)

        artifact_failure = self._detect_artifact_validation_failure_pattern(event)
        if artifact_failure:
            alerts.append(artifact_failure)

        policy_change = self._detect_privileged_policy_change(event)
        if policy_change:
            alerts.append(policy_change)

        multi_signal = self._detect_multi_signal_compromise(event)
        if multi_signal:
            alerts.append(multi_signal)

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
            contributing_event_ids=[
                *map(lambda failure: failure.event_id, failures),
                event.event_id,
            ],
            summary="Successful authentication followed repeated failures within 5 minutes.",
            payload={
                "failure_count": len(failures),
                "success_event_id": event.event_id,
                "time_delta_seconds": int(time_delta.total_seconds()),
            },
        )

    def _detect_token_reuse_conflicting_origins(self, event: Event) -> Alert | None:
        if event.event_type not in (
            "authorization.check.success",
            "authorization.check.failure",
        ):
            return None
        if not event.session_id:
            return None

        session_events = self.telemetry.lookup_events(
            event_types={
                "session.token.issued",
                "authorization.check.success",
                "authorization.check.failure",
            },
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

    def _detect_unauthorized_service_route_access(self, event: Event) -> Alert | None:
        if event.event_type != "authorization.failure":
            return None
        if event.actor_type != "service":
            return None

        failures = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"authorization.failure"},
            since_minutes=2,
        )
        if len(failures) < 3:
            return None

        route_list = sorted({e.target_id for e in failures if e.target_id})
        return Alert(
            rule_id="DET-SVC-007",
            rule_name="Unauthorized Service Identity Route Access",
            severity=Severity.HIGH,
            confidence=Confidence.MEDIUM,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[e.event_id for e in failures],
            summary=f"Service {event.actor_id} made {len(failures)} unauthorized route attempts in 2 minutes.",
            payload={
                "service_id": event.actor_id,
                "route_list": route_list,
                "failure_count": len(failures),
            },
        )

    def _detect_artifact_validation_failure_pattern(self, event: Event) -> Alert | None:
        if event.event_type != "artifact.validation.failed":
            return None

        failures = self.telemetry.lookup_events(
            actor_id=event.actor_id,
            event_types={"artifact.validation.failed"},
            since_minutes=10,
        )
        if len(failures) < 3:
            return None

        artifact_ids = sorted({e.target_id for e in failures if e.target_id})
        return Alert(
            rule_id="DET-ART-008",
            rule_name="Artifact Validation Failure Pattern",
            severity=Severity.MEDIUM,
            confidence=Confidence.MEDIUM,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[e.event_id for e in failures],
            summary=f"Detected {len(failures)} artifact validation failures in 10 minutes.",
            payload={
                "artifact_ids": artifact_ids,
                "failure_count": len(failures),
            },
        )

    def _detect_privileged_policy_change(self, event: Event) -> Alert | None:
        if event.event_type != "policy.change.executed":
            return None

        store = self.telemetry.store
        has_elevated_risk = (
            event.actor_id in store.step_up_required
            or event.actor_id in store.download_restricted_actors
        )
        if not has_elevated_risk:
            return None

        risk_contexts = []
        if event.actor_id in store.step_up_required:
            risk_contexts.append("step_up_required")
        if event.actor_id in store.download_restricted_actors:
            risk_contexts.append("download_restricted")
        actor_risk_context = ", ".join(risk_contexts)

        return Alert(
            rule_id="DET-POL-009",
            rule_name="Privileged Policy Change With Elevated Risk Context",
            severity=Severity.CRITICAL,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[event.event_id],
            summary=f"Policy change by {event.actor_id} while under elevated risk ({actor_risk_context}).",
            payload={
                "policy_id": event.target_id,
                "actor_risk_context": actor_risk_context,
            },
        )

    def _detect_multi_signal_compromise(self, event: Event) -> Alert | None:
        if event.event_type != "detection.rule.triggered":
            return None

        detection_events = self.telemetry.lookup_events(
            event_types={"detection.rule.triggered"},
            since_minutes=15,
        )
        # Filter by same actor_id or same correlation_id
        related = [
            e
            for e in detection_events
            if e.correlation_id == event.correlation_id
            or e.payload.get("matched_conditions", {}).get("source_ip")
            == event.payload.get("matched_conditions", {}).get("source_ip")
        ]
        # Also include events for the same actor from the payload
        actor_related = [e for e in detection_events if e.actor_id == event.actor_id]
        # Merge and deduplicate
        seen_ids = set()
        merged: list[Event] = []
        for e in related + actor_related:
            if e.event_id not in seen_ids:
                seen_ids.add(e.event_id)
                merged.append(e)

        # Count distinct rule_ids
        distinct_rules = {
            e.payload.get("rule_id") for e in merged if e.payload.get("rule_id")
        }

        if len(distinct_rules) < 3:
            return None

        return Alert(
            rule_id="DET-CORR-010",
            rule_name="Multi-Signal Compromise Sequence",
            severity=Severity.CRITICAL,
            confidence=Confidence.HIGH,
            actor_id=event.actor_id,
            correlation_id=event.correlation_id,
            contributing_event_ids=[e.event_id for e in merged],
            summary=f"Correlated {len(distinct_rules)} distinct detections within 15 minutes.",
            payload={
                "detection_ids": sorted(distinct_rules),
                "actor_id": event.actor_id,
                "timeline_summary": f"{len(merged)} detection events across {len(distinct_rules)} rules",
            },
        )
