"""Tests for Phase 1: Authentication Hardening.

Covers:
  - Account lockout (NIST 800-53 AC-7) with window + duration two-step logic
  - Password complexity validation (Pydantic @field_validator on LoginRequest)
  - JWT key rotation (kid header, previous key fallback)
"""

from __future__ import annotations

import time
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import (
    AuthService,
    DEFAULT_PASSWORDS,
    _auth_service,
)


# ---------------------------------------------------------------------------
# Phase 1.1 — Account Lockout (NIST 800-53 AC-7)
# ---------------------------------------------------------------------------


class TestAccountLockout(unittest.TestCase):
    """Verify two-step account lockout: window (300s) + duration (900s)."""

    def setUp(self) -> None:
        # Use short window/duration for fast tests
        self.service = AuthService(
            lockout_threshold=3,
            lockout_window_seconds=60,
            lockout_duration_seconds=120,
        )

    def test_account_not_locked_initially(self) -> None:
        self.assertFalse(self.service.is_account_locked("admin"))

    def test_account_locks_after_threshold(self) -> None:
        for _ in range(3):
            self.service.record_failed_attempt("admin")
        self.assertTrue(self.service.is_account_locked("admin"))

    def test_account_not_locked_below_threshold(self) -> None:
        for _ in range(2):
            self.service.record_failed_attempt("admin")
        self.assertFalse(self.service.is_account_locked("admin"))

    def test_authenticate_blocked_when_locked(self) -> None:
        for _ in range(3):
            self.service.record_failed_attempt("admin")
        success, token, _, _ = self.service.authenticate("admin", DEFAULT_PASSWORDS["admin"])
        self.assertFalse(success)
        self.assertIsNone(token)

    def test_lockout_clears_after_duration(self) -> None:
        """Lockout should clear once the duration has elapsed."""
        svc = AuthService(
            lockout_threshold=2,
            lockout_window_seconds=60,
            lockout_duration_seconds=60,
        )
        # Backdate attempts so they are within the window but the duration has passed
        past = time.monotonic() - 61
        svc._login_attempts["admin"] = [past, past + 1]
        # The most recent attempt was 60s ago — duration elapsed
        self.assertFalse(svc.is_account_locked("admin"))

    def test_lockout_active_within_duration(self) -> None:
        """Account should stay locked if within duration."""
        svc = AuthService(
            lockout_threshold=2,
            lockout_window_seconds=60,
            lockout_duration_seconds=120,
        )
        # Recent failures — within both window and duration
        now = time.monotonic()
        svc._login_attempts["admin"] = [now - 5, now - 3]
        self.assertTrue(svc.is_account_locked("admin"))

    def test_failures_outside_window_dont_count(self) -> None:
        """Failures older than the observation window should not trigger lockout."""
        svc = AuthService(
            lockout_threshold=3,
            lockout_window_seconds=30,
            lockout_duration_seconds=120,
        )
        # Two old failures outside window + one recent
        now = time.monotonic()
        svc._login_attempts["admin"] = [now - 60, now - 50, now - 1]
        # Only one failure is within the 30s window — below threshold of 3
        self.assertFalse(svc.is_account_locked("admin"))

    def test_successful_login_clears_attempts(self) -> None:
        self.service.record_failed_attempt("admin")
        self.service.record_failed_attempt("admin")
        # Successful auth should clear history
        success, token, _, _ = self.service.authenticate("admin", DEFAULT_PASSWORDS["admin"])
        self.assertTrue(success)
        self.assertIsNotNone(token)
        self.assertFalse(self.service.is_account_locked("admin"))

    def test_failed_attempts_accumulate_via_authenticate(self) -> None:
        svc = AuthService(
            lockout_threshold=3,
            lockout_window_seconds=300,
            lockout_duration_seconds=900,
        )
        for _ in range(3):
            svc.authenticate("admin", "Wrong_Pass_9999!")
        # Account should now be locked
        self.assertTrue(svc.is_account_locked("admin"))
        # Even correct password should be rejected
        success, _, _, _ = svc.authenticate("admin", DEFAULT_PASSWORDS["admin"])
        self.assertFalse(success)

    def test_lockout_per_user_isolation(self) -> None:
        for _ in range(3):
            self.service.record_failed_attempt("admin")
        self.assertTrue(self.service.is_account_locked("admin"))
        self.assertFalse(self.service.is_account_locked("analyst1"))

    def test_get_lockout_remaining_zero_when_not_locked(self) -> None:
        self.assertEqual(self.service.get_lockout_remaining("admin"), 0)

    def test_get_lockout_remaining_positive_when_locked(self) -> None:
        for _ in range(3):
            self.service.record_failed_attempt("admin")
        remaining = self.service.get_lockout_remaining("admin")
        self.assertGreater(remaining, 0)

    def test_clear_failed_attempts(self) -> None:
        for _ in range(3):
            self.service.record_failed_attempt("admin")
        self.assertTrue(self.service.is_account_locked("admin"))
        self.service.clear_failed_attempts("admin")
        self.assertFalse(self.service.is_account_locked("admin"))

    def test_clear_nonexistent_user_is_safe(self) -> None:
        self.service.clear_failed_attempts("nonexistent")  # no error

    def test_prune_old_attempts(self) -> None:
        """record_failed_attempt should prune entries older than window+duration."""
        svc = AuthService(
            lockout_threshold=3,
            lockout_window_seconds=10,
            lockout_duration_seconds=10,
        )
        # Record an old attempt
        old = time.monotonic() - 25  # older than 10+10=20
        svc._login_attempts["admin"] = [old]
        # Record a new attempt — should prune the old one
        svc.record_failed_attempt("admin")
        self.assertEqual(len(svc._login_attempts["admin"]), 1)


