"""Tests for Phase 1: Authentication Hardening.

Covers:
  - Account lockout (NIST 800-53 AC-7)
  - Password complexity validation
  - JWT key rotation
"""

from __future__ import annotations

import time
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import (
    AuthService,
    _auth_service,
    validate_password_complexity,
)


# ---------------------------------------------------------------------------
# Phase 1.1 — Account Lockout
# ---------------------------------------------------------------------------


class TestAccountLockout(unittest.TestCase):
    """Verify account lockout after repeated failed login attempts."""

    def setUp(self) -> None:
        # Use a short lockout window (2 seconds) for fast tests
        self.service = AuthService(lockout_threshold=3, lockout_duration_minutes=1)

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
        success, token, _ = self.service.authenticate("admin", "admin_pass")
        self.assertFalse(success)
        self.assertIsNone(token)

    def test_lockout_clears_after_window(self) -> None:
        # Use a very short lockout (1 minute) and manually backdate attempts
        svc = AuthService(lockout_threshold=2, lockout_duration_minutes=1)
        # Record attempts as if they happened 2 minutes ago
        past = time.monotonic() - 121
        svc._login_attempts["admin"] = [past, past + 1]
        # The attempts are outside the 60-second window, so not locked
        self.assertFalse(svc.is_account_locked("admin"))

    def test_successful_login_clears_attempts(self) -> None:
        self.service.record_failed_attempt("admin")
        self.service.record_failed_attempt("admin")
        # Successful auth should clear history
        success, token, _ = self.service.authenticate("admin", "admin_pass")
        self.assertTrue(success)
        self.assertIsNotNone(token)
        self.assertFalse(self.service.is_account_locked("admin"))

    def test_failed_attempts_accumulate_via_authenticate(self) -> None:
        svc = AuthService(lockout_threshold=3, lockout_duration_minutes=5)
        for _ in range(3):
            svc.authenticate("admin", "wrong_password")
        # Account should now be locked
        self.assertTrue(svc.is_account_locked("admin"))
        # Even correct password should be rejected
        success, _, _ = svc.authenticate("admin", "admin_pass")
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
                json={"username": "viewer1", "password": "wrong"},
            )
        # The 6th attempt on a locked account should return 423
        resp = client.post(
            "/auth/login",
            json={"username": "viewer1", "password": "viewer1_pass"},
        )
        self.assertEqual(resp.status_code, 423)
        self.assertIn("locked", resp.json()["detail"].lower())

    def test_different_user_not_affected(self) -> None:
        client = TestClient(app)
        # Lock viewer1
        for _ in range(5):
            client.post(
                "/auth/login",
                json={"username": "viewer1", "password": "wrong"},
            )
        # analyst1 should still be able to log in
        resp = client.post(
            "/auth/login",
            json={"username": "analyst1", "password": "analyst1_pass"},
        )
        self.assertEqual(resp.status_code, 200)


# ---------------------------------------------------------------------------
# Phase 1.2 — Password Complexity Validation
# ---------------------------------------------------------------------------


class TestPasswordComplexity(unittest.TestCase):
    """Verify password complexity rules."""

    def test_strong_password_passes(self) -> None:
        violations = validate_password_complexity("MyStr0ng!Pass")
        self.assertEqual(violations, [])

    def test_too_short(self) -> None:
        violations = validate_password_complexity("Ab1!")
        self.assertTrue(any("at least" in v for v in violations))

    def test_missing_uppercase(self) -> None:
        violations = validate_password_complexity("mystrongpass1!")
        self.assertTrue(any("uppercase" in v for v in violations))

    def test_missing_lowercase(self) -> None:
        violations = validate_password_complexity("MYSTRONGPASS1!")
        self.assertTrue(any("lowercase" in v for v in violations))

    def test_missing_digit(self) -> None:
        violations = validate_password_complexity("MyStrongPass!")
        self.assertTrue(any("digit" in v for v in violations))

    def test_missing_special(self) -> None:
        violations = validate_password_complexity("MyStrongPass1")
        self.assertTrue(any("special" in v for v in violations))

    def test_all_violations_at_once(self) -> None:
        violations = validate_password_complexity("abc")
        # Should have violations for: length, uppercase, digit, special
        self.assertGreaterEqual(len(violations), 3)

    def test_exact_minimum_length(self) -> None:
        # 10 chars with all requirements
        violations = validate_password_complexity("Abcdefgh1!")
        self.assertEqual(violations, [])

    def test_empty_password(self) -> None:
        violations = validate_password_complexity("")
        self.assertGreater(len(violations), 0)


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


if __name__ == "__main__":
    unittest.main()
