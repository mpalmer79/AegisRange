"""Mission command endpoint — sync start + command dispatch + help.

These tests exercise the full HTTP path so they also catch schema /
router regressions.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


class CommandApiBase(unittest.TestCase):
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


class TestCommandDispatch(CommandApiBase):
    def test_help_without_topic_lists_verbs(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "help"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        joined = "\n".join(body["lines"])
        self.assertIn("alerts list", joined)
        self.assertIn("contain session", joined)
        self.assertIn("hint", joined)

    def test_help_for_specific_verb(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "help contain"},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        self.assertIn("contain session", " ".join(body["lines"]))

    def test_alerts_list_surfaces_real_alerts(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "alerts list"},
        )
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        self.assertTrue(
            any("DET-AUTH" in line for line in body["lines"]),
            f"expected DET-AUTH rule in output, got: {body['lines']}",
        )

    def test_status_reflects_progress(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "status"},
        )
        body = resp.json()
        joined = " ".join(body["lines"])
        self.assertIn(self.run_id, joined)
        self.assertIn("scn-auth-001", joined)

    def test_contain_session_revoke_records_effect(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={
                "command": "contain session --user user-alice --action revoke",
            },
        )
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        self.assertEqual(body["effects"].get("containment_action"), "revoke")
        self.assertIn("contain session", body["commands_issued"])

    def test_contain_session_stepup_records_effect(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={
                "command": "contain session --user user-alice --action stepup",
            },
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["effects"].get("containment_action"), "stepup")

    def test_unknown_command_returns_error_kind(self) -> None:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands",
            json={"command": "flibber"},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["kind"], "error")
        self.assertIn("Unknown command", body["lines"][0])

    def test_unknown_run_id_404(self) -> None:
        resp = self.client.post(
            "/missions/run-bogus/commands", json={"command": "help"}
        )
        self.assertEqual(resp.status_code, 404)

    def test_hint_costs_xp_for_analyst(self) -> None:
        before = self.client.get(f"/missions/{self.run_id}").json()
        self.assertEqual(before["xp_delta"], 0)
        resp = self.client.post(
            f"/missions/{self.run_id}/commands", json={"command": "hint"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["xp_delta"], -10)  # analyst default


class TestMissionHelpEndpoint(CommandApiBase):
    def test_help_endpoint_returns_overview_and_all_verbs(self) -> None:
        resp = self.client.get(f"/missions/{self.run_id}/help")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("overview", body)
        self.assertGreater(len(body["overview"]), 0)
        self.assertIn("alerts list", body["verb_help"])
        self.assertIn("contain session", body["verb_help"])

    def test_help_endpoint_filters_by_topic(self) -> None:
        resp = self.client.get(
            f"/missions/{self.run_id}/help",
            params={"topic": "contain session"},
        )
        body = resp.json()
        self.assertIn("contain session", body["verb_help"])
        # Only the requested topic is returned.
        self.assertEqual(list(body["verb_help"].keys()), ["contain session"])


class TestSnapshotExposesCommandHistory(CommandApiBase):
    def test_snapshot_includes_commands_issued(self) -> None:
        self.client.post(
            f"/missions/{self.run_id}/commands", json={"command": "alerts list"}
        )
        self.client.post(
            f"/missions/{self.run_id}/commands",
            json={
                "command": "contain session --user user-alice --action revoke"
            },
        )
        snap = self.client.get(f"/missions/{self.run_id}").json()
        self.assertIn("alerts list", snap["commands_issued"])
        self.assertIn("contain session", snap["commands_issued"])


if __name__ == "__main__":
    unittest.main()