class TestAccountLockoutAPI(unittest.TestCase):
    """Verify lockout behavior at the HTTP API level."""

    def tearDown(self) -> None:
        # Clear lockout state so other test modules are not affected
        _auth_service._login_attempts.clear()

    def test_lockout_returns_423(self) -> None:
        client = TestClient(app)
        # Exhaust the login attempts (default threshold is 5)
        for _ in range(5):
            client.post(
                "/auth/login",
                json={"username": "viewer1", "password": "Wrong_Pass_9999!"},
            )
        # The 6th attempt on a locked account should return 423
        resp = client.post(
            "/auth/login",
            json={"username": "viewer1", "password": DEFAULT_PASSWORDS["viewer1"]},
        )
        self.assertEqual(resp.status_code, 423)
        self.assertIn("locked", resp.json()["detail"].lower())

    def test_different_user_not_affected(self) -> None:
        client = TestClient(app)
        # Lock viewer1
        for _ in range(5):
            client.post(
                "/auth/login",
                json={"username": "viewer1", "password": "Wrong_Pass_9999!"},
            )
        # analyst1 should still be able to log in
        resp = client.post(
            "/auth/login",
            json={"username": "analyst1", "password": DEFAULT_PASSWORDS["analyst1"]},
        )
        self.assertEqual(resp.status_code, 200)


# ---------------------------------------------------------------------------
# Phase 1.2 — Password Complexity Validation (Pydantic @field_validator)
# ---------------------------------------------------------------------------


class TestPasswordComplexity(unittest.TestCase):
    """Verify password complexity via Pydantic schema validation.

    The complexity check lives as a ``@field_validator`` on
    ``LoginRequest.password`` in schemas.py.  In dev mode
    (``SKIP_PASSWORD_COMPLEXITY=True``), only min_length=12 is enforced.
    In production mode, uppercase/lowercase/digit/special are also required.
    """

    def test_short_password_rejected_at_schema_level(self) -> None:
        """Passwords < 12 chars should be rejected with 422 by Pydantic."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Short1!"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_empty_password_rejected(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": ""},
        )
        self.assertEqual(resp.status_code, 422)

    def test_valid_length_password_not_rejected_by_validation(self) -> None:
        """A 12+ char password should pass validation (even if credentials wrong)."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Wrong_Pass_9999!"},
        )
        # Should get 401 (bad credentials) not 422 (validation)
        self.assertEqual(resp.status_code, 401)

    def test_exact_12_chars_accepted(self) -> None:
        """Passwords of exactly 12 characters should pass validation."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Abcdefghij1!"},
        )
        self.assertNotEqual(resp.status_code, 422)

    def test_128_char_password_accepted(self) -> None:
        """Max-length password should pass validation."""
        client = TestClient(app)
        long_pw = "A" * 60 + "a" * 60 + "1234567!"
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": long_pw},
        )
        self.assertNotEqual(resp.status_code, 422)

    def test_oversized_password_rejected(self) -> None:
        """Passwords > 128 chars should be rejected."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "P" * 129},
        )
        self.assertEqual(resp.status_code, 422)

    def test_default_passwords_meet_complexity(self) -> None:
        """All DEFAULT_PASSWORDS should pass the complexity checks."""
        import re

        for username, pw in DEFAULT_PASSWORDS.items():
            self.assertGreaterEqual(len(pw), 12, f"{username}'s password too short")
            self.assertTrue(re.search(r"[A-Z]", pw), f"{username}: missing uppercase")
            self.assertTrue(re.search(r"[a-z]", pw), f"{username}: missing lowercase")
            self.assertTrue(re.search(r"\d", pw), f"{username}: missing digit")
            self.assertTrue(
                re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>?]", pw),
                f"{username}: missing special char",
            )


