"""Phase 2: Unit tests for PB-SVC-007, PB-ART-008, PB-POL-009, PB-CORR-010 response playbooks."""

from __future__ import annotations

import unittest
from uuid import uuid4

from app.models import Alert, Confidence, Severity
from app.services.response_service import ResponseOrchestrator
from app.store import InMemoryStore


def _make_alert(
    *,
    rule_id: str,
    severity: Severity = Severity.HIGH,
    confidence: Confidence = Confidence.HIGH,
    actor_id: str = "svc-data-processor",
    correlation_id: str | None = None,
    payload: dict | None = None,
) -> Alert:
    return Alert(
        rule_id=rule_id,
        rule_name=f"Rule {rule_id}",
        severity=severity,
        confidence=confidence,
        actor_id=actor_id,
        correlation_id=correlation_id or f"corr-{uuid4()}",
        contributing_event_ids=[f"evt-{uuid4()}"],
        summary=f"Alert from {rule_id}",
        payload=payload or {},
    )


class TestPBSVC007(unittest.TestCase):
    """PB-SVC-007: Service Identity Containment."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_disables_service(self) -> None:
        alert = _make_alert(
            rule_id="DET-SVC-007",
            payload={
                "service_id": "svc-data-processor",
                "route_list": ["/admin/config", "/admin/secrets"],
                "failure_count": 3,
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-SVC-007")
        self.assertEqual(responses[0].action_type, "service_disabled")
        self.assertIn("svc-data-processor", self.store.disabled_services)

    def test_blocks_routes(self) -> None:
        alert = _make_alert(
            rule_id="DET-SVC-007",
            payload={
                "service_id": "svc-data-processor",
                "route_list": ["/admin/config", "/admin/secrets"],
            },
        )
        self.orchestrator.execute(alert)
        self.assertIn("svc-data-processor", self.store.blocked_routes)
        self.assertEqual(
            self.store.blocked_routes["svc-data-processor"],
            {"/admin/config", "/admin/secrets"},
        )

    def test_response_persisted(self) -> None:
        alert = _make_alert(
            rule_id="DET-SVC-007",
            payload={"service_id": "svc-data-processor", "route_list": []},
        )
        self.orchestrator.execute(alert)
        self.assertEqual(len(self.store.responses), 1)


class TestPBART008(unittest.TestCase):
    """PB-ART-008: Artifact Quarantine."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_quarantines_artifacts(self) -> None:
        alert = _make_alert(
            rule_id="DET-ART-008",
            severity=Severity.MEDIUM,
            confidence=Confidence.MEDIUM,
            actor_id="svc-artifact-supplier",
            payload={
                "artifact_ids": ["artifact-001", "artifact-002", "artifact-003"],
                "failure_count": 3,
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-ART-008")
        self.assertEqual(responses[0].action_type, "artifact_quarantine")
        self.assertEqual(
            self.store.quarantined_artifacts,
            {"artifact-001", "artifact-002", "artifact-003"},
        )

    def test_response_payload(self) -> None:
        alert = _make_alert(
            rule_id="DET-ART-008",
            actor_id="svc-artifact-supplier",
            payload={"artifact_ids": ["artifact-001"], "failure_count": 3},
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(responses[0].payload["artifact_ids"], ["artifact-001"])
        self.assertEqual(responses[0].payload["failure_count"], 3)


class TestPBPOL009(unittest.TestCase):
    """PB-POL-009: Privileged Change Control."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_restricts_policy_changes(self) -> None:
        alert = _make_alert(
            rule_id="DET-POL-009",
            severity=Severity.CRITICAL,
            actor_id="user-alice",
            payload={
                "policy_id": "policy-001",
                "actor_risk_context": "step_up_required",
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-POL-009")
        self.assertEqual(responses[0].action_type, "policy_change_restricted")
        self.assertIn("user-alice", self.store.policy_change_restricted_actors)

    def test_requires_step_up(self) -> None:
        alert = _make_alert(
            rule_id="DET-POL-009",
            actor_id="user-alice",
            payload={
                "policy_id": "policy-001",
                "actor_risk_context": "step_up_required",
            },
        )
        self.orchestrator.execute(alert)
        self.assertIn("user-alice", self.store.step_up_required)


class TestPBCORR010(unittest.TestCase):
    """PB-CORR-010: Multi-Signal Incident Containment."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_applies_strongest_containment(self) -> None:
        alert = _make_alert(
            rule_id="DET-CORR-010",
            severity=Severity.CRITICAL,
            actor_id="user-alice",
            payload={
                "detection_ids": ["DET-AUTH-001", "DET-AUTH-002", "DET-DOC-005"],
                "actor_id": "user-alice",
                "timeline_summary": "3 detection events across 3 rules",
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-CORR-010")
        self.assertEqual(responses[0].action_type, "multi_signal_containment")
        self.assertIn("user-alice", self.store.step_up_required)
        self.assertIn("user-alice", self.store.download_restricted_actors)

    def test_response_payload_contains_detection_ids(self) -> None:
        alert = _make_alert(
            rule_id="DET-CORR-010",
            actor_id="user-alice",
            payload={
                "detection_ids": ["DET-AUTH-001", "DET-AUTH-002", "DET-DOC-005"],
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(
            responses[0].payload["detection_ids"],
            ["DET-AUTH-001", "DET-AUTH-002", "DET-DOC-005"],
        )
        self.assertEqual(
            responses[0].payload["containment_actions"],
            ["step_up_authentication", "download_restriction"],
        )


if __name__ == "__main__":
    unittest.main()
