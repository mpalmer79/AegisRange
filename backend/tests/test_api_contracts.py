"""Tests verifying API response shapes match the frontend contract.

These tests assert the exact set of fields returned by key endpoints
so that backend serializer changes don't silently break the frontend.
"""

from __future__ import annotations

import unittest

from app.store import STORE
from tests.auth_helper import authenticated_client


class TestHealthContract(unittest.TestCase):
    def test_health_fields(self) -> None:
        client = authenticated_client()
        resp = client.get("/health")
        data = resp.json()
        self.assertEqual(
            set(data.keys()), {"status", "timestamp", "stats", "containment", "persistence"}
        )


class TestAlertContract(unittest.TestCase):
    """Alert dicts should have exactly the canonical fields — no aliases."""

    EXPECTED_FIELDS = {
        "alert_id",
        "rule_id",
        "rule_name",
        "severity",
        "confidence",
        "actor_id",
        "correlation_id",
        "contributing_event_ids",
        "summary",
        "payload",
        "created_at",
    }

    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client("red_team")
        self.client.post("/scenarios/scn-auth-001")

    def test_alert_fields(self) -> None:
        client = authenticated_client("viewer")
        resp = client.get("/alerts")
        self.assertEqual(resp.status_code, 200)
        alerts = resp.json()["items"]
        self.assertGreater(len(alerts), 0, "No alerts to test against")
        for alert in alerts:
            self.assertEqual(
                set(alert.keys()),
                self.EXPECTED_FIELDS,
                f"Alert {alert.get('alert_id')} has unexpected fields: "
                f"extra={set(alert.keys()) - self.EXPECTED_FIELDS}, "
                f"missing={self.EXPECTED_FIELDS - set(alert.keys())}",
            )

    def test_no_alias_fields(self) -> None:
        """Removed aliases should not appear."""
        client = authenticated_client("viewer")
        resp = client.get("/alerts")
        for alert in resp.json()["items"]:
            self.assertNotIn(
                "timestamp",
                alert,
                "Alias 'timestamp' should be removed; use 'created_at'",
            )
            self.assertNotIn(
                "event_ids",
                alert,
                "Alias 'event_ids' should be removed; use 'contributing_event_ids'",
            )
            self.assertNotIn(
                "details", alert, "Alias 'details' should be removed; use 'payload'"
            )


class TestIncidentContract(unittest.TestCase):
    """Incident dicts should have exactly the canonical fields — no aliases."""

    EXPECTED_FIELDS = {
        "incident_id",
        "incident_type",
        "status",
        "primary_actor_id",
        "actor_type",
        "actor_role",
        "correlation_id",
        "severity",
        "confidence",
        "risk_score",
        "detection_ids",
        "detection_summary",
        "response_ids",
        "containment_status",
        "event_ids",
        "affected_documents",
        "affected_sessions",
        "affected_services",
        "affected_resources",
        "timeline",
        "created_at",
        "updated_at",
        "closed_at",
        "notes",
    }

    def setUp(self) -> None:
        STORE.reset()
        client = authenticated_client("red_team")
        client.post("/scenarios/scn-auth-001")

    def test_incident_fields(self) -> None:
        client = authenticated_client("viewer")
        resp = client.get("/incidents")
        self.assertEqual(resp.status_code, 200)
        incidents = resp.json()
        self.assertGreater(len(incidents), 0, "No incidents to test against")
        for inc in incidents:
            self.assertEqual(
                set(inc.keys()),
                self.EXPECTED_FIELDS,
                f"Incident {inc.get('incident_id')} has unexpected fields: "
                f"extra={set(inc.keys()) - self.EXPECTED_FIELDS}, "
                f"missing={self.EXPECTED_FIELDS - set(inc.keys())}",
            )

    def test_no_alias_fields(self) -> None:
        """Removed aliases should not appear."""
        client = authenticated_client("viewer")
        resp = client.get("/incidents")
        for inc in resp.json():
            self.assertNotIn(
                "primary_actor",
                inc,
                "Alias 'primary_actor' should be removed; use 'primary_actor_id'",
            )
            self.assertNotIn(
                "detection_summaries",
                inc,
                "Alias 'detection_summaries' should be removed; use 'detection_summary'",
            )

    def test_timeline_entry_fields(self) -> None:
        """Timeline entries should use 'entry_id', not 'reference_id'."""
        client = authenticated_client("viewer")
        resp = client.get("/incidents")
        for inc in resp.json():
            for entry in inc.get("timeline", []):
                self.assertIn("entry_id", entry)
                self.assertNotIn(
                    "reference_id",
                    entry,
                    "Alias 'reference_id' should be removed; use 'entry_id'",
                )
                self.assertEqual(
                    set(entry.keys()),
                    {"timestamp", "entry_type", "entry_id", "summary"},
                )


