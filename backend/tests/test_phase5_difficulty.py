"""Phase 5 — difficulty-driven intel reduction + penalties.

The three ranks were cosmetic before Phase 5 (only XP multiplier and
scheduler pacing differed). Phase 5 makes difficulty shape gameplay:
- ``recon users`` output shrinks from full intel (Recruit) to a bare
  count (Operator).
- Operator penalises sloppy typing with a −1 XP adjustment per
  unknown-verb / unknown-subcommand parse failure. Lighter ranks let
  parse errors slide so players can explore.

Hint XP costs are already covered by test_mission_commands.py; this
file focuses on the new behaviours.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


def _start(client: TestClient, difficulty: str) -> str:
    STORE.reset()
    mission_store.reset()
    resp = client.post(
        "/missions",
        json={
            "scenario_id": "scn-auth-001",
            "perspective": "red",
            "difficulty": difficulty,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["run_id"]


class TestReconIntelReduction(unittest.TestCase):
    def test_recruit_reveals_known_passwords(self) -> None:
        c = TestClient(app)
        rid = _start(c, "recruit")
        body = c.post(
            f"/missions/{rid}/commands", json={"command": "recon users"}
        ).json()
        joined = "\n".join(body["lines"])
        self.assertIn("Correct_Horse_42!", joined)
        self.assertIn("Hunter2_Strong_99!", joined)

    def test_analyst_shows_users_and_roles_only(self) -> None:
        c = TestClient(app)
        rid = _start(c, "analyst")
        body = c.post(
            f"/missions/{rid}/commands", json={"command": "recon users"}
        ).json()
        joined = "\n".join(body["lines"])
        self.assertIn("user-alice", joined)
        self.assertIn("user-bob", joined)
        # No credential leakage at Analyst.
        self.assertNotIn("Correct_Horse_42!", joined)
        self.assertNotIn("Hunter2_Strong_99!", joined)

    def test_operator_gives_only_a_count(self) -> None:
        c = TestClient(app)
        rid = _start(c, "operator")
        body = c.post(
            f"/missions/{rid}/commands", json={"command": "recon users"}
        ).json()
        joined = "\n".join(body["lines"])
        self.assertIn("2 identities detected", joined)
        self.assertNotIn("user-alice", joined)
        self.assertNotIn("user-bob", joined)


class TestOperatorUnknownVerbPenalty(unittest.TestCase):
    def test_operator_loses_xp_on_unknown_verb(self) -> None:
        c = TestClient(app)
        rid = _start(c, "operator")

        before = c.get(f"/missions/{rid}").json()["xp_delta"]
        self.assertEqual(before, 0)

        resp = c.post(f"/missions/{rid}/commands", json={"command": "flibber"}).json()
        self.assertEqual(resp["kind"], "error")
        self.assertEqual(resp["xp_delta"], -1)

        # A second sloppy type stacks.
        resp2 = c.post(
            f"/missions/{rid}/commands",
            json={"command": "alerts tornado"},  # unknown_subcommand
        ).json()
        self.assertEqual(resp2["xp_delta"], -2)

    def test_recruit_free_on_unknown_verb(self) -> None:
        c = TestClient(app)
        rid = _start(c, "recruit")
        resp = c.post(f"/missions/{rid}/commands", json={"command": "flibber"}).json()
        self.assertEqual(resp["kind"], "error")
        self.assertEqual(resp["xp_delta"], 0)

    def test_analyst_free_on_unknown_verb(self) -> None:
        c = TestClient(app)
        rid = _start(c, "analyst")
        resp = c.post(f"/missions/{rid}/commands", json={"command": "flibber"}).json()
        self.assertEqual(resp["kind"], "error")
        self.assertEqual(resp["xp_delta"], 0)


if __name__ == "__main__":
    unittest.main()