# ---------------------------------------------------------------------------
# Phase 1.3 — JWT Key Rotation
# ---------------------------------------------------------------------------


class TestJWTKeyRotation(unittest.TestCase):
    """Verify that tokens signed with the previous key remain valid."""

    def test_current_key_works(self) -> None:
        svc = AuthService(secret_key="new-key", previous_secret_key="old-key")
        token = svc.create_token("admin", "admin")
        payload = svc.verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.sub, "admin")

    def test_previous_key_accepted(self) -> None:
        old_svc = AuthService(secret_key="old-key")
        new_svc = AuthService(secret_key="new-key", previous_secret_key="old-key")
        token = old_svc.create_token("admin", "admin")
        # New service should accept the old token
        payload = new_svc.verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.sub, "admin")

    def test_unknown_key_rejected(self) -> None:
        rogue_svc = AuthService(secret_key="rogue-key")
        new_svc = AuthService(secret_key="new-key", previous_secret_key="old-key")
        token = rogue_svc.create_token("admin", "admin")
        payload = new_svc.verify_token(token)
        self.assertIsNone(payload)

    def test_new_tokens_always_use_current_key(self) -> None:
        new_svc = AuthService(secret_key="new-key", previous_secret_key="old-key")
        token = new_svc.create_token("admin", "admin")
        # Should be verifiable with current key only
        current_only = AuthService(secret_key="new-key")
        self.assertIsNotNone(current_only.verify_token(token))
        # Should NOT be verifiable with old key only
        old_only = AuthService(secret_key="old-key")
        self.assertIsNone(old_only.verify_token(token))

    def test_no_previous_key_is_safe(self) -> None:
        svc = AuthService(secret_key="current-key")
        token = svc.create_token("admin", "admin")
        payload = svc.verify_token(token)
        self.assertIsNotNone(payload)

    def test_extract_jti_with_previous_key(self) -> None:
        old_svc = AuthService(secret_key="old-key")
        new_svc = AuthService(secret_key="new-key", previous_secret_key="old-key")
        token = old_svc.create_token("admin", "admin")
        jti = new_svc.extract_jti(token)
        self.assertIsNotNone(jti)

    def test_extract_jti_rogue_key_returns_none(self) -> None:
        rogue = AuthService(secret_key="rogue-key")
        new_svc = AuthService(secret_key="new-key", previous_secret_key="old-key")
        token = rogue.create_token("admin", "admin")
        jti = new_svc.extract_jti(token)
        self.assertIsNone(jti)

    def test_kid_in_token_header(self) -> None:
        """Tokens should include a ``kid`` (Key ID) in the JWT header."""
        import jwt as pyjwt

        svc = AuthService(secret_key="test-key")
        token = svc.create_token("admin", "admin")
        header = pyjwt.get_unverified_header(token)
        self.assertIn("kid", header)

    def test_service_token_has_kid(self) -> None:
        """Service tokens should also include the ``kid`` header."""
        import jwt as pyjwt

        svc = AuthService(secret_key="test-key")
        token = svc.create_service_token("svc-test")
        header = pyjwt.get_unverified_header(token)
        self.assertIn("kid", header)


if __name__ == "__main__":
    unittest.main()
