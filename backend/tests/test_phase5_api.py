"""Phase 5: API tests for analytics, notes, and export endpoints."""

from __future__ import annotations

import unittest

from app.store import STORE
from tests.auth_helper import authenticated_client


class APITestBase(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client()


class TestRiskProfilesEndpoint(APITestBase):
    def test_risk_profiles_empty(self) -> None:
        resp = self.client.get("/analytics/risk-profiles")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_risk_profiles_after_scenario(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/analytics/risk-profiles")
        self.assertEqual(resp.status_code, 200)
        profiles = resp.json()
        self.assertGreater(len(profiles), 0)
        self.assertIn("current_score", profiles[0])
        self.assertIn("actor_id", profiles[0])

    def test_risk_profile_by_actor(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/analytics/risk-profiles/user-alice")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["actor_id"], "user-alice")
        self.assertGreater(data["current_score"], 0)

    def test_risk_profile_not_found(self) -> None:
        resp = self.client.get("/analytics/risk-profiles/user-nobody")
        self.assertEqual(resp.status_code, 404)


class TestRuleEffectivenessEndpoint(APITestBase):
    def test_rule_effectiveness_empty(self) -> None:
        resp = self.client.get("/analytics/rule-effectiveness")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_rule_effectiveness_after_scenario(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/analytics/rule-effectiveness")
        self.assertEqual(resp.status_code, 200)
        rules = resp.json()
        self.assertGreater(len(rules), 0)
        self.assertIn("rule_id", rules[0])
        self.assertIn("trigger_count", rules[0])
        self.assertIn("actors_affected", rules[0])


class TestScenarioHistoryEndpoint(APITestBase):
    def test_scenario_history_empty(self) -> None:
        resp = self.client.get("/analytics/scenario-history")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_scenario_history_after_runs(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        self.client.post("/scenarios/scn-svc-005")
        resp = self.client.get("/analytics/scenario-history")
        self.assertEqual(resp.status_code, 200)
        history = resp.json()
        self.assertEqual(len(history), 2)
        self.assertIn("executed_at", history[0])


class TestIncidentNotesEndpoint(APITestBase):
    def test_add_note(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.post(
            f"/incidents/{corr}/notes",
            json={
                "author": "analyst-1",
                "content": "Investigated and confirmed credential abuse.",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Author is now attributed to the authenticated platform user, not the client-supplied value
        self.assertEqual(data["author"], "admin")
        self.assertIn("note_id", data)

    def test_get_notes(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        self.client.post(
            f"/incidents/{corr}/notes",
            json={"author": "analyst-1", "content": "First note"},
        )
        self.client.post(
            f"/incidents/{corr}/notes",
            json={"author": "analyst-2", "content": "Second note"},
        )

        resp = self.client.get(f"/incidents/{corr}/notes")
        self.assertEqual(resp.status_code, 200)
        notes = resp.json()
        self.assertEqual(len(notes), 2)

    def test_add_note_nonexistent_incident(self) -> None:
        resp = self.client.post(
            "/incidents/nonexistent/notes",
            json={"author": "analyst-1", "content": "Note"},
        )
        self.assertEqual(resp.status_code, 404)

    def test_note_appears_in_timeline(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        self.client.post(
            f"/incidents/{corr}/notes",
            json={"author": "analyst-1", "content": "Investigation note"},
        )

        resp = self.client.get(f"/incidents/{corr}")
        timeline = resp.json()["timeline"]
        note_entries = [e for e in timeline if e["entry_type"] == "analyst_note"]
        self.assertGreater(len(note_entries), 0)

    def test_notes_in_incident_detail(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        self.client.post(
            f"/incidents/{corr}/notes",
            json={"author": "analyst-1", "content": "Test note"},
        )

        resp = self.client.get(f"/incidents/{corr}")
        data = resp.json()
        self.assertIn("notes", data)
        self.assertEqual(len(data["notes"]), 1)


class TestEventExportEndpoint(APITestBase):
    def test_export_empty(self) -> None:
        resp = self.client.get("/events/export")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_events"], 0)
        self.assertEqual(data["events"], [])
        self.assertIn("export_timestamp", data)

    def test_export_after_scenario(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/events/export")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["total_events"], 0)
        self.assertEqual(len(data["events"]), data["total_events"])

    def test_export_with_filter(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.get("/events/export", params={"correlation_id": corr})
        data = resp.json()
        self.assertGreater(data["total_events"], 0)
        self.assertTrue(all(e["correlation_id"] == corr for e in data["events"]))


class TestIncidentRiskScore(APITestBase):
    def test_incident_has_risk_score(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.get(f"/incidents/{corr}")
        data = resp.json()
        self.assertIn("risk_score", data)
        # Risk score should be set by the risk scoring engine
        self.assertIsNotNone(data["risk_score"])
        self.assertGreater(data["risk_score"], 0)


if __name__ == "__main__":
    unittest.main()
