"""Phase 6 — transcript export + tutorial scenario."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


class TestTranscriptEndpoint(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        mission_store.reset()
        self.client = TestClient(app)
        start = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "mode": "sync"},
        )
        self.assertEqual(start.status_code, 200, start.text)
        self.run_id = start.json()["run_id"]

    def test_empty_transcript_has_header(self) -> None:
        resp = self.client.get(f"/missions/{self.run_id}/transcript")
        self.assertEqual(resp.status_code, 200)
        # Content-type should be plain text so the browser won't try to
        # parse it as JSON on save.
        self.assertTrue(resp.headers["content-type"].startswith("text/plain"))
        body = resp.text
        self.assertIn(self.run_id, body)
        self.assertIn("scn-auth-001", body)
        self.assertIn("no commands issued", body)

    def test_transcript_includes_commands_and_output(self) -> None:
        self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "alerts list"},
        )
        self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "contain session --user user-alice --action revoke"},
        )
        body = self.client.get(f"/missions/{self.run_id}/transcript").text
        self.assertIn("ops> alerts list", body)
        self.assertIn("ops> contain session --user user-alice --action revoke", body)
        # Output lines are indented in the transcript.
        self.assertIn("Revoked", body)

    def test_transcript_404_for_unknown_run(self) -> None:
        resp = self.client.get("/missions/run-bogus/transcript")
        self.assertEqual(resp.status_code, 404)


class TestTutorialScenario(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        mission_store.reset()
        self.client = TestClient(app)

    def test_tutorial_scenario_launches(self) -> None:
        resp = self.client.post(
            "/missions",
            json={"scenario_id": "scn-tutorial-000", "mode": "sync"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "scn-tutorial-000")
        self.assertEqual(data["summary"]["scenario_id"], "SCN-TUTORIAL-000")
        # Single failed-login event — the tutorial is deliberately quiet.
        self.assertEqual(data["summary"]["events_generated"], 1)
        # No alerts or incident — the tutorial's goal is to teach the
        # console, not to exercise detection.
        self.assertEqual(data["summary"]["alerts_generated"], 0)
        self.assertIsNone(data["summary"]["incident_id"])

    def test_tutorial_hint_returns_tutorial_playbook(self) -> None:
        resp = self.client.post(
            "/missions",
            json={
                "scenario_id": "scn-tutorial-000",
                "difficulty": "recruit",
                "mode": "sync",
            },
        )
        run_id = resp.json()["run_id"]
        hint = self.client.post(
            f"/missions/{run_id}/commands",
            json={"command": "hint"},
        ).json()
        joined = "\n".join(hint["lines"])
        self.assertIn("alerts list", joined)

    def test_tutorial_all_four_commands_work(self) -> None:
        resp = self.client.post(
            "/missions",
            json={"scenario_id": "scn-tutorial-000", "mode": "sync"},
        )
        run_id = resp.json()["run_id"]
        for cmd in (
            "alerts list",
            "events tail",
            "status",
            "contain session --user user-alice --action revoke",
        ):
            r = self.client.post(f"/missions/{run_id}/commands", json={"command": cmd})
            self.assertEqual(r.status_code, 200, f"{cmd}: {r.text}")
            self.assertEqual(r.json()["kind"], "ok", f"{cmd} failed")


if __name__ == "__main__":
    unittest.main()
