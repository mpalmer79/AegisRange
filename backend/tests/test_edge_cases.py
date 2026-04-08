"""1E.5: Edge case tests — empty store, duplicate alerts, concurrent correlations, validation."""
from __future__ import annotations

import unittest
from uuid import uuid4

from app.models import Alert, Confidence, Event, Severity
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.store import InMemoryStore


def _make_event(**overrides) -> Event:
    defaults = dict(
        event_type="authentication.login.failure",
        category="authentication",
        actor_id="user-alice",
        actor_type="user",
        actor_role="analyst",
        target_type="identity",
        target_id="alice",
        request_id=f"req-{uuid4()}",
        correlation_id=f"corr-{uuid4()}",
        source_ip="203.0.113.10",
        user_agent="test-client",
        origin="api",
        status="failure",
        status_code="401",
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={"username": "alice"},
    )
    defaults.update(overrides)
    return Event(**defaults)


class TestEmptyStore(unittest.TestCase):
    """Operations on an empty store should not crash."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)

    def test_lookup_events_empty(self) -> None:
        result = self.telemetry.lookup_events(actor_id="user-alice")
        self.assertEqual(result, [])

    def test_detection_on_single_event(self) -> None:
        event = _make_event()
        self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        # Single failure should not trigger any rule
        self.assertEqual(len(alerts), 0)

    def test_store_reset_is_clean(self) -> None:
        self.store.events.append(_make_event())
        self.store.step_up_required.add("user-alice")
        self.store.alert_signatures.add(("a", "b", "c"))
        self.store.reset()
        self.assertEqual(len(self.store.events), 0)
        self.assertEqual(len(self.store.step_up_required), 0)
        self.assertEqual(len(self.store.alert_signatures), 0)


class TestAlertDeduplication(unittest.TestCase):
    """Pipeline should not produce duplicate alerts for the same rule/actor/correlation."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)
        self.response = ResponseOrchestrator(self.store)
        self.incidents = IncidentService(self.store)
        self.pipeline = EventPipelineService(
            telemetry=self.telemetry,
            detection=self.detection,
            response=self.response,
            incidents=self.incidents,
            store=self.store,
        )

    def test_duplicate_alerts_suppressed(self) -> None:
        corr = f"corr-{uuid4()}"
        # Emit 10 failures — should only get ONE DET-AUTH-001 alert (deduped after first)
        for _ in range(10):
            event = _make_event(correlation_id=corr)
            self.pipeline.process(event)

        auth_001_alerts = [a for a in self.store.alerts if a.rule_id == "DET-AUTH-001" and a.correlation_id == corr]
        self.assertEqual(len(auth_001_alerts), 1)

    def test_different_correlations_not_deduped(self) -> None:
        for _ in range(2):
            corr = f"corr-{uuid4()}"
            for _ in range(5):
                self.pipeline.process(_make_event(correlation_id=corr))

        auth_001_alerts = [a for a in self.store.alerts if a.rule_id == "DET-AUTH-001"]
        self.assertEqual(len(auth_001_alerts), 2)


class TestConcurrentCorrelations(unittest.TestCase):
    """Multiple correlation IDs running simultaneously should be isolated."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)
        self.response = ResponseOrchestrator(self.store)
        self.incidents = IncidentService(self.store)
        self.pipeline = EventPipelineService(
            telemetry=self.telemetry,
            detection=self.detection,
            response=self.response,
            incidents=self.incidents,
            store=self.store,
        )

    def test_incidents_are_isolated(self) -> None:
        corr_a = f"corr-{uuid4()}"
        corr_b = f"corr-{uuid4()}"

        # Scenario A: auth failures + success
        for _ in range(5):
            self.pipeline.process(_make_event(correlation_id=corr_a))
        self.pipeline.process(_make_event(
            event_type="authentication.login.success",
            status="success",
            status_code="200",
            correlation_id=corr_a,
        ))

        # Scenario B: doc reads only (no incident expected unless >=20)
        for i in range(5):
            self.pipeline.process(_make_event(
                event_type="document.read.success",
                category="document",
                target_type="document",
                target_id=f"doc-{i:03d}",
                status="success",
                status_code="200",
                correlation_id=corr_b,
                payload={"document_id": f"doc-{i:03d}", "classification": "internal"},
            ))

        self.assertIn(corr_a, self.store.incidents_by_correlation)
        self.assertNotIn(corr_b, self.store.incidents_by_correlation)


class TestEventValidation(unittest.TestCase):
    """Telemetry service should reject invalid events."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)

    def test_invalid_category_rejected(self) -> None:
        event = _make_event(category="bogus_category")
        with self.assertRaises(ValueError) as ctx:
            self.telemetry.emit(event)
        self.assertIn("Invalid category", str(ctx.exception))

    def test_invalid_status_rejected(self) -> None:
        event = _make_event(status="maybe")
        with self.assertRaises(ValueError) as ctx:
            self.telemetry.emit(event)
        self.assertIn("Invalid status", str(ctx.exception))

    def test_invalid_actor_type_rejected(self) -> None:
        event = _make_event(actor_type="robot")
        with self.assertRaises(ValueError) as ctx:
            self.telemetry.emit(event)
        self.assertIn("Invalid actor_type", str(ctx.exception))

    def test_invalid_event_type_format(self) -> None:
        event = _make_event(event_type="login_failure")
        with self.assertRaises(ValueError) as ctx:
            self.telemetry.emit(event)
        self.assertIn("Invalid event_type format", str(ctx.exception))

    def test_valid_event_accepted(self) -> None:
        event = _make_event()
        result = self.telemetry.emit(event)
        self.assertEqual(result.event_id, event.event_id)


