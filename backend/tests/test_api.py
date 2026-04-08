"""1E.4: API route tests via FastAPI TestClient."""
from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app, STORE


class APITestBase(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.client = TestClient(app)


class TestHealthEndpoint(APITestBase):
    def test_health_returns_ok(self) -> None:
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("timestamp", data)


class TestLoginEndpoint(APITestBase):
    def test_successful_login(self) -> None:
        resp = self.client.post("/identity/login", json={"username": "alice", "password": "correct-horse"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["actor_id"], "user-alice")
        self.assertIsNotNone(data["session_id"])

    def test_failed_login(self) -> None:
        resp = self.client.post("/identity/login", json={"username": "alice", "password": "wrong"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["success"])

    def test_unknown_user(self) -> None:
        resp = self.client.post("/identity/login", json={"username": "unknown", "password": "x"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["success"])

    def test_login_emits_event(self) -> None:
        self.client.post("/identity/login", json={"username": "alice", "password": "correct-horse"})
        self.assertGreater(len(STORE.events), 0)
        self.assertEqual(STORE.events[0].event_type, "authentication.login.success")


class TestSessionRevocation(APITestBase):
    def test_revoke_existing_session(self) -> None:
        login_resp = self.client.post("/identity/login", json={"username": "bob", "password": "hunter2"})
        session_id = login_resp.json()["session_id"]

        resp = self.client.post(f"/identity/sessions/{session_id}/revoke")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "revoked")
        self.assertIn(session_id, STORE.revoked_sessions)

    def test_revoke_nonexistent_session(self) -> None:
        resp = self.client.post("/identity/sessions/fake-session/revoke")
        self.assertEqual(resp.status_code, 404)


class TestDocumentRead(APITestBase):
    def test_read_public_document(self) -> None:
        resp = self.client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["allowed"])

    def test_read_restricted_denied(self) -> None:
        resp = self.client.post(
            "/documents/doc-003/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["allowed"])

    def test_read_nonexistent_document(self) -> None:
        resp = self.client.post(
            "/documents/doc-999/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 404)

    def test_read_blocked_when_step_up_required(self) -> None:
        STORE.step_up_required.add("user-alice")
        resp = self.client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_read_blocked_when_session_revoked(self) -> None:
        STORE.revoked_sessions.add("session-abc")
        resp = self.client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst", "session_id": "session-abc"},
        )
        self.assertEqual(resp.status_code, 401)


class TestDocumentDownload(APITestBase):
    def test_download_allowed(self) -> None:
        resp = self.client.post(
            "/documents/doc-001/download",
            json={"actor_id": "user-bob", "actor_role": "admin"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["allowed"])

    def test_download_restricted_actor(self) -> None:
        STORE.download_restricted_actors.add("user-bob")
        resp = self.client.post(
            "/documents/doc-001/download",
            json={"actor_id": "user-bob", "actor_role": "admin"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["allowed"])

    def test_download_nonexistent(self) -> None:
        resp = self.client.post(
            "/documents/doc-999/download",
            json={"actor_id": "user-bob", "actor_role": "admin"},
        )
        self.assertEqual(resp.status_code, 404)


class TestScenarioEndpoints(APITestBase):
    def test_scn_auth_001(self) -> None:
        resp = self.client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "SCN-AUTH-001")
        self.assertIsNotNone(data["incident_id"])
        self.assertTrue(data["step_up_required"])

    def test_scn_session_002(self) -> None:
        resp = self.client.post("/scenarios/scn-session-002")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "SCN-SESSION-002")
        self.assertGreater(len(data["revoked_sessions"]), 0)

    def test_scn_doc_003(self) -> None:
        resp = self.client.post("/scenarios/scn-doc-003")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "SCN-DOC-003")
        self.assertIn("user-bob", data["download_restricted_actors"])

    def test_scn_doc_004(self) -> None:
        resp = self.client.post("/scenarios/scn-doc-004")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "SCN-DOC-004")
        self.assertIn("user-bob", data["download_restricted_actors"])


class TestEventsEndpoint(APITestBase):
    def test_events_empty(self) -> None:
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_events_after_login(self) -> None:
        self.client.post("/identity/login", json={"username": "alice", "password": "correct-horse"})
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 200)
        events = resp.json()
        self.assertGreater(len(events), 0)
        self.assertEqual(events[0]["actor_id"], "user-alice")

    def test_events_filter_by_actor(self) -> None:
        self.client.post("/identity/login", json={"username": "alice", "password": "correct-horse"})
        self.client.post("/identity/login", json={"username": "bob", "password": "hunter2"})
        resp = self.client.get("/events", params={"actor_id": "user-alice"})
        events = resp.json()
        self.assertTrue(all(e["actor_id"] == "user-alice" for e in events))

    def test_events_filter_by_type(self) -> None:
        self.client.post("/identity/login", json={"username": "alice", "password": "wrong"})
        self.client.post("/identity/login", json={"username": "alice", "password": "correct-horse"})
        resp = self.client.get("/events", params={"event_type": "authentication.login.failure"})
        events = resp.json()
        self.assertTrue(all(e["event_type"] == "authentication.login.failure" for e in events))


