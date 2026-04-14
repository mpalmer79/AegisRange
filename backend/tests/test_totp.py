"""Tests for Phase 1.4: TOTP / MFA Foundation.

Covers:
  - TOTPService: secret generation, code generation, verification, provisioning URI
  - MFA endpoints: /auth/mfa/enroll, /auth/mfa/verify, /auth/mfa/disable
  - MFA login flow: password -> mfa_required -> TOTP verify -> token issued
  - Store persistence: totp_secrets and totp_enabled survive reload
"""

from __future__ import annotations

import os
import tempfile
import time
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import DEFAULT_PASSWORDS, _auth_service
from app.services.totp_service import TOTPService, totp_service
from app.store import STORE
from tests.auth_helper import authenticated_client


# ---------------------------------------------------------------------------
# TOTPService unit tests
# ---------------------------------------------------------------------------


class TestTOTPServiceSecrets(unittest.TestCase):
    """Verify secret generation."""

    def test_generate_secret_is_base32(self) -> None:
        import base64

        secret = totp_service.generate_secret()
        # Should decode without error
        raw = base64.b32decode(secret, casefold=True)
        self.assertEqual(len(raw), 20)

    def test_secrets_are_unique(self) -> None:
        s1 = totp_service.generate_secret()
        s2 = totp_service.generate_secret()
        self.assertNotEqual(s1, s2)


class TestTOTPServiceCodes(unittest.TestCase):
    """Verify TOTP code generation and verification."""

    def setUp(self) -> None:
        self.svc = TOTPService()
        self.secret = self.svc.generate_secret()

    def test_generate_code_is_6_digits(self) -> None:
        code = self.svc.generate_code(self.secret)
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())

    def test_generate_code_deterministic_for_same_time(self) -> None:
        ts = 1700000000.0
        c1 = self.svc.generate_code(self.secret, timestamp=ts)
        c2 = self.svc.generate_code(self.secret, timestamp=ts)
        self.assertEqual(c1, c2)

    def test_generate_code_varies_across_periods(self) -> None:
        ts1 = 1700000000.0
        ts2 = ts1 + 30  # next period
        c1 = self.svc.generate_code(self.secret, timestamp=ts1)
        c2 = self.svc.generate_code(self.secret, timestamp=ts2)
        self.assertNotEqual(c1, c2)

    def test_verify_current_code(self) -> None:
        code = self.svc.generate_code(self.secret)
        self.assertTrue(self.svc.verify_code(self.secret, code))

    def test_verify_wrong_code_fails(self) -> None:
        self.assertFalse(self.svc.verify_code(self.secret, "000000"))

    def test_verify_with_window(self) -> None:
        """Codes from adjacent time periods should be accepted within the window."""
        ts = 1700000000.0
        # Generate code for the previous period
        prev_code = self.svc.generate_code(self.secret, timestamp=ts - 30)
        # Verify against current time — should succeed with window=1
        self.assertTrue(
            self.svc.verify_code(self.secret, prev_code, window=1, timestamp=ts)
        )

    def test_verify_outside_window_fails(self) -> None:
        """Codes from time periods outside the window should fail."""
        ts = 1700000000.0
        # Generate code 3 periods ago
        old_code = self.svc.generate_code(self.secret, timestamp=ts - 90)
        # Window=1 means only ±1 period accepted
        self.assertFalse(
            self.svc.verify_code(self.secret, old_code, window=1, timestamp=ts)
        )

    def test_different_secrets_produce_different_codes(self) -> None:
        s1 = self.svc.generate_secret()
        s2 = self.svc.generate_secret()
        ts = 1700000000.0
        self.assertNotEqual(
            self.svc.generate_code(s1, timestamp=ts),
            self.svc.generate_code(s2, timestamp=ts),
        )


