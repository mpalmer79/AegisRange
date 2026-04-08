"""Tests for the serializers module — verifies response shapes at the unit level."""
from __future__ import annotations

import unittest
from datetime import datetime

from app.models import Alert, Confidence, Event, Incident, Severity, TimelineEntry
from app.serializers import (
    alert_to_dict,
    auth_user_to_dict,
    event_to_dict,
    incident_to_dict,
    mitre_mapping_to_dict,
    mitre_technique_to_dict,
    risk_profile_to_dict,
    timeline_entry_to_dict,
)


class TestEventSerializer(unittest.TestCase):
    def setUp(self) -> None:
        self.event = Event(
            event_type="authentication.login.success",
            category="authentication",
            actor_id="actor-1",
            actor_type="user",
            actor_role="analyst",
            target_type="identity",
            target_id="alice",
            request_id="req-1",
            correlation_id="corr-1",
            session_id="sess-1",
            source_ip="10.0.0.1",
            user_agent="test",
            origin="api",
            status="success",
            status_code="200",
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
            risk_score=42,
            payload={"key": "value"},
        )

    def test_all_fields_present(self) -> None:
        d = event_to_dict(self.event)
        expected_keys = {
            "event_id", "event_type", "category", "timestamp",
            "actor_id", "actor_type", "actor_role",
            "target_type", "target_id", "request_id", "correlation_id",
            "session_id", "source_ip", "user_agent", "origin",
            "status", "status_code", "error_message",
            "severity", "confidence", "risk_score", "payload",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_severity_is_string(self) -> None:
        d = event_to_dict(self.event)
        self.assertEqual(d["severity"], "medium")

    def test_timestamp_is_iso(self) -> None:
        d = event_to_dict(self.event)
        datetime.fromisoformat(d["timestamp"])  # should not raise


class TestAlertSerializer(unittest.TestCase):
    def setUp(self) -> None:
        self.alert = Alert(
            rule_id="DET-AUTH-001",
            rule_name="Suspicious Login",
            severity=Severity.HIGH,
            confidence=Confidence.MEDIUM,
            actor_id="actor-1",
            correlation_id="corr-1",
            contributing_event_ids=["evt-1", "evt-2"],
            summary="Suspicious login detected",
            payload={"detail": "brute force"},
        )

    def test_all_fields_present(self) -> None:
        d = alert_to_dict(self.alert)
        expected_keys = {
            "alert_id", "rule_id", "rule_name", "severity", "confidence",
            "actor_id", "correlation_id", "contributing_event_ids",
            "summary", "payload", "created_at",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_no_alias_fields(self) -> None:
        d = alert_to_dict(self.alert)
        self.assertNotIn("timestamp", d)
        self.assertNotIn("event_ids", d)
        self.assertNotIn("details", d)


class TestIncidentSerializer(unittest.TestCase):
    def setUp(self) -> None:
        self.incident = Incident(
            incident_type="credential_abuse",
            primary_actor_id="actor-1",
            actor_type="user",
            correlation_id="corr-1",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_role="analyst",
        )
        self.incident.add_timeline_entry(
            entry_type="detection",
            reference_id="det-1",
            summary="Detected brute force",
        )

    def test_all_fields_present(self) -> None:
        d = incident_to_dict(self.incident, notes=[])
        expected_keys = {
            "incident_id", "incident_type", "status",
            "primary_actor_id", "actor_type", "actor_role",
            "correlation_id", "severity", "confidence", "risk_score",
            "detection_ids", "detection_summary", "response_ids",
            "containment_status", "event_ids",
            "affected_documents", "affected_sessions", "affected_services",
            "affected_resources", "timeline",
            "created_at", "updated_at", "closed_at", "notes",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_no_alias_fields(self) -> None:
        d = incident_to_dict(self.incident, notes=[])
        self.assertNotIn("primary_actor", d)
        self.assertNotIn("detection_summaries", d)

    def test_timeline_uses_entry_id(self) -> None:
        d = incident_to_dict(self.incident, notes=[])
        entry = d["timeline"][0]
        self.assertIn("entry_id", entry)
        self.assertNotIn("reference_id", entry)
        self.assertEqual(
            set(entry.keys()),
            {"timestamp", "entry_type", "entry_id", "summary"},
        )

    def test_notes_passed_through(self) -> None:
        notes = [{"note_id": "n-1", "author": "admin", "content": "test", "created_at": "2024-01-01"}]
        d = incident_to_dict(self.incident, notes=notes)
        self.assertEqual(d["notes"], notes)

    def test_notes_default_empty(self) -> None:
        d = incident_to_dict(self.incident)
        self.assertEqual(d["notes"], [])

    def test_affected_resources_shape(self) -> None:
        d = incident_to_dict(self.incident, notes=[])
        ar = d["affected_resources"]
        self.assertEqual(set(ar.keys()), {"documents", "sessions", "services", "actors"})
        self.assertEqual(ar["actors"], ["actor-1"])


class TestTimelineEntrySerializer(unittest.TestCase):
    def test_fields(self) -> None:
        entry = TimelineEntry(
            timestamp=datetime(2024, 1, 1, 12, 0, 0),
            entry_type="detection",
            reference_id="det-1",
            summary="test",
        )
        d = timeline_entry_to_dict(entry)
        self.assertEqual(set(d.keys()), {"timestamp", "entry_type", "entry_id", "summary"})
        self.assertEqual(d["entry_id"], "det-1")
        self.assertEqual(d["timestamp"], "2024-01-01T12:00:00")


class TestRiskProfileSerializer(unittest.TestCase):
    def test_fields(self) -> None:
        from dataclasses import dataclass, field as dc_field

        @dataclass
        class FakeProfile:
            actor_id: str = "actor-1"
            current_score: int = 75
            peak_score: int = 90
            contributing_rules: list = dc_field(default_factory=lambda: ["DET-AUTH-001"])
            score_history: list = dc_field(default_factory=list)
            last_updated: datetime = dc_field(default_factory=datetime.utcnow)

        d = risk_profile_to_dict(FakeProfile())
        self.assertEqual(
            set(d.keys()),
            {"actor_id", "current_score", "peak_score", "contributing_rules", "score_history", "last_updated"},
        )


class TestAuthUserSerializer(unittest.TestCase):
    def test_fields(self) -> None:
        from dataclasses import dataclass, field as dc_field

        @dataclass
        class FakeUser:
            user_id: str = "usr-1"
            username: str = "admin"
            role: str = "admin"
            display_name: str = "Admin User"
            created_at: datetime = dc_field(default_factory=datetime.utcnow)

        d = auth_user_to_dict(FakeUser())
        self.assertEqual(
            set(d.keys()),
            {"user_id", "username", "role", "display_name", "created_at"},
        )


class TestMitreSerializers(unittest.TestCase):
    def test_mapping_fields(self) -> None:
        from dataclasses import dataclass, field as dc_field

        @dataclass(frozen=True)
        class FakeMapping:
            rule_id: str = "DET-AUTH-001"
            technique_ids: list = dc_field(default_factory=lambda: ["T1078"])
            tactic_ids: list = dc_field(default_factory=lambda: ["TA0001"])
            kill_chain_phases: list = dc_field(default_factory=lambda: ["initial_access"])

        d = mitre_mapping_to_dict(FakeMapping())
        self.assertEqual(
            set(d.keys()),
            {"rule_id", "technique_ids", "tactic_ids", "kill_chain_phases"},
        )

    def test_technique_fields(self) -> None:
        from dataclasses import dataclass, field as dc_field

        @dataclass(frozen=True)
        class FakeTechnique:
            id: str = "T1078"
            name: str = "Valid Accounts"
            description: str = "desc"
            tactic_ids: list = dc_field(default_factory=lambda: ["TA0001"])
            url: str = "https://example.com"

        d = mitre_technique_to_dict(FakeTechnique())
        self.assertEqual(
            set(d.keys()),
            {"id", "name", "description", "tactic_ids", "url"},
        )


if __name__ == "__main__":
    unittest.main()