class TestDocumentServiceEdgeCases(unittest.TestCase):
    """Document service edge cases."""

    def test_can_read_nonexistent(self) -> None:
        service = DocumentService()
        allowed, doc = service.can_read("admin", "doc-999")
        self.assertFalse(allowed)
        self.assertIsNone(doc)

    def test_can_download_nonexistent(self) -> None:
        service = DocumentService()
        allowed, doc = service.can_download("admin", "doc-999")
        self.assertFalse(allowed)
        self.assertIsNone(doc)

    def test_download_blocked_by_restriction(self) -> None:
        store = InMemoryStore()
        store.download_restricted_actors.add("user-bob")
        service = DocumentService(store=store)
        allowed, doc = service.can_download("admin", "doc-001", actor_id="user-bob")
        self.assertFalse(allowed)
        self.assertIsNotNone(doc)

    def test_unknown_role_gets_public_clearance(self) -> None:
        service = DocumentService()
        allowed, doc = service.can_read("unknown", "doc-001")
        self.assertTrue(allowed)  # public doc with public clearance
        allowed, doc = service.can_read("unknown", "doc-002")
        self.assertFalse(allowed)  # internal doc exceeds public clearance


class TestIdentityServiceEdgeCases(unittest.TestCase):
    """Identity service edge cases."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.identity = IdentityService(self.store)

    def test_authenticate_unknown_user(self) -> None:
        result = self.identity.authenticate("nobody", "password")
        self.assertFalse(result.success)
        self.assertEqual(result.actor_id, "user-nobody")
        self.assertEqual(result.actor_role, "unknown")

    def test_session_uniqueness(self) -> None:
        r1 = self.identity.authenticate("alice", "correct-horse")
        r2 = self.identity.authenticate("alice", "correct-horse")
        self.assertNotEqual(r1.session_id, r2.session_id)

    def test_validate_session(self) -> None:
        result = self.identity.authenticate("alice", "correct-horse")
        self.assertTrue(self.identity.validate_session(result.session_id))

    def test_validate_revoked_session(self) -> None:
        result = self.identity.authenticate("alice", "correct-horse")
        self.store.revoked_sessions.add(result.session_id)
        self.assertFalse(self.identity.validate_session(result.session_id))

    def test_validate_nonexistent_session(self) -> None:
        self.assertFalse(self.identity.validate_session("fake-session"))

    def test_step_up_required(self) -> None:
        self.store.step_up_required.add("user-alice")
        self.assertTrue(self.identity.is_step_up_required("user-alice"))
        self.assertFalse(self.identity.is_step_up_required("user-bob"))

    def test_clear_step_up(self) -> None:
        self.store.step_up_required.add("user-alice")
        self.identity.clear_step_up("user-alice")
        self.assertFalse(self.identity.is_step_up_required("user-alice"))


class TestIncidentLifecycleEdgeCases(unittest.TestCase):
    """Incident service edge cases."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.incidents = IncidentService(self.store)

    def test_register_event_no_incident(self) -> None:
        event = _make_event()
        # Should not crash when no incident exists
        self.incidents.register_event(event)

    def test_low_severity_alert_no_incident(self) -> None:
        alert = Alert(
            rule_id="DET-AUTH-001",
            rule_name="Test",
            severity=Severity.MEDIUM,
            confidence=Confidence.MEDIUM,
            actor_id="user-alice",
            correlation_id=f"corr-{uuid4()}",
            contributing_event_ids=[],
            summary="Test alert",
            payload={},
        )
        event = _make_event()
        incident = self.incidents.register_alert(alert, source_event=event)
        self.assertEqual(incident.status, "not_created")

    def test_severity_escalation(self) -> None:
        event = _make_event()
        # First: high severity creates incident
        alert_high = Alert(
            rule_id="DET-AUTH-002",
            rule_name="Suspicious Success",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id="user-alice",
            correlation_id=event.correlation_id,
            contributing_event_ids=[event.event_id],
            summary="High severity",
            payload={},
        )
        incident = self.incidents.register_alert(alert_high, source_event=event)
        self.assertEqual(incident.severity, Severity.HIGH)

        # Second: critical severity escalates
        alert_crit = Alert(
            rule_id="DET-DOC-006",
            rule_name="Exfiltration",
            severity=Severity.CRITICAL,
            confidence=Confidence.HIGH,
            actor_id="user-alice",
            correlation_id=event.correlation_id,
            contributing_event_ids=[event.event_id],
            summary="Critical severity",
            payload={},
        )
        incident = self.incidents.register_alert(alert_crit, source_event=event)
        self.assertEqual(incident.severity, Severity.CRITICAL)
        # Verify escalation timeline entry exists
        escalation_entries = [e for e in incident.timeline if "escalated" in e.summary.lower()]
        self.assertGreater(len(escalation_entries), 0)


class TestPipelineEmitsSystemEvents(unittest.TestCase):
    """Pipeline should emit detection and response events."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)
        self.response = ResponseOrchestrator(self.store)
        self.incidents = IncidentService(self.store)
        self.pipeline = EventPipelineService(
            telemetry=self.telemetry,
            detection=self.detection,
            response=self.response,
            incidents=self.incidents,
            store=self.store,
        )

    def test_detection_events_emitted(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(5):
            self.pipeline.process(_make_event(correlation_id=corr))

        detection_events = [e for e in self.store.events if e.event_type == "detection.rule.triggered"]
        self.assertGreater(len(detection_events), 0)

    def test_response_events_emitted(self) -> None:
        corr = f"corr-{uuid4()}"
        for _ in range(5):
            self.pipeline.process(_make_event(correlation_id=corr))

        response_events = [e for e in self.store.events if e.event_type.startswith("response.")]
        self.assertGreater(len(response_events), 0)


if __name__ == "__main__":
    unittest.main()
