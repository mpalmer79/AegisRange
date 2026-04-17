"""Phase 9 — co-op missions (paired red + blue runs sharing a world)."""

from __future__ import annotations

import asyncio
import unittest

from fastapi.testclient import TestClient

from app.dependencies import (
    mission_service,
    mission_store,
    mission_stream_hub,
)
from app.main import app
from app.store import STORE


def _reset() -> None:
    STORE.reset()
    mission_store.reset()


class TestCoopEndpoint(unittest.TestCase):
    def test_coop_creates_paired_runs_sharing_correlation_id(self) -> None:
        _reset()
        c = TestClient(app)
        resp = c.post("/missions/coop", json={"scenario_id": "scn-auth-001"})
        self.assertEqual(resp.status_code, 200, resp.text)
        pair = resp.json()

        self.assertIn("red", pair)
        self.assertIn("blue", pair)
        self.assertEqual(pair["red"]["perspective"], "red")
        self.assertEqual(pair["blue"]["perspective"], "blue")
        # Both runs share one correlation_id (so the detection pipeline
        # sees one world).
        self.assertEqual(pair["red"]["correlation_id"], pair["blue"]["correlation_id"])
        # Partner links cross-point at each other.
        self.assertEqual(pair["red"]["coop_partner_run_id"], pair["blue"]["run_id"])
        self.assertEqual(pair["blue"]["coop_partner_run_id"], pair["red"]["run_id"])
        # Both active at creation — no scheduler task runs for co-op.
        self.assertEqual(pair["red"]["status"], "active")
        self.assertEqual(pair["blue"]["status"], "active")
        # Blue's summary is an empty-world snapshot (no adversary
        # script ran). Compare its events_generated to 0.
        self.assertIsNotNone(pair["blue"]["summary"])
        self.assertEqual(pair["blue"]["summary"]["events_generated"], 0)

    def test_coop_unknown_scenario_404(self) -> None:
        _reset()
        c = TestClient(app)
        resp = c.post("/missions/coop", json={"scenario_id": "scn-nope-999"})
        self.assertEqual(resp.status_code, 404)


class TestCoopCrossStream(unittest.TestCase):
    def test_red_command_mirrors_to_blue_stream(self) -> None:
        async def scenario() -> None:
            _reset()
            c = TestClient(app)
            pair = c.post("/missions/coop", json={"scenario_id": "scn-auth-001"}).json()
            red_id = pair["red"]["run_id"]
            blue_id = pair["blue"]["run_id"]

            # Subscribe to BLUE's stream before Red acts.
            blue_queue = await mission_stream_hub.subscribe(blue_id)

            # Red types an attempt-login. This goes through the HTTP
            # handler which is sync here (TestClient), and the
            # dispatcher publishes a beat on Red's stream AND Blue's.
            resp = c.post(
                f"/missions/{red_id}/commands",
                json={"command": ("attempt login --user alice --from 203.0.113.10")},
            )
            self.assertEqual(resp.status_code, 200)

            # Collect whatever arrived on blue's queue.
            received: list[dict] = []
            while not blue_queue.empty():
                item = blue_queue.get_nowait()
                if isinstance(item, dict):
                    received.append(item)

            # Blue should have at least one beat from red's action;
            # the snapshot attached should scope to Blue's run.
            kinds = [
                e.get("beat", {}).get("kind")
                for e in received
                if e.get("type") == "beat"
            ]
            self.assertTrue(
                any(k == "failed_login" for k in kinds),
                f"expected failed_login beat on blue stream; got kinds={kinds}",
            )

        asyncio.run(scenario())

    def test_blue_command_mirrors_to_red_stream(self) -> None:
        async def scenario() -> None:
            _reset()
            c = TestClient(app)
            pair = c.post("/missions/coop", json={"scenario_id": "scn-auth-001"}).json()
            red_id = pair["red"]["run_id"]
            blue_id = pair["blue"]["run_id"]

            red_queue = await mission_stream_hub.subscribe(red_id)

            # Blue types a containment action. Should mirror to red's
            # stream so the attacker sees they're being responded to.
            resp = c.post(
                f"/missions/{blue_id}/commands",
                json={"command": ("contain session --user user-alice --action revoke")},
            )
            self.assertEqual(resp.status_code, 200)

            received: list[dict] = []
            while not red_queue.empty():
                item = red_queue.get_nowait()
                if isinstance(item, dict):
                    received.append(item)

            labels = [
                e.get("beat", {}).get("label", "")
                for e in received
                if e.get("type") == "beat"
            ]
            self.assertTrue(
                any("contains" in label.lower() for label in labels),
                f"expected contain-session beat on red stream; got labels={labels}",
            )

        asyncio.run(scenario())


class TestCoopWorldSharing(unittest.TestCase):
    def test_red_attacks_land_in_blue_alerts_list(self) -> None:
        _reset()
        c = TestClient(app)
        pair = c.post("/missions/coop", json={"scenario_id": "scn-auth-001"}).json()
        red_id = pair["red"]["run_id"]
        blue_id = pair["blue"]["run_id"]

        # Red drives five failed logins then a success — the legacy
        # shape that trips DET-AUTH-001.
        for _ in range(5):
            c.post(
                f"/missions/{red_id}/commands",
                json={"command": "attempt login --user alice --from 203.0.113.10"},
            )
        c.post(
            f"/missions/{red_id}/commands",
            json={
                "command": (
                    "attempt login --user alice --from 203.0.113.10 "
                    "--password Correct_Horse_42!"
                )
            },
        )

        # Blue's alerts list should now reflect those attacks.
        alerts = c.post(
            f"/missions/{blue_id}/commands",
            json={"command": "alerts list"},
        ).json()
        self.assertEqual(alerts["kind"], "ok")
        joined = "\n".join(alerts["lines"])
        self.assertIn("DET-AUTH", joined)


class TestCoopServiceDirect(unittest.TestCase):
    def test_start_coop_without_persistence(self) -> None:
        _reset()
        red, blue = mission_service.start_coop(
            scenario_id="scn-auth-001",
            difficulty="analyst",
            correlation_id="corr-coop-direct",
        )
        self.assertEqual(red.perspective, "red")
        self.assertEqual(blue.perspective, "blue")
        self.assertEqual(red.correlation_id, blue.correlation_id)
        self.assertEqual(red.coop_partner_run_id, blue.run_id)
        self.assertEqual(blue.coop_partner_run_id, red.run_id)


if __name__ == "__main__":
    unittest.main()
