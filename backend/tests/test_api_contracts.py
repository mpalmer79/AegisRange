"""Tests verifying API response shapes match the frontend contract.

These tests assert the exact set of fields returned by key endpoints
so that backend serializer changes don't silently break the frontend.
"""
from __future__ import annotations

import unittest

from app.store import STORE
from tests.auth_helper import authenticated_client


class TestHealthContract(unittest.TestCase):
    def test_health_fields(self) -> None:
        client = authenticated_client()
        resp = client.get("/health")
        data = resp.json()
        self.assertEqual(set(data.keys()), {"status", "timestamp"})


class TestAlertContract(unittest.TestCase):
    """Alert dicts should have exactly the canonical fields — no aliases."""

    EXPECTED_FIELDS = {
        "alert_id",
        "rule_id",
        "rule_name",
        "severity",
        "confidence",
        "actor_id",
        "correlation_id",
        "contributing_event_ids",
        "summary",
        "payload",
        "created_at",
    }

    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client("red_team")
        self.client.post("/scenarios/scn-auth-001")

    def test_alert_fields(self) -> None:
        client = authenticated_client("viewer")
        resp = client.get("/alerts")
        self.assertEqual(resp.status_code, 200)
        alerts = resp.json()
        self.assertGreater(len(alerts), 0, "No alerts to test against")
        for alert in alerts:
            self.assertEqual(
                set(alert.keys()),
                self.EXPECTED_FIELDS,
                f"Alert {alert.get('alert_id')} has unexpected fields: "
                f"extra={set(alert.keys()) - self.EXPECTED_FIELDS}, "
                f"missing={self.EXPECTED_FIELDS - set(alert.keys())}",
            )

    def test_no_alias_fields(self) -> None:
        """Removed aliases should not appear."""
        client = authenticated_client("viewer")
        resp = client.get("/alerts")
        for alert in resp.json():
            self.assertNotIn("timestamp", alert, "Alias 'timestamp' should be removed; use 'created_at'")
            self.assertNotIn("event_ids", alert, "Alias 'event_ids' should be removed; use 'contributing_event_ids'")
            self.assertNotIn("details", alert, "Alias 'details' should be removed; use 'payload'")


class TestIncidentContract(unittest.TestCase):
    """Incident dicts should have exactly the canonical fields — no aliases."""

    EXPECTED_FIELDS = {
        "incident_id",
        "incident_type",
        "status",
        "primary_actor_id",
        "actor_type",
        "actor_role",
        "correlation_id",
        "severity",
        "confidence",
        "risk_score",
        "detection_ids",
        "detection_summary",
        "response_ids",
        "containment_status",
        "event_ids",
        "affected_documents",
        "affected_sessions",
        "affected_services",
        "affected_resources",
        "timeline",
        "created_at",
        "updated_at",
        "closed_at",
        "notes",
    }

    def setUp(self) -> None:
        STORE.reset()
        client = authenticated_client("red_team")
        client.post("/scenarios/scn-auth-001")

    def test_incident_fields(self) -> None:
        client = authenticated_client("viewer")
        resp = client.get("/incidents")
        self.assertEqual(resp.status_code, 200)
        incidents = resp.json()
        self.assertGreater(len(incidents), 0, "No incidents to test against")
        for inc in incidents:
            self.assertEqual(
                set(inc.keys()),
                self.EXPECTED_FIELDS,
                f"Incident {inc.get('incident_id')} has unexpected fields: "
                f"extra={set(inc.keys()) - self.EXPECTED_FIELDS}, "
                f"missing={self.EXPECTED_FIELDS - set(inc.keys())}",
            )

    def test_no_alias_fields(self) -> None:
        """Removed aliases should not appear."""
        client = authenticated_client("viewer")
        resp = client.get("/incidents")
        for inc in resp.json():
            self.assertNotIn("primary_actor", inc, "Alias 'primary_actor' should be removed; use 'primary_actor_id'")
            self.assertNotIn("detection_summaries", inc, "Alias 'detection_summaries' should be removed; use 'detection_summary'")

    def test_timeline_entry_fields(self) -> None:
        """Timeline entries should use 'entry_id', not 'reference_id'."""
        client = authenticated_client("viewer")
        resp = client.get("/incidents")
        for inc in resp.json():
            for entry in inc.get("timeline", []):
                self.assertIn("entry_id", entry)
                self.assertNotIn("reference_id", entry, "Alias 'reference_id' should be removed; use 'entry_id'")
                self.assertEqual(
                    set(entry.keys()),
                    {"timestamp", "entry_type", "entry_id", "summary"},
                )


class TestPlatformLoginContract(unittest.TestCase):
    def test_login_response_fields(self) -> None:
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.post("/auth/login", json={
            "username": "admin",
            "password": "admin_pass",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(
            set(data.keys()),
            {"username", "role", "expires_at"},
        )


class TestScenarioResultContract(unittest.TestCase):
    EXPECTED_FIELDS = {
        "scenario_id",
        "correlation_id",
        "events_total",
        "events_generated",
        "alerts_total",
        "alerts_generated",
        "responses_total",
        "responses_generated",
        "incident_id",
        "step_up_required",
        "revoked_sessions",
        "download_restricted_actors",
        "disabled_services",
        "quarantined_artifacts",
        "policy_change_restricted_actors",
        "operated_by",
    }

    def test_scenario_result_fields(self) -> None:
        STORE.reset()
        client = authenticated_client("red_team")
        resp = client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(
            set(data.keys()),
            self.EXPECTED_FIELDS,
            f"extra={set(data.keys()) - self.EXPECTED_FIELDS}, "
            f"missing={self.EXPECTED_FIELDS - set(data.keys())}",
        )


if __name__ == "__main__":
    unittest.main()
