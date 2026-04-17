"""Mission router + service: Phase 1 contract."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


class MissionApiTestBase(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        mission_store.reset()
        self.client = TestClient(app)


class TestStartMission(MissionApiTestBase):
    """``POST /missions`` creates a run. In ``async`` mode (default) it
    returns immediately with ``status=active``; in ``sync`` mode it
    runs the scenario inline and returns a completed snapshot."""

    def test_sync_start_returns_run_id_and_summary(self) -> None:
        resp = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "mode": "sync"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["run_id"].startswith("run-"))
        self.assertEqual(data["scenario_id"], "scn-auth-001")
        self.assertEqual(data["perspective"], "blue")
        self.assertEqual(data["difficulty"], "analyst")
        self.assertEqual(data["status"], "complete")
        self.assertIsNotNone(data["summary"])
        self.assertEqual(data["summary"]["scenario_id"], "SCN-AUTH-001")
        self.assertGreater(data["summary"]["events_generated"], 0)
        self.assertGreaterEqual(data["summary"]["alerts_generated"], 1)
        self.assertIsNotNone(data["summary"]["incident_id"])

    def test_async_start_returns_active(self) -> None:
        resp = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["run_id"].startswith("run-"))
        self.assertEqual(data["status"], "active")
        self.assertIsNone(data["summary"])

    def test_start_accepts_perspective_and_difficulty(self) -> None:
        resp = self.client.post(
            "/missions",
            json={
                "scenario_id": "scn-doc-003",
                "perspective": "red",
                "difficulty": "operator",
                "mode": "sync",
            },
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data["perspective"], "red")
        self.assertEqual(data["difficulty"], "operator")

    def test_unknown_scenario_returns_404(self) -> None:
        resp = self.client.post(
            "/missions",
            json={"scenario_id": "scn-nope-999", "mode": "sync"},
        )
        self.assertEqual(resp.status_code, 404)

    def test_all_six_scenarios_launch_sync(self) -> None:
        for scenario_id in [
            "scn-auth-001",
            "scn-session-002",
            "scn-doc-003",
            "scn-doc-004",
            "scn-svc-005",
            "scn-corr-006",
        ]:
            STORE.reset()
            mission_store.reset()
            resp = self.client.post(
                "/missions",
                json={"scenario_id": scenario_id, "mode": "sync"},
            )
            self.assertEqual(resp.status_code, 200, f"{scenario_id}: {resp.text}")
            self.assertTrue(resp.json()["run_id"])
            self.assertEqual(resp.json()["status"], "complete")

    def test_anonymous_start_is_allowed(self) -> None:
        """No auth header, no cookie — mission must still start."""
        resp = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "mode": "sync"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.json()["operated_by"])


class TestGetMission(MissionApiTestBase):
    def test_fetch_snapshot_by_run_id(self) -> None:
        start = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "mode": "sync"},
        )
        run_id = start.json()["run_id"]

        resp = self.client.get(f"/missions/{run_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["run_id"], run_id)
        self.assertEqual(resp.json()["status"], "complete")

    def test_unknown_run_id_is_404(self) -> None:
        resp = self.client.get("/missions/run-does-not-exist")
        self.assertEqual(resp.status_code, 404)


class TestGetMissionIncident(MissionApiTestBase):
    """Anonymous read of the run's incident — the Phase 1 bug-fix path."""

    def test_incident_readable_without_auth(self) -> None:
        start = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "mode": "sync"},
        )
        run_id = start.json()["run_id"]

        resp = self.client.get(f"/missions/{run_id}/incident")
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("incident_id", body)
        self.assertIn("correlation_id", body)
        self.assertEqual(body["correlation_id"], start.json()["correlation_id"])

    def test_unknown_run_is_404(self) -> None:
        resp = self.client.get("/missions/run-bogus/incident")
        self.assertEqual(resp.status_code, 404)

    def test_no_incident_returns_404(self) -> None:
        """Synthesize a run that didn't actually produce an incident by
        launching a scenario then wiping STORE incidents. Exercises the
        'mission exists but no incident' branch."""
        start = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "mode": "sync"},
        )
        run_id = start.json()["run_id"]
        STORE.incidents_by_correlation.clear()

        resp = self.client.get(f"/missions/{run_id}/incident")
        self.assertEqual(resp.status_code, 404)


class TestLegacyScenariosRoute(MissionApiTestBase):
    """``POST /scenarios/{id}`` should now include ``run_id`` in the
    response while preserving the legacy summary shape."""

    def test_legacy_response_includes_run_id(self) -> None:
        resp = self.client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertTrue(body["run_id"].startswith("run-"))
        self.assertEqual(body["scenario_id"], "SCN-AUTH-001")
        # Legacy summary fields must still be present.
        for key in (
            "correlation_id",
            "events_total",
            "alerts_total",
            "responses_total",
            "incident_id",
            "step_up_required",
            "revoked_sessions",
        ):
            self.assertIn(key, body, f"missing legacy key: {key}")

    def test_legacy_run_id_fetches_incident(self) -> None:
        resp = self.client.post("/scenarios/scn-auth-001")
        run_id = resp.json()["run_id"]

        inc = self.client.get(f"/missions/{run_id}/incident")
        self.assertEqual(inc.status_code, 200)


if __name__ == "__main__":
    unittest.main()
