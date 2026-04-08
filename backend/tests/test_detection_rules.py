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
        event = _make_event(event_type="authentication.login.success", status="success", status_code="200")
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
            self.telemetry.emit(_make_event(
                event_type="document.read.success",
                category="document",
                target_type="document",
                target_id=doc_id,
                status="success",
                status_code="200",
                correlation_id=corr,
                payload={"document_id": doc_id, "classification": "internal"},
            ))

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
        self.telemetry.emit(_make_event(
            event_type="document.read.success",
            category="document",
            target_type="document",
            target_id="doc-001",
            status="success",
            status_code="200",
            correlation_id=corr,
            payload={"document_id": "doc-001", "classification": "internal"},
        ))
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


if __name__ == "__main__":
    unittest.main()
