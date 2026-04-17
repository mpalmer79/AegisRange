"""1E.1: Unit tests for each detection rule individually."""

from __future__ import annotations

import unittest
from uuid import uuid4

from app.models import Confidence, Event, Severity
from app.services.detection_service import DetectionService
from app.services.event_services import TelemetryService
from app.store import InMemoryStore


def _make_event(
    *,
    event_type: str = "authentication.login.failure",
    category: str = "authentication",
    actor_id: str = "user-alice",
    actor_role: str = "analyst",
    correlation_id: str | None = None,
    target_id: str | None = None,
    target_type: str = "identity",
    session_id: str | None = None,
    source_ip: str = "203.0.113.10",
    status: str = "failure",
    status_code: str = "401",
    error_message: str | None = None,
    payload: dict | None = None,
) -> Event:
    return Event(
        event_type=event_type,
        category=category,
        actor_id=actor_id,
        actor_type="user",
        actor_role=actor_role,
        target_type=target_type,
        target_id=target_id,
        request_id=f"req-{uuid4()}",
        correlation_id=correlation_id or f"corr-{uuid4()}",
        session_id=session_id,
        source_ip=source_ip,
        user_agent="test-client",
        origin="api",
        status=status,
        status_code=status_code,
        error_message=error_message,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload=payload or {},
    )


