"""Red-team flow — scn-auth-001 intruder perspective.

Covers the Phase 3b contract:
- ``POST /missions`` with ``perspective='red'`` starts a run without
  pre-emitting the adversary script.
- ``recon users`` returns a transcript, no world mutation.
- ``attempt login`` emits the right event kind based on whether
  ``--password`` matches the real secret.
- After enough attempts the defender's auto-response trips
  (``step_up_required`` / revoked_sessions) — the same signal the red
  side's objectives read.
- ``session reuse`` refuses without a prior successful login and
  succeeds once one has landed.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


class RedTeamFlowTestBase(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        mission_store.reset()
        self.client = TestClient(app)
        start = self.client.post(
            "/missions",
            json={
                "scenario_id": "scn-auth-001",
                "perspective": "red",
                "mode": "sync",
            },
        )
        self.assertEqual(start.status_code, 200, start.text)
        body = start.json()
        self.run_id = body["run_id"]
        # Sanity: sync-mode still works for tests, and the run is
        # tagged 'red' end to end.
        self.assertEqual(body["perspective"], "red")

    def _cmd(self, raw: str) -> dict:
        resp = self.client.post(
            f"/missions/{self.run_id}/commands", json={"command": raw}
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        return resp.json()


class TestRedTeamGrammar(RedTeamFlowTestBase):
    def test_recon_users_is_free(self) -> None:
        before = self.client.get(f"/missions/{self.run_id}").json()
        body = self._cmd("recon users")
        self.assertEqual(body["kind"], "ok")
        joined = "\n".join(body["lines"])
        self.assertIn("user-alice", joined)
        self.assertIn("user-bob", joined)
        # No world mutation — event counts unchanged (they are non-zero
        # because sync-mode already ran the scripted adversary; we just
        # assert recon itself did not add any events or alerts).
        after = self.client.get(f"/missions/{self.run_id}").json()
        assert before["summary"] is not None
        assert after["summary"] is not None
        self.assertEqual(
            after["summary"]["events_generated"],
            before["summary"]["events_generated"],
        )

    def test_blue_verbs_unavailable_from_red(self) -> None:
        body = self._cmd("alerts list")
        self.assertEqual(body["kind"], "error")
        self.assertTrue(
            "Unknown command" in body["lines"][0]
            or "unknown subcommand" in body["lines"][0].lower(),
            body["lines"],
        )


class TestAttemptLogin(RedTeamFlowTestBase):
    def test_missing_password_emits_failure(self) -> None:
        # sync-mode already produced a complete blue run for the same
        # correlation id. We reset stores + start fresh to isolate.
        STORE.reset()
        mission_store.reset()
        self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        new = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        run_id = new.json()["run_id"]

        resp = self.client.post(
            f"/missions/{run_id}/commands",
            json={"command": "attempt login --user alice --from 203.0.113.10"},
        )
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        self.assertIn("401", body["lines"][0])
        self.assertEqual(body["effects"]["attempt_result"], "failure")

    def test_correct_password_emits_success(self) -> None:
        STORE.reset()
        mission_store.reset()
        new = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        run_id = new.json()["run_id"]

        resp = self.client.post(
            f"/missions/{run_id}/commands",
            json={
                "command": (
                    "attempt login --user alice --from 203.0.113.10 "
                    "--password Correct_Horse_42!"
                ),
            },
        )
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        self.assertIn("200", body["lines"][0])
        self.assertEqual(body["effects"]["attempt_result"], "success")

    def test_many_failed_attempts_trip_auto_response(self) -> None:
        STORE.reset()
        mission_store.reset()
        new = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        run_id = new.json()["run_id"]

        # Five failures then one success — same shape as the scripted
        # adversary, just player-driven. Detection + auto-response
        # should fire.
        for _ in range(5):
            self.client.post(
                f"/missions/{run_id}/commands",
                json={
                    "command": "attempt login --user alice --from 203.0.113.10",
                },
            )
        self.client.post(
            f"/missions/{run_id}/commands",
            json={
                "command": (
                    "attempt login --user alice --from 203.0.113.10 "
                    "--password Correct_Horse_42!"
                ),
            },
        )

        snap = self.client.get(f"/missions/{run_id}").json()
        # status stays 'active' — red missions do not auto-complete.
        self.assertEqual(snap["status"], "active")
        # But the defender's world state *does* show containment tripped:
        # this is what the red-side "Force a defensive response"
        # objective keys on.
        summary = snap["summary"]
        self.assertIsNotNone(summary)
        tripped = (
            summary["step_up_required"]
            or len(summary["revoked_sessions"]) > 0
            or len(summary["download_restricted_actors"]) > 0
        )
        self.assertTrue(
            tripped,
            f"expected defender auto-response; got summary={summary}",
        )


class TestSessionReuse(RedTeamFlowTestBase):
    def test_session_reuse_requires_prior_login(self) -> None:
        STORE.reset()
        mission_store.reset()
        new = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        run_id = new.json()["run_id"]

        resp = self.client.post(
            f"/missions/{run_id}/commands",
            json={"command": "session reuse --from 198.51.100.10"},
        )
        body = resp.json()
        self.assertEqual(body["kind"], "error")
        self.assertIn("attempt login", body["lines"][0])

    def test_session_reuse_after_successful_login(self) -> None:
        STORE.reset()
        mission_store.reset()
        new = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        run_id = new.json()["run_id"]

        self.client.post(
            f"/missions/{run_id}/commands",
            json={
                "command": (
                    "attempt login --user alice --from 203.0.113.10 "
                    "--password Correct_Horse_42!"
                ),
            },
        )
        resp = self.client.post(
            f"/missions/{run_id}/commands",
            json={"command": "session reuse --from 203.0.113.55"},
        )
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        self.assertIn("replayed", body["lines"][0])


class TestRedHelpAndHints(RedTeamFlowTestBase):
    def test_help_lists_red_verbs(self) -> None:
        STORE.reset()
        mission_store.reset()
        new = self.client.post(
            "/missions",
            json={"scenario_id": "scn-auth-001", "perspective": "red"},
        )
        run_id = new.json()["run_id"]

        resp = self.client.post(
            f"/missions/{run_id}/commands", json={"command": "help"}
        )
        joined = "\n".join(resp.json()["lines"])
        self.assertIn("recon users", joined)
        self.assertIn("attempt login", joined)
        # Blue verbs must NOT leak into the red help surface.
        self.assertNotIn("contain session", joined)
        self.assertNotIn("alerts list", joined)

    def test_hint_returns_red_playbook(self) -> None:
        STORE.reset()
        mission_store.reset()
        new = self.client.post(
            "/missions",
            json={
                "scenario_id": "scn-auth-001",
                "perspective": "red",
                "difficulty": "recruit",
            },
        )
        run_id = new.json()["run_id"]

        resp = self.client.post(
            f"/missions/{run_id}/commands", json={"command": "hint"}
        )
        body = resp.json()
        self.assertEqual(body["kind"], "ok")
        joined = "\n".join(body["lines"])
        # First-step hint points at recon.
        self.assertIn("recon users", joined)
        # Recruit → zero XP cost.
        self.assertEqual(body["xp_delta"], 0)


if __name__ == "__main__":
    unittest.main()
