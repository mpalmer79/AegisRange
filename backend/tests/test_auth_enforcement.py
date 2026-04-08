"""Tests verifying that auth is enforced on protected routes."""
from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app
from tests.auth_helper import get_viewer_token


class TestUnauthenticatedAccess(unittest.TestCase):
    """Routes should return 401 when no token is provided."""

    def setUp(self) -> None:
        self.client = TestClient(app)  # NO auth token

    def test_metrics_requires_auth(self) -> None:
        resp = self.client.get("/metrics")
        self.assertEqual(resp.status_code, 401)

    def test_events_requires_auth(self) -> None:
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 401)

    def test_alerts_requires_auth(self) -> None:
        resp = self.client.get("/alerts")
        self.assertEqual(resp.status_code, 401)

    def test_incidents_requires_auth(self) -> None:
        resp = self.client.get("/incidents")
        self.assertEqual(resp.status_code, 401)

    def test_scenarios_requires_auth(self) -> None:
        resp = self.client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 401)

    def test_admin_reset_requires_auth(self) -> None:
        resp = self.client.post("/admin/reset")
        self.assertEqual(resp.status_code, 401)

    def test_analytics_requires_auth(self) -> None:
        resp = self.client.get("/analytics/risk-profiles")
        self.assertEqual(resp.status_code, 401)

    def test_reports_requires_auth(self) -> None:
        resp = self.client.post("/reports/generate")
        self.assertEqual(resp.status_code, 401)

    def test_mitre_requires_auth(self) -> None:
        resp = self.client.get("/mitre/mappings")
        self.assertEqual(resp.status_code, 401)

    def test_killchain_requires_auth(self) -> None:
        resp = self.client.get("/killchain")
        self.assertEqual(resp.status_code, 401)

    def test_campaigns_requires_auth(self) -> None:
        resp = self.client.get("/campaigns")
        self.assertEqual(resp.status_code, 401)


class TestPublicEndpoints(unittest.TestCase):
    """Health and auth/login should be accessible without a token."""

    def setUp(self) -> None:
        self.client = TestClient(app)  # NO auth token

    def test_health_is_public(self) -> None:
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)

    def test_auth_login_is_public(self) -> None:
        resp = self.client.post("/auth/login", json={
            "username": "admin",
            "password": "admin_pass",
        })
        self.assertEqual(resp.status_code, 200)


class TestRoleLevelEnforcement(unittest.TestCase):
    """Verify that role levels are enforced correctly."""

    def test_viewer_cannot_run_scenarios(self) -> None:
        client = TestClient(app)
        token = get_viewer_token()
        client.headers["Authorization"] = f"Bearer {token}"
        resp = client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 403)

    def test_viewer_cannot_access_analytics(self) -> None:
        client = TestClient(app)
        token = get_viewer_token()
        client.headers["Authorization"] = f"Bearer {token}"
        resp = client.get("/analytics/risk-profiles")
        self.assertEqual(resp.status_code, 403)

    def test_viewer_cannot_reset(self) -> None:
        client = TestClient(app)
        token = get_viewer_token()
        client.headers["Authorization"] = f"Bearer {token}"
        resp = client.post("/admin/reset")
        self.assertEqual(resp.status_code, 403)

    def test_viewer_can_read_events(self) -> None:
        client = TestClient(app)
        token = get_viewer_token()
        client.headers["Authorization"] = f"Bearer {token}"
        resp = client.get("/events")
        self.assertEqual(resp.status_code, 200)

    def test_viewer_can_read_alerts(self) -> None:
        client = TestClient(app)
        token = get_viewer_token()
        client.headers["Authorization"] = f"Bearer {token}"
        resp = client.get("/alerts")
        self.assertEqual(resp.status_code, 200)

    def test_viewer_can_read_incidents(self) -> None:
        client = TestClient(app)
        token = get_viewer_token()
        client.headers["Authorization"] = f"Bearer {token}"
        resp = client.get("/incidents")
        self.assertEqual(resp.status_code, 200)


if __name__ == "__main__":
    unittest.main()