class TestDETAUTH001(unittest.TestCase):
    """DET-AUTH-001: Repeated Authentication Failure Burst (>=5 in 2 min)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_at_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(5):
            event = _make_event(correlation_id=corr)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-001"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.MEDIUM)
        self.assertEqual(matched[0].confidence, Confidence.MEDIUM)

    def test_no_trigger_below_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(4):
            event = _make_event(correlation_id=corr)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-001"]
        self.assertEqual(len(matched), 0)

    def test_ignores_success_events(self) -> None:
        event = _make_event(
            event_type="authentication.login.success",
            status="success",
            status_code="200",
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-001"]
        self.assertEqual(len(matched), 0)

    def test_different_actors_isolated(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(3):
            self.telemetry.emit(_make_event(actor_id="user-alice", correlation_id=corr))
        for _ in range(3):
            event = _make_event(actor_id="user-bob", correlation_id=corr)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-001"]
        self.assertEqual(len(matched), 0)


class TestDETAUTH002(unittest.TestCase):
    """DET-AUTH-002: Suspicious Success After Failure Sequence."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_on_success_after_failures(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(3):
            self.telemetry.emit(_make_event(correlation_id=corr))
        success = _make_event(
            event_type="authentication.login.success",
            status="success",
            status_code="200",
            correlation_id=corr,
        )
        self.telemetry.emit(success)
        alerts = self.detection.evaluate(success)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-002"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.HIGH)
        self.assertEqual(matched[0].confidence, Confidence.HIGH)

    def test_no_trigger_with_insufficient_failures(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(2):
            self.telemetry.emit(_make_event(correlation_id=corr))
        success = _make_event(
            event_type="authentication.login.success",
            status="success",
            status_code="200",
            correlation_id=corr,
        )
        self.telemetry.emit(success)
        alerts = self.detection.evaluate(success)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-002"]
        self.assertEqual(len(matched), 0)

    def test_no_trigger_on_failure_event(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(5):
            event = _make_event(correlation_id=corr)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-AUTH-002"]
        self.assertEqual(len(matched), 0)


class TestDETSESSION003(unittest.TestCase):
    """DET-SESSION-003: Token Reuse From Conflicting Origins."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_on_conflicting_ips(self) -> None:
        corr = f"corr-{uuid4()}"
        session_id = f"session-{uuid4()}"
        token_event = _make_event(
            event_type="session.token.issued",
            category="session",
            actor_id="user-bob",
            session_id=session_id,
            source_ip="198.51.100.10",
            status="success",
            status_code="200",
            correlation_id=corr,
        )
        self.telemetry.emit(token_event)

        auth_check_1 = _make_event(
            event_type="authorization.check.success",
            category="session",
            actor_id="user-bob",
            session_id=session_id,
            source_ip="198.51.100.10",
            status="success",
            status_code="200",
            correlation_id=corr,
        )
        self.telemetry.emit(auth_check_1)

        auth_check_2 = _make_event(
            event_type="authorization.check.success",
            category="session",
            actor_id="user-bob",
            session_id=session_id,
            source_ip="203.0.113.55",
            status="success",
            status_code="200",
            correlation_id=corr,
        )
        self.telemetry.emit(auth_check_2)

        alerts = self.detection.evaluate(auth_check_2)
        matched = [a for a in alerts if a.rule_id == "DET-SESSION-003"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.HIGH)
        self.assertIn("198.51.100.10", matched[0].payload["source_ip_list"])
        self.assertIn("203.0.113.55", matched[0].payload["source_ip_list"])

    def test_no_trigger_single_ip(self) -> None:
        corr = f"corr-{uuid4()}"
        session_id = f"session-{uuid4()}"
        for _ in range(3):
            event = _make_event(
                event_type="authorization.check.success",
                category="session",
                actor_id="user-bob",
                session_id=session_id,
                source_ip="198.51.100.10",
                status="success",
                status_code="200",
                correlation_id=corr,
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SESSION-003"]
        self.assertEqual(len(matched), 0)

    def test_no_trigger_without_session_id(self) -> None:
        event = _make_event(
            event_type="authorization.check.success",
            category="session",
            actor_id="user-bob",
            session_id=None,
            status="success",
            status_code="200",
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SESSION-003"]
        self.assertEqual(len(matched), 0)


class TestDETDOC004(unittest.TestCase):
    """DET-DOC-004: Restricted Document Access Outside Role Scope."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_on_classification_mismatch(self) -> None:
        event = _make_event(
            event_type="document.read.failure",
            category="document",
            target_type="document",
            target_id="doc-003",
            status="failure",
            status_code="403",
            error_message="classification_mismatch",
            payload={"document_id": "doc-003", "classification": "restricted"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-004"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.HIGH)

    def test_no_trigger_on_success(self) -> None:
        event = _make_event(
            event_type="document.read.success",
            category="document",
            target_type="document",
            target_id="doc-001",
            status="success",
            status_code="200",
            payload={"document_id": "doc-001", "classification": "public"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-004"]
        self.assertEqual(len(matched), 0)

    def test_no_trigger_on_non_classification_failure(self) -> None:
        event = _make_event(
            event_type="document.read.failure",
            category="document",
            target_type="document",
            target_id="doc-003",
            status="failure",
            status_code="404",
            error_message="not_found",
            payload={"document_id": "doc-003"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-004"]
        self.assertEqual(len(matched), 0)


class TestDETDOC005(unittest.TestCase):
    """DET-DOC-005: Abnormal Bulk Document Access (>=20 in 5 min)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_at_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for i in range(20):
            event = _make_event(
                event_type="document.read.success",
                category="document",
                target_type="document",
                target_id=f"doc-{i:03d}",
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": f"doc-{i:03d}", "classification": "internal"},
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-005"]
        self.assertEqual(len(matched), 1)

    def test_no_trigger_below_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for i in range(19):
            event = _make_event(
                event_type="document.read.success",
                category="document",
                target_type="document",
                target_id=f"doc-{i:03d}",
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": f"doc-{i:03d}", "classification": "internal"},
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-005"]
        self.assertEqual(len(matched), 0)


class TestDETDOC006(unittest.TestCase):
    """DET-DOC-006: Read-To-Download Staging Pattern."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_on_read_then_download_overlap(self) -> None:
        corr = f"corr-{uuid4()}"
        doc_ids = ["doc-001", "doc-002", "doc-003"]

        for doc_id in doc_ids:
            self.telemetry.emit(
                _make_event(
                    event_type="document.read.success",
                    category="document",
                    target_type="document",
                    target_id=doc_id,
                    status="success",
                    status_code="200",
                    correlation_id=corr,
                    payload={"document_id": doc_id, "classification": "internal"},
                )
            )

        for doc_id in doc_ids:
            event = _make_event(
                event_type="document.download.success",
                category="document",
                target_type="document",
                target_id=doc_id,
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": doc_id, "classification": "internal"},
            )
            self.telemetry.emit(event)

        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-006"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.CRITICAL)
        self.assertGreaterEqual(len(matched[0].payload["overlapping_documents"]), 2)

    def test_no_trigger_reads_only(self) -> None:
        corr = f"corr-{uuid4()}"
        for doc_id in ["doc-001", "doc-002", "doc-003"]:
            event = _make_event(
                event_type="document.read.success",
                category="document",
                target_type="document",
                target_id=doc_id,
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": doc_id, "classification": "internal"},
            )
            self.telemetry.emit(event)
        # Evaluate a read event — should not trigger DET-DOC-006
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-006"]
        self.assertEqual(len(matched), 0)

    def test_no_trigger_downloads_only(self) -> None:
        corr = f"corr-{uuid4()}"
        for doc_id in ["doc-001", "doc-002", "doc-003"]:
            event = _make_event(
                event_type="document.download.success",
                category="document",
                target_type="document",
                target_id=doc_id,
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": doc_id, "classification": "internal"},
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-006"]
        self.assertEqual(len(matched), 0)

    def test_no_trigger_insufficient_overlap(self) -> None:
        corr = f"corr-{uuid4()}"
        self.telemetry.emit(
            _make_event(
                event_type="document.read.success",
                category="document",
                target_type="document",
                target_id="doc-001",
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": "doc-001", "classification": "internal"},
            )
        )
        event = _make_event(
            event_type="document.download.success",
            category="document",
            target_type="document",
            target_id="doc-001",
            status="success",
            status_code="200",
            correlation_id=corr,
            payload={"document_id": "doc-001", "classification": "internal"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-DOC-006"]
        self.assertEqual(len(matched), 0)


# ---------------------------------------------------------------------------
# DET-SVC-007, DET-ART-008, DET-POL-009 detection rules
# ---------------------------------------------------------------------------


def _make_service_event(
    *,
    event_type: str = "authorization.failure",
    category: str = "system",
    actor_id: str = "svc-data-processor",
    actor_type: str = "service",
    actor_role: str = "service",
    correlation_id: str | None = None,
    target_id: str | None = None,
    target_type: str = "route",
    session_id: str | None = None,
    source_ip: str = "10.0.1.50",
    status: str = "failure",
    status_code: str = "403",
    error_message: str | None = None,
    payload: dict | None = None,
) -> Event:
    return Event(
        event_type=event_type,
        category=category,
        actor_id=actor_id,
        actor_type=actor_type,
        actor_role=actor_role,
        target_type=target_type,
        target_id=target_id,
        request_id=f"req-{uuid4()}",
        correlation_id=correlation_id or f"corr-{uuid4()}",
        session_id=session_id,
        source_ip=source_ip,
        user_agent="test-client",
        origin="api",
        status=status,
        status_code=status_code,
        error_message=error_message,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload=payload or {},
    )


class TestDETSVC007(unittest.TestCase):
    """DET-SVC-007: Unauthorized Service Identity Route Access (>=3 in 2 min)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_at_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        routes = ["/admin/config", "/admin/secrets", "/admin/users"]
        for route in routes:
            event = _make_service_event(
                correlation_id=corr,
                target_id=route,
                payload={"route": route, "service_id": "svc-data-processor"},
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SVC-007"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.HIGH)
        self.assertEqual(matched[0].confidence, Confidence.MEDIUM)
        self.assertIn("svc-data-processor", matched[0].payload["service_id"])

    def test_no_trigger_below_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for route in ["/admin/config", "/admin/secrets"]:
            event = _make_service_event(correlation_id=corr, target_id=route)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SVC-007"]
        self.assertEqual(len(matched), 0)

    def test_ignores_user_actor_type(self) -> None:
        corr = f"corr-{uuid4()}"
        for route in ["/admin/config", "/admin/secrets", "/admin/users"]:
            event = _make_service_event(
                correlation_id=corr,
                target_id=route,
                actor_type="user",
                actor_id="user-alice",
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SVC-007"]
        self.assertEqual(len(matched), 0)

    def test_ignores_non_authorization_failure(self) -> None:
        event = _make_service_event(
            event_type="authentication.login.failure", category="authentication"
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SVC-007"]
        self.assertEqual(len(matched), 0)

    def test_route_list_in_payload(self) -> None:
        corr = f"corr-{uuid4()}"
        routes = ["/admin/config", "/admin/secrets", "/admin/users"]
        for route in routes:
            event = _make_service_event(correlation_id=corr, target_id=route)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SVC-007"]
        self.assertEqual(sorted(matched[0].payload["route_list"]), sorted(routes))


class TestDETART008(unittest.TestCase):
    """DET-ART-008: Artifact Validation Failure Pattern (>=3 in 10 min)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_at_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for i in range(3):
            event = _make_service_event(
                event_type="artifact.validation.failed",
                actor_id="svc-artifact-supplier",
                target_id=f"artifact-{i:03d}",
                correlation_id=corr,
                payload={"artifact_id": f"artifact-{i:03d}"},
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-ART-008"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.MEDIUM)
        self.assertEqual(matched[0].confidence, Confidence.MEDIUM)

    def test_no_trigger_below_threshold(self) -> None:
        corr = f"corr-{uuid4()}"
        for i in range(2):
            event = _make_service_event(
                event_type="artifact.validation.failed",
                actor_id="svc-artifact-supplier",
                target_id=f"artifact-{i:03d}",
                correlation_id=corr,
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-ART-008"]
        self.assertEqual(len(matched), 0)

    def test_artifact_ids_in_payload(self) -> None:
        corr = f"corr-{uuid4()}"
        for i in range(3):
            event = _make_service_event(
                event_type="artifact.validation.failed",
                actor_id="svc-artifact-supplier",
                target_id=f"artifact-{i:03d}",
                correlation_id=corr,
            )
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-ART-008"]
        self.assertEqual(len(matched[0].payload["artifact_ids"]), 3)

    def test_ignores_other_event_types(self) -> None:
        event = _make_service_event(
            event_type="artifact.validation.success",
            status="success",
            status_code="200",
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-ART-008"]
        self.assertEqual(len(matched), 0)


class TestDETPOL009(unittest.TestCase):
    """DET-POL-009: Privileged Policy Change With Elevated Risk Context."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_triggers_with_step_up_required(self) -> None:
        self.store.step_up_required.add("user-alice")
        event = _make_service_event(
            event_type="policy.change.executed",
            category="system",
            actor_id="user-alice",
            actor_type="user",
            actor_role="admin",
            target_id="policy-firewall-001",
            status="success",
            status_code="200",
            payload={"policy_id": "policy-firewall-001", "change_type": "update"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-POL-009"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].severity, Severity.CRITICAL)
        self.assertEqual(matched[0].confidence, Confidence.HIGH)
        self.assertIn("step_up_required", matched[0].payload["actor_risk_context"])

    def test_triggers_with_download_restricted(self) -> None:
        self.store.download_restricted_actors.add("user-bob")
        event = _make_service_event(
            event_type="policy.change.executed",
            category="system",
            actor_id="user-bob",
            actor_type="user",
            actor_role="admin",
            target_id="policy-access-002",
            status="success",
            status_code="200",
            payload={"policy_id": "policy-access-002"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-POL-009"]
        self.assertEqual(len(matched), 1)
        self.assertIn("download_restricted", matched[0].payload["actor_risk_context"])

    def test_no_trigger_without_elevated_risk(self) -> None:
        event = _make_service_event(
            event_type="policy.change.executed",
            category="system",
            actor_id="user-bob",
            actor_type="user",
            actor_role="admin",
            target_id="policy-access-002",
            status="success",
            status_code="200",
            payload={"policy_id": "policy-access-002"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-POL-009"]
        self.assertEqual(len(matched), 0)

    def test_no_trigger_on_other_event_types(self) -> None:
        self.store.step_up_required.add("user-alice")
        event = _make_service_event(
            event_type="authentication.login.success",
            category="authentication",
            actor_id="user-alice",
            actor_type="user",
            status="success",
            status_code="200",
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-POL-009"]
        self.assertEqual(len(matched), 0)

    def test_both_risk_contexts(self) -> None:
        self.store.step_up_required.add("user-alice")
        self.store.download_restricted_actors.add("user-alice")
        event = _make_service_event(
            event_type="policy.change.executed",
            category="system",
            actor_id="user-alice",
            actor_type="user",
            actor_role="admin",
            target_id="policy-001",
            status="success",
            status_code="200",
            payload={"policy_id": "policy-001"},
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-POL-009"]
        self.assertEqual(len(matched), 1)
        self.assertIn("step_up_required", matched[0].payload["actor_risk_context"])
        self.assertIn("download_restricted", matched[0].payload["actor_risk_context"])


# ---------------------------------------------------------------------------
# 0.10.0 rule additions
# ---------------------------------------------------------------------------


class TestDETGEO011(unittest.TestCase):
    """DET-GEO-011: Impossible Travel Between Authentications (2+ regions / 60 min)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def _login_success(
        self,
        *,
        region: str | None,
        correlation_id: str,
        actor_id: str = "user-alice",
    ) -> Event:
        payload: dict = {"username": actor_id}
        if region is not None:
            payload["geo_region"] = region
        return _make_event(
            event_type="authentication.login.success",
            category="authentication",
            actor_id=actor_id,
            correlation_id=correlation_id,
            target_id=actor_id,
            status="success",
            status_code="200",
            payload=payload,
        )

    def test_two_regions_fires_alert(self) -> None:
        corr = f"corr-{uuid4()}"
        self.telemetry.emit(
            self._login_success(region="us-east-1", correlation_id=corr)
        )
        event = self._login_success(region="ap-south-1", correlation_id=corr)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-GEO-011"]
        self.assertEqual(len(matched), 1)
        self.assertIn("us-east-1", matched[0].payload["regions_observed"])
        self.assertIn("ap-south-1", matched[0].payload["regions_observed"])

    def test_same_region_does_not_fire(self) -> None:
        corr = f"corr-{uuid4()}"
        self.telemetry.emit(
            self._login_success(region="us-east-1", correlation_id=corr)
        )
        event = self._login_success(region="us-east-1", correlation_id=corr)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-GEO-011"]
        self.assertEqual(len(matched), 0)

    def test_missing_region_does_not_fire(self) -> None:
        corr = f"corr-{uuid4()}"
        self.telemetry.emit(self._login_success(region=None, correlation_id=corr))
        event = self._login_success(region=None, correlation_id=corr)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-GEO-011"]
        self.assertEqual(len(matched), 0)

    def test_failure_events_ignored(self) -> None:
        """Failed logins should not participate in impossible-travel logic."""
        corr = f"corr-{uuid4()}"
        # The failure event type is not "authentication.login.success"; the
        # rule filters on event_type first, so it should never fire.
        failure = _make_event(
            event_type="authentication.login.failure",
            correlation_id=corr,
            payload={"geo_region": "ap-south-1"},
        )
        self.telemetry.emit(failure)
        alerts = self.detection.evaluate(failure)
        matched = [a for a in alerts if a.rule_id == "DET-GEO-011"]
        self.assertEqual(len(matched), 0)


class TestDETEXFIL012(unittest.TestCase):
    """DET-EXFIL-012: Large-Volume Data Exfiltration (500+ MB / 10 min)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def _download(
        self,
        *,
        bytes_downloaded: int,
        correlation_id: str,
        actor_id: str = "user-bob",
    ) -> Event:
        return _make_event(
            event_type="document.download.success",
            category="document",
            actor_id=actor_id,
            target_type="document",
            target_id="doc-001",
            status="success",
            status_code="200",
            correlation_id=correlation_id,
            payload={
                "document_id": "doc-001",
                "bytes_downloaded": bytes_downloaded,
            },
        )

    def test_single_huge_download_fires(self) -> None:
        corr = f"corr-{uuid4()}"
        event = self._download(bytes_downloaded=600 * 1024 * 1024, correlation_id=corr)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-EXFIL-012"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].payload["download_count"], 1)
        self.assertGreaterEqual(matched[0].payload["total_bytes"], 500 * 1024 * 1024)

    def test_many_small_downloads_cumulate(self) -> None:
        corr = f"corr-{uuid4()}"
        # 10 x 60MB = 600MB
        for _ in range(9):
            self.telemetry.emit(
                self._download(bytes_downloaded=60 * 1024 * 1024, correlation_id=corr)
            )
        final = self._download(bytes_downloaded=60 * 1024 * 1024, correlation_id=corr)
        self.telemetry.emit(final)
        alerts = self.detection.evaluate(final)
        matched = [a for a in alerts if a.rule_id == "DET-EXFIL-012"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].payload["download_count"], 10)

    def test_below_threshold_does_not_fire(self) -> None:
        corr = f"corr-{uuid4()}"
        event = self._download(bytes_downloaded=100 * 1024 * 1024, correlation_id=corr)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-EXFIL-012"]
        self.assertEqual(len(matched), 0)

    def test_missing_bytes_field_treated_as_zero(self) -> None:
        """An event missing bytes_downloaded shouldn't raise; it just doesn't
        contribute to the cumulative total."""
        corr = f"corr-{uuid4()}"
        event = _make_event(
            event_type="document.download.success",
            category="document",
            actor_id="user-bob",
            target_type="document",
            target_id="doc-001",
            status="success",
            status_code="200",
            correlation_id=corr,
            payload={"document_id": "doc-001"},  # no bytes_downloaded
        )
        self.telemetry.emit(event)
        # Must not raise.
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-EXFIL-012"]
        self.assertEqual(len(matched), 0)


class TestDETHOUR013(unittest.TestCase):
    """DET-HOUR-013: Off-Hours Privileged Action (22:00-06:00 UTC, admin writes)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def _privileged_event(
        self,
        *,
        event_type: str,
        hour: int,
        actor_role: str = "admin",
    ) -> Event:
        from datetime import datetime, timezone

        # Anchor on a fixed date so only the hour varies across test cases.
        ts = datetime(2026, 4, 15, hour, 30, 0, tzinfo=timezone.utc)
        return Event(
            event_type=event_type,
            category="system",
            actor_id="user-admin",
            actor_type="user",
            actor_role=actor_role,
            target_type="policy",
            target_id="policy-001",
            request_id=f"req-{uuid4()}",
            correlation_id=f"corr-{uuid4()}",
            session_id=None,
            source_ip="203.0.113.10",
            user_agent="test-client",
            origin="api",
            status="success",
            status_code="200",
            error_message=None,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.LOW,
            payload={"policy_id": "policy-001"},
            timestamp=ts,
        )

    def test_policy_change_at_midnight_fires(self) -> None:
        event = self._privileged_event(event_type="policy.change.executed", hour=0)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-HOUR-013"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].payload["hour_utc"], 0)

    def test_policy_change_at_23h_fires(self) -> None:
        event = self._privileged_event(event_type="policy.change.executed", hour=23)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-HOUR-013"]
        self.assertEqual(len(matched), 1)

    def test_business_hours_does_not_fire(self) -> None:
        event = self._privileged_event(event_type="policy.change.executed", hour=10)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-HOUR-013"]
        self.assertEqual(len(matched), 0)

    def test_non_admin_role_does_not_fire(self) -> None:
        event = self._privileged_event(
            event_type="policy.change.executed", hour=2, actor_role="analyst"
        )
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-HOUR-013"]
        self.assertEqual(len(matched), 0)

    def test_non_privileged_event_does_not_fire(self) -> None:
        event = self._privileged_event(event_type="document.read.success", hour=2)
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-HOUR-013"]
        self.assertEqual(len(matched), 0)


if __name__ == "__main__":
    unittest.main()
