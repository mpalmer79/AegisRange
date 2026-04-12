"""1E.2: Unit tests for each response playbook individually."""

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
    actor_id: str = "user-alice",
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


class TestPBAUTH001(unittest.TestCase):
    """PB-AUTH-001: Authentication Failure Containment (rate limit)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_produces_rate_limit_action(self) -> None:
        alert = _make_alert(
            rule_id="DET-AUTH-001",
            severity=Severity.MEDIUM,
            payload={"failure_count": 5},
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-AUTH-001")
        self.assertEqual(responses[0].action_type, "rate_limit")

    def test_response_persisted_in_store(self) -> None:
        alert = _make_alert(rule_id="DET-AUTH-001")
        self.orchestrator.execute(alert)
        self.assertEqual(len(self.store.responses), 1)


class TestPBAUTH002(unittest.TestCase):
    """PB-AUTH-002: Suspicious Login Containment (step-up auth)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_requires_step_up(self) -> None:
        alert = _make_alert(rule_id="DET-AUTH-002")
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-AUTH-002")
        self.assertEqual(responses[0].action_type, "step_up_authentication")
        self.assertIn(alert.actor_id, self.store.step_up_required)

    def test_step_up_flag_persists(self) -> None:
        alert = _make_alert(rule_id="DET-AUTH-002", actor_id="user-bob")
        self.orchestrator.execute(alert)
        self.assertIn("user-bob", self.store.step_up_required)


class TestPBSESSION003(unittest.TestCase):
    """PB-SESSION-003: Session Hijack Containment (session revocation)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_revokes_session(self) -> None:
        session_id = f"session-{uuid4()}"
        alert = _make_alert(
            rule_id="DET-SESSION-003",
            payload={
                "session_id": session_id,
                "source_ip_list": ["198.51.100.10", "203.0.113.55"],
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-SESSION-003")
        self.assertEqual(responses[0].action_type, "session_revocation")
        self.assertIn(session_id, self.store.revoked_sessions)

    def test_response_payload_contains_session(self) -> None:
        session_id = f"session-{uuid4()}"
        alert = _make_alert(
            rule_id="DET-SESSION-003",
            payload={"session_id": session_id},
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(responses[0].payload["session_id"], session_id)


class TestPBDOC004(unittest.TestCase):
    """PB-DOC-004: Restricted Access Enforcement."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_produces_access_denied(self) -> None:
        alert = _make_alert(
            rule_id="DET-DOC-004",
            payload={
                "document_id": "doc-003",
                "classification": "restricted",
                "actor_role": "analyst",
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-DOC-004")
        self.assertEqual(responses[0].action_type, "access_denied")

    def test_response_preserves_context(self) -> None:
        alert = _make_alert(
            rule_id="DET-DOC-004",
            payload={
                "document_id": "doc-003",
                "classification": "restricted",
                "actor_role": "analyst",
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(responses[0].payload["document_id"], "doc-003")


class TestPBDOC005(unittest.TestCase):
    """PB-DOC-005: Bulk Access Constraint (download restriction)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_restricts_downloads(self) -> None:
        alert = _make_alert(rule_id="DET-DOC-005", payload={"document_count": 25})
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-DOC-005")
        self.assertEqual(responses[0].action_type, "download_restriction")
        self.assertIn(alert.actor_id, self.store.download_restricted_actors)


class TestPBDOC006(unittest.TestCase):
    """PB-DOC-006: Data Exfiltration Containment (download block)."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.orchestrator = ResponseOrchestrator(self.store)

    def test_blocks_downloads(self) -> None:
        alert = _make_alert(
            rule_id="DET-DOC-006",
            payload={
                "read_count": 3,
                "download_count": 3,
                "overlapping_documents": ["doc-001", "doc-002"],
            },
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-DOC-006")
        self.assertEqual(responses[0].action_type, "download_block")
        self.assertIn(alert.actor_id, self.store.download_restricted_actors)


class TestUnknownRule(unittest.TestCase):
    """Unrecognized rules produce no response."""

    def test_unknown_rule_returns_empty(self) -> None:
        store = InMemoryStore()
        orchestrator = ResponseOrchestrator(store)
        alert = _make_alert(rule_id="DET-UNKNOWN-999")
        responses = orchestrator.execute(alert)
        self.assertEqual(responses, [])
        self.assertEqual(len(store.responses), 0)


# ---------------------------------------------------------------------------
# PB-SVC-007, PB-ART-008, PB-POL-009, PB-CORR-010 response playbooks
# ---------------------------------------------------------------------------


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