class TestAlertsEndpoint(APITestBase):
    def test_alerts_empty(self) -> None:
        resp = self.client.get("/alerts")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_alerts_after_scenario(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/alerts")
        self.assertEqual(resp.status_code, 200)
        alerts = resp.json()
        self.assertGreater(len(alerts), 0)

    def test_alerts_filter_by_rule_id(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/alerts", params={"rule_id": "DET-AUTH-002"})
        alerts = resp.json()
        self.assertTrue(all(a["rule_id"] == "DET-AUTH-002" for a in alerts))


class TestIncidentsEndpoints(APITestBase):
    def test_incidents_list_empty(self) -> None:
        resp = self.client.get("/incidents")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_incident_created_by_scenario(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.get(f"/incidents/{corr}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "open")
        self.assertGreater(len(data["timeline"]), 0)

    def test_incident_not_found(self) -> None:
        resp = self.client.get("/incidents/nonexistent-corr")
        self.assertEqual(resp.status_code, 404)

    def test_incident_status_transition(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.patch(f"/incidents/{corr}/status", json={"status": "investigating"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "investigating")

        resp = self.client.patch(f"/incidents/{corr}/status", json={"status": "contained"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "contained")
        self.assertEqual(resp.json()["containment_status"], "full")

        resp = self.client.patch(f"/incidents/{corr}/status", json={"status": "resolved"})
        self.assertEqual(resp.status_code, 200)

        resp = self.client.patch(f"/incidents/{corr}/status", json={"status": "closed"})
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(resp.json()["closed_at"])

    def test_invalid_status_transition(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-auth-001")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.patch(f"/incidents/{corr}/status", json={"status": "closed"})
        self.assertEqual(resp.status_code, 400)

    def test_incidents_list_after_scenario(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/incidents")
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.json()), 0)


class TestAdminReset(APITestBase):
    def test_reset_clears_state(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        self.assertGreater(len(STORE.events), 0)

        resp = self.client.post("/admin/reset")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(STORE.events), 0)
        self.assertEqual(len(STORE.alerts), 0)


class TestCorrelationMiddleware(APITestBase):
    def test_correlation_id_generated(self) -> None:
        resp = self.client.get("/health")
        self.assertIn("x-correlation-id", resp.headers)
        self.assertTrue(resp.headers["x-correlation-id"].startswith("corr-"))

    def test_correlation_id_preserved(self) -> None:
        resp = self.client.get("/health", headers={"x-correlation-id": "my-custom-corr"})
        self.assertEqual(resp.headers["x-correlation-id"], "my-custom-corr")


if __name__ == "__main__":
    unittest.main()
