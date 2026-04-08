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
        alert = _make_alert(rule_id="DET-AUTH-001", severity=Severity.MEDIUM, payload={"failure_count": 5})
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
            payload={"session_id": session_id, "source_ip_list": ["198.51.100.10", "203.0.113.55"]},
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
            payload={"document_id": "doc-003", "classification": "restricted", "actor_role": "analyst"},
        )
        responses = self.orchestrator.execute(alert)
        self.assertEqual(len(responses), 1)
        self.assertEqual(responses[0].playbook_id, "PB-DOC-004")
        self.assertEqual(responses[0].action_type, "access_denied")

    def test_response_preserves_context(self) -> None:
        alert = _make_alert(
            rule_id="DET-DOC-004",
            payload={"document_id": "doc-003", "classification": "restricted", "actor_role": "analyst"},
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
            payload={"read_count": 3, "download_count": 3, "overlapping_documents": ["doc-001", "doc-002"]},
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


if __name__ == "__main__":
    unittest.main()
