"""Phase 5: Unit tests for risk scoring engine."""
from __future__ import annotations

import unittest
from uuid import uuid4

from app.models import Alert, Confidence, Severity
from app.store import InMemoryStore


class TestRiskScoringService(unittest.TestCase):
    """Risk scoring engine tests."""

    def setUp(self) -> None:
        self.store = InMemoryStore()
        # Import here to avoid issues if risk_service doesn't exist yet during collection
        from app.services.risk_service import RiskScoringService
        self.risk = RiskScoringService(self.store)

    def _make_alert(
        self,
        *,
        rule_id: str = "DET-AUTH-001",
        severity: Severity = Severity.MEDIUM,
        confidence: Confidence = Confidence.MEDIUM,
        actor_id: str = "user-alice",
    ) -> Alert:
        return Alert(
            rule_id=rule_id,
            rule_name=f"Rule {rule_id}",
            severity=severity,
            confidence=confidence,
            actor_id=actor_id,
            correlation_id=f"corr-{uuid4()}",
            contributing_event_ids=[f"evt-{uuid4()}"],
            summary=f"Alert from {rule_id}",
            payload={},
        )

    def test_first_alert_creates_profile(self) -> None:
        alert = self._make_alert()
        profile = self.risk.update_risk(alert)
        self.assertEqual(profile.actor_id, "user-alice")
        self.assertGreater(profile.current_score, 0)

    def test_severity_weights(self) -> None:
        # Medium severity with medium confidence: 15 * 0.75 = 11
        alert_med = self._make_alert(severity=Severity.MEDIUM, confidence=Confidence.MEDIUM)
        profile = self.risk.update_risk(alert_med)
        self.assertEqual(profile.current_score, 11)

        # Reset for next test
        self.store.risk_profiles.clear()

        # High severity with high confidence: 30 * 1.0 = 30
        alert_high = self._make_alert(severity=Severity.HIGH, confidence=Confidence.HIGH)
        profile = self.risk.update_risk(alert_high)
        self.assertEqual(profile.current_score, 30)

        # Reset for next test
        self.store.risk_profiles.clear()

        # Critical with high: 50 * 1.0 = 50
        alert_crit = self._make_alert(severity=Severity.CRITICAL, confidence=Confidence.HIGH)
        profile = self.risk.update_risk(alert_crit)
        self.assertEqual(profile.current_score, 50)

    def test_risk_accumulates(self) -> None:
        alert1 = self._make_alert(severity=Severity.MEDIUM, confidence=Confidence.MEDIUM)
        alert2 = self._make_alert(
            rule_id="DET-AUTH-002",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
        )
        self.risk.update_risk(alert1)
        profile = self.risk.update_risk(alert2)
        # 11 + 30 = 41
        self.assertEqual(profile.current_score, 41)

    def test_peak_score_tracked(self) -> None:
        alert = self._make_alert(severity=Severity.HIGH, confidence=Confidence.HIGH)
        profile = self.risk.update_risk(alert)
        self.assertEqual(profile.peak_score, 30)

    def test_contributing_rules_tracked(self) -> None:
        self.risk.update_risk(self._make_alert(rule_id="DET-AUTH-001"))
        profile = self.risk.update_risk(self._make_alert(rule_id="DET-AUTH-002"))
        self.assertIn("DET-AUTH-001", profile.contributing_rules)
        self.assertIn("DET-AUTH-002", profile.contributing_rules)

    def test_score_history(self) -> None:
        self.risk.update_risk(self._make_alert())
        profile = self.risk.update_risk(self._make_alert(rule_id="DET-AUTH-002"))
        self.assertEqual(len(profile.score_history), 2)
        self.assertIn("rule_id", profile.score_history[0])
        self.assertIn("delta", profile.score_history[0])

    def test_get_profile(self) -> None:
        self.risk.update_risk(self._make_alert())
        profile = self.risk.get_profile("user-alice")
        self.assertIsNotNone(profile)
        self.assertEqual(profile.actor_id, "user-alice")

    def test_get_nonexistent_profile(self) -> None:
        profile = self.risk.get_profile("user-nobody")
        self.assertIsNone(profile)

    def test_get_all_profiles_sorted(self) -> None:
        self.risk.update_risk(self._make_alert(actor_id="user-alice", severity=Severity.LOW))
        self.risk.update_risk(self._make_alert(actor_id="user-bob", severity=Severity.CRITICAL))
        profiles = self.risk.get_all_profiles()
        self.assertEqual(len(profiles), 2)
        self.assertEqual(profiles[0].actor_id, "user-bob")

    def test_different_actors_isolated(self) -> None:
        self.risk.update_risk(self._make_alert(actor_id="user-alice"))
        self.risk.update_risk(self._make_alert(actor_id="user-bob"))
        alice = self.risk.get_profile("user-alice")
        bob = self.risk.get_profile("user-bob")
        self.assertIsNotNone(alice)
        self.assertIsNotNone(bob)
        self.assertNotEqual(alice.actor_id, bob.actor_id)

    def test_incident_risk_score_updated(self) -> None:
        from app.models import Incident
        incident = Incident(
            incident_type="test",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="corr-test",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
        )
        self.store.incidents_by_correlation["corr-test"] = incident

        self.risk.update_risk(self._make_alert(severity=Severity.HIGH, confidence=Confidence.HIGH))
        self.assertEqual(incident.risk_score, 30)


if __name__ == "__main__":
    unittest.main()
