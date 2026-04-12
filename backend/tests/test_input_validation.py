"""Tests for request schema field validation."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app


class TestLoginValidation(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_empty_username_rejected(self):
        resp = self.client.post("/auth/login", json={"username": "", "password": "x"})
        self.assertEqual(resp.status_code, 422)

    def test_oversized_username_rejected(self):
        resp = self.client.post(
            "/auth/login", json={"username": "a" * 65, "password": "x"}
        )
        self.assertEqual(resp.status_code, 422)

    def test_empty_password_rejected(self):
        resp = self.client.post(
            "/auth/login", json={"username": "admin", "password": ""}
        )
        self.assertEqual(resp.status_code, 422)

    def test_oversized_password_rejected(self):
        resp = self.client.post(
            "/auth/login", json={"username": "admin", "password": "p" * 129}
        )
        self.assertEqual(resp.status_code, 422)

    def test_valid_login_not_rejected_by_validation(self):
        # Should get 401 (bad credentials) not 422 (validation error)
        resp = self.client.post(
            "/auth/login", json={"username": "admin", "password": "wrong"}
        )
        self.assertNotEqual(resp.status_code, 422)


class TestSimulationLoginValidation(unittest.TestCase):
    def setUp(self):
        from tests.auth_helper import authenticated_client

        self.client = authenticated_client("viewer")

    def test_oversized_simulated_ip_rejected(self):
        resp = self.client.post(
            "/identity/login",
            json={
                "username": "admin",
                "password": "admin_pass",
                "simulated_source_ip": "x" * 46,
            },
        )
        self.assertEqual(resp.status_code, 422)


class TestIncidentNoteValidation(unittest.TestCase):
    def setUp(self):
        from tests.auth_helper import authenticated_client

        self.client = authenticated_client("analyst")

    def test_empty_author_rejected(self):
        # We need a valid incident first — run a scenario
        rt_client = self._get_red_team_client()
        resp = rt_client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        corr_id = resp.json()["correlation_id"]

        resp = self.client.post(
            f"/incidents/{corr_id}/notes",
            json={"author": "", "content": "test content"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_empty_content_rejected(self):
        rt_client = self._get_red_team_client()
        resp = rt_client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        corr_id = resp.json()["correlation_id"]

        resp = self.client.post(
            f"/incidents/{corr_id}/notes",
            json={"author": "analyst", "content": ""},
        )
        self.assertEqual(resp.status_code, 422)

    def test_oversized_content_rejected(self):
        rt_client = self._get_red_team_client()
        resp = rt_client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        corr_id = resp.json()["correlation_id"]

        resp = self.client.post(
            f"/incidents/{corr_id}/notes",
            json={"author": "analyst", "content": "x" * 10001},
        )
        self.assertEqual(resp.status_code, 422)

    def _get_red_team_client(self) -> TestClient:
        from tests.auth_helper import authenticated_client

        return authenticated_client("red_team")


class TestReadRequestValidation(unittest.TestCase):
    def setUp(self):
        from tests.auth_helper import authenticated_client

        self.client = authenticated_client("red_team")

    def test_empty_actor_id_rejected(self):
        resp = self.client.post(
            "/documents/doc-secret-001/read",
            json={"actor_id": "", "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_empty_actor_role_rejected(self):
        resp = self.client.post(
            "/documents/doc-secret-001/read",
            json={"actor_id": "user-001", "actor_role": ""},
        )
        self.assertEqual(resp.status_code, 422)

    def test_oversized_actor_id_rejected(self):
        resp = self.client.post(
            "/documents/doc-secret-001/read",
            json={"actor_id": "a" * 129, "actor_role": "analyst"},
        )
        self.assertEqual(resp.status_code, 422)


class TestReportRequestValidation(unittest.TestCase):
    def setUp(self):
        from tests.auth_helper import authenticated_client

        self.client = authenticated_client("analyst")

    def test_empty_title_rejected(self):
        resp = self.client.post("/reports/generate", json={"title": ""})
        self.assertEqual(resp.status_code, 422)

    def test_oversized_title_rejected(self):
        resp = self.client.post(
            "/reports/generate", json={"title": "t" * 257}
        )
        self.assertEqual(resp.status_code, 422)
