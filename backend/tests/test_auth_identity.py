"""Tests for auth hardening: identity attribution, expiry consistency, boundary separation."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import _auth_service
from app.store import STORE
from tests.auth_helper import authenticated_client


class TestScenarioAttribution(unittest.TestCase):
    """Scenario execution should record which platform user triggered it."""

    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client("red_team")

    def test_scenario_returns_operated_by(self) -> None:
        resp = self.client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["operated_by"], "red_team1")

    def test_scenario_history_records_operated_by(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        self.assertEqual(len(STORE.scenario_history), 1)
        entry = STORE.scenario_history[0]
        self.assertEqual(entry["operated_by"], "red_team1")

    def test_all_scenarios_attribute_operator(self) -> None:
        scenarios = [
            "scn-auth-001",
            "scn-session-002",
            "scn-doc-003",
            "scn-doc-004",
            "scn-svc-005",
            "scn-corr-006",
        ]
        for scenario_id in scenarios:
            STORE.reset()
            resp = self.client.post(f"/scenarios/{scenario_id}")
            self.assertEqual(resp.status_code, 200, f"Failed for {scenario_id}")
            data = resp.json()
            self.assertEqual(
                data["operated_by"],
                "red_team1",
                f"operated_by missing for {scenario_id}",
            )


class TestIncidentNoteAttribution(unittest.TestCase):
    """Incident notes should be attributed to the authenticated platform user."""

    def setUp(self) -> None:
        STORE.reset()
        # Run a scenario to create an incident
        rt_client = authenticated_client("red_team")
        resp = rt_client.post("/scenarios/scn-auth-001")
        self.correlation_id = resp.json()["correlation_id"]
        self.client = authenticated_client("analyst")

    def test_note_author_is_platform_user(self) -> None:
        resp = self.client.post(
            f"/incidents/{self.correlation_id}/notes",
            json={"author": "should-be-overridden", "content": "Test note"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # The author should be the authenticated platform user, not the client-supplied value
        self.assertEqual(data["author"], "analyst1")

    def test_note_content_preserved(self) -> None:
        resp = self.client.post(
            f"/incidents/{self.correlation_id}/notes",
            json={"author": "ignored", "content": "Investigation findings here"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["content"], "Investigation findings here")


class TestIncidentStatusAttribution(unittest.TestCase):
    """Incident status transitions should record who made the change."""

    def setUp(self) -> None:
        STORE.reset()
        rt_client = authenticated_client("red_team")
        resp = rt_client.post("/scenarios/scn-auth-001")
        self.correlation_id = resp.json()["correlation_id"]
        self.client = authenticated_client("analyst")

    def test_status_transition_records_user_in_timeline(self) -> None:
        resp = self.client.patch(
            f"/incidents/{self.correlation_id}/status",
            json={"status": "investigating"},
        )
        self.assertEqual(resp.status_code, 200)
        timeline = resp.json()["timeline"]
        transition_entries = [
            e for e in timeline if e["entry_type"] == "state_transition"
        ]
        self.assertTrue(len(transition_entries) > 0)
        last_transition = transition_entries[-1]
        self.assertIn("analyst1", last_transition["summary"])


class TestAdminResetAttribution(unittest.TestCase):
    """Admin reset should identify who triggered it."""

    def test_reset_returns_reset_by(self) -> None:
        client = authenticated_client("admin")
        resp = client.post("/admin/reset")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["reset_by"], "admin")


class TestTokenExpirySingleSource(unittest.TestCase):
    """Token expiry should come from the JWT itself — single source of truth."""

    def test_login_returns_expiry_from_jwt(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Admin_Pass_2025!",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("expires_at", data)
        self.assertIsNotNone(data["expires_at"])
        # Verify it's a valid ISO datetime
        expiry = datetime.fromisoformat(data["expires_at"])
        # expiry may be tz-aware (from updated auth); compare correctly
        now = datetime.now(timezone.utc)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        self.assertGreater(expiry, now)

    def test_expiry_matches_jwt_payload(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Admin_Pass_2025!",
            },
        )
        data = resp.json()
        # Token is in the httpOnly cookie, not the JSON body
        token = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(token, "httpOnly cookie should be set on login")
        # Verify the token and check its embedded expiry
        payload = _auth_service.verify_token(token)
        self.assertIsNotNone(payload)
        returned_expiry = datetime.fromisoformat(data["expires_at"])
        self.assertEqual(returned_expiry, payload.exp)

    def test_authenticate_returns_four_values(self) -> None:
        success, token, expires_at, mfa_status = _auth_service.authenticate("admin", "Admin_Pass_2025!")
        self.assertTrue(success)
        self.assertIsNotNone(token)
        self.assertIsNotNone(expires_at)
        self.assertIsInstance(expires_at, datetime)
        self.assertIsNone(mfa_status)

    def test_authenticate_failure_returns_none_expiry(self) -> None:
        success, token, expires_at, mfa_status = _auth_service.authenticate("admin", "Wrong_Pass_9999!")
        self.assertFalse(success)
        self.assertIsNone(token)
        self.assertIsNone(expires_at)
        self.assertIsNone(mfa_status)


class TestIdentityBoundarySeparation(unittest.TestCase):
    """Platform auth (AuthService) and simulated identity (IdentityService) are separate."""

    def test_platform_login_endpoint_is_public(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Admin_Pass_2025!",
            },
        )
        self.assertEqual(resp.status_code, 200)

    def test_identity_login_requires_platform_auth(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/identity/login",
            json={
                "username": "alice",
                "password": "Correct_Horse_42!",
            },
        )
        self.assertEqual(resp.status_code, 401)

    def test_identity_login_works_with_auth(self) -> None:
        client = authenticated_client("viewer")
        resp = client.post(
            "/identity/login",
            json={
                "username": "alice",
                "password": "Correct_Horse_42!",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # This returns simulated actor data, not platform user data
        self.assertIn("actor_id", data)
        self.assertIn("session_id", data)
        # No JWT token in identity login response
        self.assertNotIn("token", data)

    def test_platform_login_sets_httponly_cookie(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Admin_Pass_2025!",
            },
        )
        data = resp.json()
        # Token is in the httpOnly cookie, NOT in the JSON body
        self.assertNotIn("token", data)
        self.assertIn("role", data)
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "httpOnly cookie should be set")
        # No simulated actor fields
        self.assertNotIn("actor_id", data)
        self.assertNotIn("session_id", data)


if __name__ == "__main__":
    unittest.main()
