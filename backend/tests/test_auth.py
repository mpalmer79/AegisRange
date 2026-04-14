"""Tests for Phase 6: JWT authentication and RBAC."""

from __future__ import annotations

import unittest

from app.services.auth_service import (
    AuthService,
    ROLES,
    DEFAULT_USERS,
    DEFAULT_PASSWORDS,
)
from tests.auth_helper import authenticated_client


class TestAuthService(unittest.TestCase):
    def setUp(self) -> None:
        self.service = AuthService()

    def test_authenticate_valid_user(self) -> None:
        success, token, expires_at, mfa_status = self.service.authenticate(
            "admin", "Admin_Pass_2025!"
        )
        self.assertTrue(success)
        self.assertIsNotNone(token)
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 10)
        self.assertIsNotNone(expires_at)
        self.assertIsNone(mfa_status)

    def test_authenticate_invalid_password(self) -> None:
        success, token, expires_at, mfa_status = self.service.authenticate(
            "admin", "Wrong_Pass_9999!"
        )
        self.assertFalse(success)
        self.assertIsNone(token)
        self.assertIsNone(expires_at)
        self.assertIsNone(mfa_status)

    def test_authenticate_unknown_user(self) -> None:
        success, token, expires_at, mfa_status = self.service.authenticate(
            "nonexistent", "Anything_Pass_1!"
        )
        self.assertFalse(success)
        self.assertIsNone(token)
        self.assertIsNone(expires_at)
        self.assertIsNone(mfa_status)

    def test_create_and_verify_token(self) -> None:
        token = self.service.create_token("admin", "admin")
        payload = self.service.verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.sub, "admin")
        self.assertEqual(payload.role, "admin")

    def test_verify_invalid_token(self) -> None:
        self.assertIsNone(self.service.verify_token("invalid.token.here"))

    def test_verify_tampered_token(self) -> None:
        token = self.service.create_token("admin", "admin")
        # Tamper with the token by modifying a character
        parts = token.split(".")
        if len(parts) == 3:
            tampered = parts[0] + "." + parts[1] + ".tampered"
            self.assertIsNone(self.service.verify_token(tampered))

    def test_get_user(self) -> None:
        user = self.service.get_user("admin")
        self.assertIsNotNone(user)
        self.assertEqual(user.username, "admin")
        self.assertEqual(user.role, "admin")

    def test_get_unknown_user(self) -> None:
        self.assertIsNone(self.service.get_user("nonexistent"))

    def test_list_users(self) -> None:
        users = self.service.list_users()
        self.assertEqual(len(users), len(DEFAULT_USERS))
        usernames = {u.username for u in users}
        self.assertIn("admin", usernames)
        self.assertIn("analyst1", usernames)

    def test_all_roles_have_levels(self) -> None:
        for role_name, config in ROLES.items():
            self.assertIn("level", config)
            self.assertIsInstance(config["level"], int)

    def test_role_hierarchy(self) -> None:
        self.assertGreater(ROLES["admin"]["level"], ROLES["soc_manager"]["level"])
        self.assertGreater(ROLES["soc_manager"]["level"], ROLES["analyst"]["level"])
        self.assertEqual(ROLES["analyst"]["level"], ROLES["red_team"]["level"])
        self.assertGreater(ROLES["analyst"]["level"], ROLES["viewer"]["level"])


class TestAuthAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.client = authenticated_client("admin")
        self.client.post("/admin/reset")

    def test_login_success(self) -> None:
        resp = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Admin_Pass_2025!",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Token is in httpOnly cookie, NOT in JSON body
        self.assertNotIn("token", data)
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "httpOnly cookie should be set on login")
        self.assertEqual(data["username"], "admin")
        self.assertEqual(data["role"], "admin")
        self.assertIn("expires_at", data)

    def test_login_failure(self) -> None:
        resp = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Wrong_Pass_9999!",
            },
        )
        self.assertEqual(resp.status_code, 401)

    def test_list_users(self) -> None:
        resp = self.client.get("/auth/users")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 5)
        usernames = {u["username"] for u in data}
        self.assertIn("admin", usernames)
        self.assertIn("viewer1", usernames)

    def test_all_default_users_can_login(self) -> None:
        for username in DEFAULT_USERS:
            resp = self.client.post(
                "/auth/login",
                json={
                    "username": username,
                    "password": DEFAULT_PASSWORDS[username],
                },
            )
            self.assertEqual(
                resp.status_code, 200, f"{username} should be able to login"
            )


if __name__ == "__main__":
    unittest.main()
