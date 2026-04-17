"""Phase 8 — score reporting, leaderboard, replay."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


def _start(client: TestClient, **opts: str) -> str:
    STORE.reset()
    mission_store.reset()
    payload = {
        "scenario_id": opts.get("scenario_id", "scn-auth-001"),
        "perspective": opts.get("perspective", "blue"),
        "difficulty": opts.get("difficulty", "analyst"),
        "mode": "sync",
    }
    resp = client.post("/missions", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()["run_id"]


class TestScoreReporting(unittest.TestCase):
    def test_post_score_populates_snapshot(self) -> None:
        c = TestClient(app)
        run_id = _start(c)
        resp = c.post(
            f"/missions/{run_id}/score",
            json={"score": 160, "duration_seconds": 42},
        )
        self.assertEqual(resp.status_code, 200, resp.text)

        snap = c.get(f"/missions/{run_id}").json()
        self.assertEqual(snap["status"], "complete")

    def test_score_unknown_run_404(self) -> None:
        c = TestClient(app)
        resp = c.post("/missions/run-bogus/score", json={"score": 50})
        self.assertEqual(resp.status_code, 404)


class TestLeaderboard(unittest.TestCase):
    def _score(self, c: TestClient, run_id: str, score: int, duration: int) -> None:
        c.post(
            f"/missions/{run_id}/score",
            json={"score": score, "duration_seconds": duration},
        )

    def test_leaderboard_sorts_highest_first_then_fastest(self) -> None:
        # `_start()` clears both STORE and mission_store, so using it
        # between scores would wipe earlier runs before the leaderboard
        # could see them. Here we reset once, then create 4 sync-mode
        # missions against the shared mission_store, resetting only
        # STORE between them for world isolation.
        mission_store.reset()
        STORE.reset()
        c = TestClient(app)
        for score_val, duration_val in [(100, 60), (200, 90), (200, 30), (50, 10)]:
            STORE.reset()  # fresh world per run; mission_store untouched
            run_id = c.post(
                "/missions",
                json={
                    "scenario_id": "scn-auth-001",
                    "perspective": "blue",
                    "difficulty": "analyst",
                    "mode": "sync",
                },
            ).json()["run_id"]
            self._score(c, run_id, score_val, duration_val)

        lb = c.get(
            "/missions/leaderboard",
            params={
                "scenario_id": "scn-auth-001",
                "perspective": "blue",
                "difficulty": "analyst",
                "limit": 10,
            },
        ).json()["entries"]

        # Expect order: score desc, duration asc.
        self.assertEqual(len(lb), 4)
        self.assertEqual(lb[0]["score"], 200)
        self.assertEqual(lb[0]["duration_seconds"], 30)  # faster of the two 200s
        self.assertEqual(lb[1]["score"], 200)
        self.assertEqual(lb[1]["duration_seconds"], 90)
        self.assertEqual(lb[2]["score"], 100)
        self.assertEqual(lb[3]["score"], 50)

    def test_leaderboard_filters_by_perspective(self) -> None:
        mission_store.reset()
        STORE.reset()
        c = TestClient(app)

        # One blue, one red.
        STORE.reset()
        b = c.post(
            "/missions",
            json={
                "scenario_id": "scn-auth-001",
                "perspective": "blue",
                "difficulty": "analyst",
                "mode": "sync",
            },
        ).json()["run_id"]
        c.post(f"/missions/{b}/score", json={"score": 150, "duration_seconds": 60})

        STORE.reset()
        r = c.post(
            "/missions",
            json={
                "scenario_id": "scn-auth-001",
                "perspective": "red",
                "difficulty": "analyst",
                "mode": "sync",
            },
        ).json()["run_id"]
        c.post(f"/missions/{r}/score", json={"score": 999, "duration_seconds": 10})

        blue_lb = c.get(
            "/missions/leaderboard",
            params={
                "scenario_id": "scn-auth-001",
                "perspective": "blue",
            },
        ).json()["entries"]
        self.assertEqual(len(blue_lb), 1)
        self.assertEqual(blue_lb[0]["run_id"], b)

    def test_leaderboard_excludes_runs_without_score(self) -> None:
        mission_store.reset()
        STORE.reset()
        c = TestClient(app)
        # Launch but DON'T score.
        c.post(
            "/missions",
            json={
                "scenario_id": "scn-auth-001",
                "perspective": "blue",
                "difficulty": "analyst",
                "mode": "sync",
            },
        )
        lb = c.get(
            "/missions/leaderboard",
            params={"scenario_id": "scn-auth-001"},
        ).json()["entries"]
        self.assertEqual(lb, [])


class TestReplay(unittest.TestCase):
    def test_replay_returns_command_history(self) -> None:
        c = TestClient(app)
        run_id = _start(c)
        c.post(f"/missions/{run_id}/commands", json={"command": "alerts list"})
        c.post(
            f"/missions/{run_id}/commands",
            json={"command": "contain session --user user-alice --action revoke"},
        )

        replay = c.get(f"/missions/{run_id}/replay").json()
        self.assertEqual(replay["run_id"], run_id)
        self.assertEqual(len(replay["commands"]), 2)
        self.assertEqual(replay["commands"][0]["verb_key"], "alerts list")
        self.assertEqual(replay["commands"][1]["verb_key"], "contain session")

    def test_replay_404_for_unknown_run(self) -> None:
        c = TestClient(app)
        resp = c.get("/missions/run-bogus/replay")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
