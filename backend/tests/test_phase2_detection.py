"""Phase 2: Unit tests for DET-SVC-007, DET-ART-008, DET-POL-009 detection rules."""

from __future__ import annotations

import unittest
from uuid import uuid4

from app.models import Confidence, Event, Severity
from app.services.detection_service import DetectionService
from app.services.event_services import TelemetryService
from app.store import InMemoryStore


def _make_event(
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
            event = _make_event(
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
            event = _make_event(correlation_id=corr, target_id=route)
            self.telemetry.emit(event)
        alerts = self.detection.evaluate(event)
        matched = [a for a in alerts if a.rule_id == "DET-SVC-007"]
        self.assertEqual(len(matched), 0)

    def test_ignores_user_actor_type(self) -> None:
        corr = f"corr-{uuid4()}"
        for route in ["/admin/config", "/admin/secrets", "/admin/users"]:
            event = _make_event(
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
        event = _make_event(
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
            event = _make_event(correlation_id=corr, target_id=route)
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
            event = _make_event(
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
            event = _make_event(
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
            event = _make_event(
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
        event = _make_event(
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
        event = _make_event(
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
        event = _make_event(
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
        event = _make_event(
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
        event = _make_event(
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
        event = _make_event(
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


if __name__ == "__main__":
    unittest.main()
