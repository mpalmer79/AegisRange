"""Phase 4 — end-to-end command flow for scenarios 002–006.

For each remaining scenario we assert:
- The red-side attack commands parse, dispatch, and land the right
  events / alerts (i.e. the defender pipeline reacts as if the
  scripted adversary had run).
- The blue-side containment verb records the player's decision and
  surfaces ``contain ...`` in ``commands_issued`` (so the frontend's
  ``blueAnyContainByCommand`` objective flips).

These are integration tests — they exercise the full HTTP surface so
schema / router / dispatcher regressions all surface here.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.dependencies import mission_store
from app.main import app
from app.store import STORE


def _start(client: TestClient, scenario_id: str, perspective: str) -> str:
    STORE.reset()
    mission_store.reset()
    resp = client.post(
        "/missions",
        json={
            "scenario_id": scenario_id,
            "perspective": perspective,
            "mode": "sync" if perspective == "blue" else "async",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["run_id"]


def _cmd(client: TestClient, run_id: str, raw: str) -> dict:
    resp = client.post(f"/missions/{run_id}/commands", json={"command": raw})
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestSessionHijackingRed(unittest.TestCase):
    def test_session_reuse_flow(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-session-002", "red")
        # 1. authenticate to get a session
        login = _cmd(
            c,
            rid,
            "attempt login --user bob --from 198.51.100.10 "
            "--password Hunter2_Strong_99!",
        )
        self.assertEqual(login["effects"].get("attempt_result"), "success")

        # 2. replay the session from a different IP
        reuse = _cmd(c, rid, "session reuse --from 203.0.113.55")
        self.assertEqual(reuse["kind"], "ok")
        self.assertIn("replayed", reuse["lines"][0])

        # World should show at least one alert (session anomaly)
        snap = c.get(f"/missions/{rid}").json()
        summary = snap["summary"]
        self.assertIsNotNone(summary)
        self.assertGreaterEqual(summary["alerts_generated"], 1)


class TestBulkDocAccessBlue(unittest.TestCase):
    def test_contain_document_restrict_records_command(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-doc-003", "blue")
        # Blue sync-start already ran the adversary script; alerts exist.
        res = _cmd(
            c,
            rid,
            "contain document --id doc-002 --action restrict --actor user-bob",
        )
        self.assertEqual(res["kind"], "ok")
        self.assertEqual(res["effects"].get("containment_action"), "restrict")
        self.assertIn("contain document", res["commands_issued"])


class TestBulkDocAccessRed(unittest.TestCase):
    def test_red_doc_read_burst(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-doc-003", "red")
        _cmd(
            c,
            rid,
            "attempt login --user bob --from 198.51.100.10 "
            "--password Hunter2_Strong_99!",
        )
        burst = _cmd(c, rid, "doc read --id doc-002 --burst 20")
        self.assertEqual(burst["kind"], "ok")
        self.assertEqual(burst["effects"].get("doc_read_burst"), 20)

        snap = c.get(f"/missions/{rid}").json()
        summary = snap["summary"]
        self.assertIsNotNone(summary)
        self.assertGreaterEqual(summary["events_generated"], 20)
        self.assertGreaterEqual(summary["alerts_generated"], 1)


class TestExfiltrationBlue(unittest.TestCase):
    def test_contain_document_quarantine(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-doc-004", "blue")
        res = _cmd(
            c,
            rid,
            "contain document --id doc-002 --action quarantine",
        )
        self.assertEqual(res["kind"], "ok")
        self.assertEqual(res["effects"].get("containment_action"), "quarantine")


class TestExfiltrationRed(unittest.TestCase):
    def test_read_then_download_chain(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-doc-004", "red")
        _cmd(
            c,
            rid,
            "attempt login --user bob --from 198.51.100.10 "
            "--password Hunter2_Strong_99!",
        )
        for doc_id in ("doc-001", "doc-002", "doc-003"):
            _cmd(c, rid, f"doc read --id {doc_id}")
        for doc_id in ("doc-001", "doc-002", "doc-003"):
            _cmd(c, rid, f"doc download --id {doc_id}")
        snap = c.get(f"/missions/{rid}").json()
        summary = snap["summary"]
        self.assertIsNotNone(summary)
        # Three reads + three downloads + one login = at least 7 events.
        self.assertGreaterEqual(summary["events_generated"], 7)


class TestServiceAbuseBlue(unittest.TestCase):
    def test_contain_service_disable(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-svc-005", "blue")
        res = _cmd(
            c,
            rid,
            "contain service --id svc-data-processor --action disable",
        )
        self.assertEqual(res["kind"], "ok")
        self.assertEqual(res["effects"].get("containment_action"), "disable")


class TestServiceAbuseRed(unittest.TestCase):
    def test_svc_call_trips_detector(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-svc-005", "red")
        for op in (
            "/admin/config",
            "/admin/secrets",
            "/admin/users",
            "/admin/audit",
        ):
            _cmd(c, rid, f"svc call --service svc-data-processor --op {op}")
        snap = c.get(f"/missions/{rid}").json()
        summary = snap["summary"]
        self.assertIsNotNone(summary)
        self.assertGreaterEqual(summary["events_generated"], 4)
        self.assertGreaterEqual(summary["alerts_generated"], 1)


class TestMultiStageRed(unittest.TestCase):
    def test_full_chain(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-corr-006", "red")
        # Credential spray (5 failures) + one success.
        for _ in range(5):
            _cmd(c, rid, "attempt login --user alice --from 203.0.113.10")
        _cmd(
            c,
            rid,
            "attempt login --user alice --from 203.0.113.10 "
            "--password Correct_Horse_42!",
        )
        # Doc access.
        _cmd(c, rid, "doc read --id doc-001 --burst 10")
        _cmd(c, rid, "doc read --id doc-002 --burst 10")
        # Download exfil.
        _cmd(c, rid, "doc download --id doc-001")

        snap = c.get(f"/missions/{rid}").json()
        summary = snap["summary"]
        self.assertIsNotNone(summary)
        # Many events, multiple alerts (auth + doc-access at minimum).
        self.assertGreaterEqual(summary["events_generated"], 25)
        self.assertGreaterEqual(summary["alerts_generated"], 2)


class TestMultiStageBlue(unittest.TestCase):
    def test_any_containment_verb_satisfies(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-corr-006", "blue")
        res = _cmd(
            c,
            rid,
            "contain session --user user-alice --action revoke",
        )
        self.assertEqual(res["kind"], "ok")
        snap = c.get(f"/missions/{rid}").json()
        self.assertIn("contain session", snap["commands_issued"])


class TestHelpIncludesAllNewVerbs(unittest.TestCase):
    def test_blue_help(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-doc-003", "blue")
        overview = c.get(f"/missions/{rid}/help").json()["overview"]
        joined = "\n".join(overview)
        self.assertIn("contain document", joined)
        self.assertIn("contain service", joined)

    def test_red_help(self) -> None:
        c = TestClient(app)
        rid = _start(c, "scn-doc-003", "red")
        overview = c.get(f"/missions/{rid}/help").json()["overview"]
        joined = "\n".join(overview)
        self.assertIn("doc read", joined)
        self.assertIn("doc download", joined)
        self.assertIn("svc call", joined)


if __name__ == "__main__":
    unittest.main()