class TestTOTPProvisioningURI(unittest.TestCase):
    """Verify provisioning URI generation."""

    def test_uri_format(self) -> None:
        secret = totp_service.generate_secret()
        uri = totp_service.provisioning_uri(secret, "testuser")
        self.assertTrue(uri.startswith("otpauth://totp/"))
        self.assertIn("secret=", uri)
        self.assertIn("issuer=AegisRange", uri)
        self.assertIn("testuser", uri)
        self.assertIn("algorithm=SHA1", uri)
        self.assertIn("digits=6", uri)
        self.assertIn("period=30", uri)


# ---------------------------------------------------------------------------
# MFA endpoint integration tests
# ---------------------------------------------------------------------------


class TestMFAEnrollment(unittest.TestCase):
    """Verify /auth/mfa/enroll endpoint."""

    def setUp(self) -> None:
        STORE.reset()

    def test_enroll_success(self) -> None:
        client = authenticated_client("admin")
        resp = client.post("/auth/mfa/enroll")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("secret", data)
        self.assertIn("provisioning_uri", data)
        self.assertIn("admin", STORE.totp_enabled)

    def test_enroll_duplicate_rejected(self) -> None:
        client = authenticated_client("admin")
        client.post("/auth/mfa/enroll")
        resp = client.post("/auth/mfa/enroll")
        self.assertEqual(resp.status_code, 409)

    def test_enroll_requires_auth(self) -> None:
        client = TestClient(app)
        resp = client.post("/auth/mfa/enroll")
        self.assertEqual(resp.status_code, 401)