class TestPlatformLoginContract(unittest.TestCase):
    def test_login_response_fields(self) -> None:
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(
            set(data.keys()),
            {"username", "role", "expires_at"},
        )


class TestScenarioResultContract(unittest.TestCase):
    EXPECTED_FIELDS = {
        "scenario_id",
        "correlation_id",
        "events_total",
        "events_generated",
        "alerts_total",
        "alerts_generated",
        "responses_total",
        "responses_generated",
        "incident_id",
        "step_up_required",
        "revoked_sessions",
        "download_restricted_actors",
        "disabled_services",
        "quarantined_artifacts",
        "policy_change_restricted_actors",
        "operated_by",
    }

    def test_scenario_result_fields(self) -> None:
        STORE.reset()
        client = authenticated_client("red_team")
        resp = client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(
            set(data.keys()),
            self.EXPECTED_FIELDS,
            f"extra={set(data.keys()) - self.EXPECTED_FIELDS}, "
            f"missing={self.EXPECTED_FIELDS - set(data.keys())}",
        )


class TestIncidentStatusValidation(unittest.TestCase):
    """Verify IncidentStatusUpdate rejects invalid status strings at schema level."""

    def setUp(self) -> None:
        STORE.reset()
        client = authenticated_client("red_team")
        resp = client.post("/scenarios/scn-auth-001")
        self.correlation_id = resp.json()["correlation_id"]

    def test_invalid_status_returns_422(self) -> None:
        """An arbitrary status string must be rejected with 422, not 400."""
        client = authenticated_client("analyst")
        resp = client.patch(
            f"/incidents/{self.correlation_id}/status",
            json={"status": "hacked"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_422_body_names_status_field(self) -> None:
        """The 422 error body must reference the 'status' field."""
        client = authenticated_client("analyst")
        resp = client.patch(
            f"/incidents/{self.correlation_id}/status",
            json={"status": ""},
        )
        self.assertEqual(resp.status_code, 422)
        body = resp.json()
        detail_str = str(body.get("detail", ""))
        self.assertIn("status", detail_str.lower())

    def test_empty_status_returns_422(self) -> None:
        """Empty string status must be rejected with 422."""
        client = authenticated_client("analyst")
        resp = client.patch(
            f"/incidents/{self.correlation_id}/status",
            json={"status": "nonexistent_value"},
        )
        self.assertEqual(resp.status_code, 422)


# ---------------------------------------------------------------------------
# httpOnly cookie auth, simulated_source_ip, platform user attribution,
# simulation actor validation
# ---------------------------------------------------------------------------


class TestHttpOnlyCookieAuth(unittest.TestCase):
    """Verify that auth tokens are delivered via httpOnly cookies, never in JSON."""

    def test_login_sets_httponly_cookie(self) -> None:
        """POST /auth/login should set an httpOnly cookie with the JWT."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        self.assertEqual(resp.status_code, 200)
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "Login must set aegisrange_token cookie")

    def test_login_response_does_not_contain_token(self) -> None:
        """The JSON body must NOT contain the token — only non-secret metadata."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        data = resp.json()
        self.assertNotIn("token", data)
        self.assertIn("username", data)
        self.assertIn("role", data)
        self.assertIn("expires_at", data)

    def test_cookie_auth_works_for_protected_endpoints(self) -> None:
        """A client with only the cookie (no Authorization header) should be authenticated."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        login_resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        self.assertEqual(login_resp.status_code, 200)
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["username"], "admin")
        self.assertEqual(data["role"], "admin")

    def test_logout_clears_cookie(self) -> None:
        """POST /auth/logout should clear the auth cookie."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        resp = client.post("/auth/logout")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "logged_out")

    def test_auth_me_returns_user_info(self) -> None:
        """GET /auth/me should return user info when authenticated."""
        client = authenticated_client("analyst")
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["username"], "analyst1")
        self.assertEqual(data["role"], "analyst")

    def test_auth_me_rejects_unauthenticated(self) -> None:
        """GET /auth/me should return 401 without auth."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 401)


class TestSimulatedSourceIPInBody(unittest.TestCase):
    """Verify that simulated_source_ip comes from the request body, not a Header."""

    def setUp(self) -> None:
        admin = authenticated_client("admin")
        admin.post("/admin/reset")

    def test_identity_login_uses_body_simulated_source_ip(self) -> None:
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={
                "username": "alice",
                "password": "correct-horse",
                "simulated_source_ip": "10.99.99.99",
            },
        )
        events = client.get("/events?event_type=authentication.login.success").json()["items"]
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertNotEqual(latest["source_ip"], "10.99.99.99")
        self.assertEqual(latest["payload"]["simulated_source_ip"], "10.99.99.99")

    def test_document_read_uses_body_simulated_source_ip(self) -> None:
        client = authenticated_client("viewer")
        client.post(
            "/documents/doc-001/read",
            json={
                "actor_id": "user-alice",
                "actor_role": "analyst",
                "simulated_source_ip": "192.168.1.99",
            },
        )
        events = client.get("/events?event_type=document.read.success").json()["items"]
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertNotEqual(latest["source_ip"], "192.168.1.99")
        self.assertEqual(latest["payload"]["simulated_source_ip"], "192.168.1.99")

    def test_x_source_ip_header_has_no_effect(self) -> None:
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
            headers={"x-source-ip": "10.99.99.99"},
        )
        events = client.get("/events?event_type=authentication.login.success").json()["items"]
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertEqual(latest["payload"]["simulated_source_ip"], "127.0.0.1")
        self.assertNotEqual(latest["source_ip"], "10.99.99.99")

    def test_no_header_parameter_in_router_signatures(self) -> None:
        import inspect
        import app.routers.documents as docs
        import app.routers.identity as ids

        for mod in [docs, ids]:
            source = inspect.getsource(mod)
            self.assertNotIn(
                "Header(",
                source,
                f"Header() parameter found in {mod.__name__} — "
                "simulated_source_ip must come from the request body, not a header.",
            )


class TestPlatformUserAttribution(unittest.TestCase):
    """Verify that the platform user ID is recorded in simulation event payloads."""

    def setUp(self) -> None:
        admin = authenticated_client("admin")
        admin.post("/admin/reset")

    def test_identity_login_records_platform_user(self) -> None:
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
        )
        events = client.get("/events?event_type=authentication.login.success").json()["items"]
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertIn("platform_user_id", latest["payload"])
        self.assertEqual(latest["payload"]["platform_user_id"], "viewer1")

    def test_document_read_records_platform_user(self) -> None:
        client = authenticated_client("analyst")
        client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        events = client.get("/events?event_type=document.read.success").json()["items"]
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertIn("platform_user_id", latest["payload"])
        self.assertEqual(latest["payload"]["platform_user_id"], "analyst1")

    def test_session_revoke_records_platform_user(self) -> None:
        viewer = authenticated_client("viewer")
        resp = viewer.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
        )
        session_id = resp.json()["session_id"]

        analyst = authenticated_client("analyst")
        analyst.post(f"/identity/sessions/{session_id}/revoke")
        events = analyst.get("/events?event_type=session.token.revoked").json()["items"]
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertEqual(latest["payload"]["platform_user_id"], "analyst1")


class TestSimulationActorValidation(unittest.TestCase):
    """Verify that unknown simulation actor_ids are rejected."""

    def setUp(self) -> None:
        admin = authenticated_client("admin")
        admin.post("/admin/reset")

    def test_document_read_rejects_unknown_actor(self) -> None:
        client = authenticated_client("viewer")
        resp = client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-nonexistent", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_document_download_rejects_unknown_actor(self) -> None:
        client = authenticated_client("viewer")
        resp = client.post(
            "/documents/doc-001/download",
            json={"actor_id": "user-nonexistent", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_document_read_accepts_known_actor(self) -> None:
        client = authenticated_client("viewer")
        resp = client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        self.assertIn(resp.status_code, (200,))

    def test_document_download_accepts_known_actor(self) -> None:
        client = authenticated_client("viewer")
        resp = client.post(
            "/documents/doc-001/download",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        self.assertIn(resp.status_code, (200,))


if __name__ == "__main__":
    unittest.main()