class TestMFAVerification(unittest.TestCase):
    """Verify /auth/mfa/verify endpoint."""

    def setUp(self) -> None:
        STORE.reset()
        # Enroll admin in MFA
        self.secret = totp_service.generate_secret()
        STORE.totp_secrets["admin"] = self.secret
        STORE.totp_enabled.add("admin")

    def test_verify_valid_code(self) -> None:
        code = totp_service.generate_code(self.secret)
        client = TestClient(app)
        resp = client.post(
            "/auth/mfa/verify",
            json={"username": "admin", "code": code},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Should have token cookie set
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "Token cookie should be set after MFA verify")
        self.assertEqual(data["username"], "admin")
        self.assertEqual(data["role"], "admin")

    def test_verify_invalid_code(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/mfa/verify",
            json={"username": "admin", "code": "000000"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_verify_unenrolled_user(self) -> None:
        STORE.totp_enabled.discard("admin")
        STORE.totp_secrets.pop("admin", None)
        client = TestClient(app)
        resp = client.post(
            "/auth/mfa/verify",
            json={"username": "admin", "code": "123456"},
        )
        self.assertEqual(resp.status_code, 400)


class TestMFADisable(unittest.TestCase):
    """Verify /auth/mfa/disable endpoint."""

    def setUp(self) -> None:
        STORE.reset()
        STORE.totp_secrets["viewer1"] = totp_service.generate_secret()
        STORE.totp_enabled.add("viewer1")

    def test_admin_can_disable_mfa(self) -> None:
        client = authenticated_client("admin")
        resp = client.post("/auth/mfa/disable?username=viewer1")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("viewer1", STORE.totp_enabled)
        self.assertNotIn("viewer1", STORE.totp_secrets)

    def test_non_admin_cannot_disable_mfa(self) -> None:
        client = authenticated_client("viewer")
        resp = client.post("/auth/mfa/disable?username=viewer1")
        self.assertEqual(resp.status_code, 403)

    def test_disable_unenrolled_returns_404(self) -> None:
        client = authenticated_client("admin")
        resp = client.post("/auth/mfa/disable?username=analyst1")
        self.assertEqual(resp.status_code, 404)

    def test_disable_without_username_returns_422(self) -> None:
        client = authenticated_client("admin")
        resp = client.post("/auth/mfa/disable")
        self.assertEqual(resp.status_code, 422)


class TestMFALoginFlow(unittest.TestCase):
    """Verify the full MFA login flow: password -> mfa_required -> verify -> token."""

    def setUp(self) -> None:
        STORE.reset()
        # Enroll admin in TOTP — admin role is in MFA_REQUIRED_ROLES
        self.secret = totp_service.generate_secret()
        STORE.totp_secrets["admin"] = self.secret
        STORE.totp_enabled.add("admin")

    def test_login_returns_mfa_required(self) -> None:
        """Password-correct login for MFA-enrolled user returns mfa_required."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": DEFAULT_PASSWORDS["admin"]},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("mfa_required"))
        # No token cookie should be set yet
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNone(cookie)

    def test_full_mfa_flow(self) -> None:
        """Complete flow: login -> mfa_required -> verify TOTP -> receive token."""
        client = TestClient(app)
        # Step 1: Login with password
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": DEFAULT_PASSWORDS["admin"]},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get("mfa_required"))

        # Step 2: Verify TOTP
        code = totp_service.generate_code(self.secret)
        resp = client.post(
            "/auth/mfa/verify",
            json={"username": "admin", "code": code},
        )
        self.assertEqual(resp.status_code, 200)
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "Token should be issued after TOTP verification")

        # Step 3: Use the token
        resp = client.get(
            "/auth/me",
            cookies={"aegisrange_token": cookie},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["username"], "admin")

    def test_non_mfa_role_bypasses_mfa(self) -> None:
        """Users whose role is not in MFA_REQUIRED_ROLES bypass MFA."""
        # viewer1 role is "viewer" — not in MFA_REQUIRED_ROLES
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "viewer1", "password": DEFAULT_PASSWORDS["viewer1"]},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data.get("mfa_required", False))
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "Non-MFA user should get token directly")


# ---------------------------------------------------------------------------
# TOTP persistence
# ---------------------------------------------------------------------------


class TestTOTPPersistence(unittest.TestCase):
    """Verify TOTP state survives SQLite persistence round-trip."""

    def test_totp_state_persists(self) -> None:
        STORE.reset()
        # Set up TOTP state
        secret = totp_service.generate_secret()
        STORE.totp_secrets["admin"] = secret
        STORE.totp_enabled.add("admin")

        fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            STORE.enable_persistence(db_path=db_path)
            STORE.save()

            # Clear in-memory state
            STORE.totp_secrets.clear()
            STORE.totp_enabled.clear()
            self.assertNotIn("admin", STORE.totp_enabled)

            # Reload from SQLite
            STORE._persistence.load()
            self.assertIn("admin", STORE.totp_enabled)
            self.assertEqual(STORE.totp_secrets.get("admin"), secret)
        finally:
            STORE._persistence = None
            os.unlink(db_path)


# ---------------------------------------------------------------------------
# authenticate() 4-tuple return
# ---------------------------------------------------------------------------


class TestAuthenticate4Tuple(unittest.TestCase):
    """Verify authenticate() returns the correct 4-tuple."""

    def test_normal_login_returns_none_mfa_status(self) -> None:
        svc = _auth_service
        success, token, expires_at, mfa_status = svc.authenticate(
            "viewer1", DEFAULT_PASSWORDS["viewer1"]
        )
        self.assertTrue(success)
        self.assertIsNotNone(token)
        self.assertIsNotNone(expires_at)
        self.assertIsNone(mfa_status)

    def test_failed_login_returns_4_nones(self) -> None:
        svc = _auth_service
        success, token, expires_at, mfa_status = svc.authenticate(
            "admin", "Wrong_Pass_9999!"
        )
        self.assertFalse(success)
        self.assertIsNone(token)
        self.assertIsNone(expires_at)
        self.assertIsNone(mfa_status)

    def test_mfa_required_returns_true_none_none_status(self) -> None:
        STORE.reset()
        STORE.totp_secrets["admin"] = totp_service.generate_secret()
        STORE.totp_enabled.add("admin")
        svc = _auth_service
        success, token, expires_at, mfa_status = svc.authenticate(
            "admin", DEFAULT_PASSWORDS["admin"]
        )
        self.assertTrue(success)
        self.assertIsNone(token)
        self.assertIsNone(expires_at)
        self.assertEqual(mfa_status, "mfa_required")


if __name__ == "__main__":
    unittest.main()
