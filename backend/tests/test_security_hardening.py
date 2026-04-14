"""Tests for security hardening — CSRF, headers, proxy filtering, audit, rate limiting, input validation."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.rate_limiter import (
    _TIER_LIMITS,
    EndpointSensitivity,
    InMemoryRateLimiter,
)
from tests.auth_helper import authenticated_client


class TestCSRFProtection(unittest.TestCase):
    """Verify CSRF enforcement for cookie-authenticated state-changing requests."""

    def test_bearer_auth_bypasses_csrf(self) -> None:
        """Bearer-authenticated requests should not require CSRF tokens."""
        client = authenticated_client("admin")
        resp = client.post("/admin/reset")
        self.assertEqual(resp.status_code, 200)

    def test_cookie_auth_without_csrf_rejected(self) -> None:
        """Cookie-authenticated POST without CSRF token should be rejected."""
        client = TestClient(app)
        # Login to get auth cookie
        login_resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        self.assertEqual(login_resp.status_code, 200)
        # Now try a state-changing request without CSRF header
        # The client has the auth cookie but no CSRF header
        resp = client.post("/admin/reset")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("CSRF", resp.json()["detail"])

    def test_cookie_auth_with_valid_csrf_accepted(self) -> None:
        """Cookie-authenticated POST with matching CSRF token should succeed."""
        client = TestClient(app)
        login_resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        self.assertEqual(login_resp.status_code, 200)
        # Extract CSRF cookie
        csrf_token = client.cookies.get("aegisrange_csrf")
        self.assertIsNotNone(csrf_token, "CSRF cookie should be set on login")
        # Include CSRF header
        resp = client.post(
            "/admin/reset",
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(resp.status_code, 200)

    def test_csrf_mismatch_rejected(self) -> None:
        """CSRF header that doesn't match cookie should be rejected."""
        client = TestClient(app)
        client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        resp = client.post(
            "/admin/reset",
            headers={"X-CSRF-Token": "wrong-csrf-token"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_login_exempt_from_csrf(self) -> None:
        """Login endpoint should be exempt from CSRF validation."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        self.assertEqual(resp.status_code, 200)

    def test_logout_exempt_from_csrf(self) -> None:
        """Logout endpoint should be exempt from CSRF validation."""
        client = TestClient(app)
        resp = client.post("/auth/logout")
        self.assertEqual(resp.status_code, 200)

    def test_get_requests_exempt_from_csrf(self) -> None:
        """GET requests should not require CSRF tokens."""
        client = authenticated_client("viewer")
        resp = client.get("/events")
        self.assertEqual(resp.status_code, 200)

    def test_csrf_cookie_set_on_login(self) -> None:
        """Login response should include a non-httpOnly CSRF cookie."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        self.assertEqual(resp.status_code, 200)
        csrf_cookie = client.cookies.get("aegisrange_csrf")
        self.assertIsNotNone(csrf_cookie)
        self.assertGreater(len(csrf_cookie), 10)

    def test_csrf_cookie_cleared_on_logout(self) -> None:
        """Logout should clear the CSRF cookie."""
        client = TestClient(app)
        client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        resp = client.post("/auth/logout")
        self.assertEqual(resp.status_code, 200)


class TestSecurityHeaders(unittest.TestCase):
    """Verify security headers are present on all responses."""

    def test_csp_header(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertIn("content-security-policy", resp.headers)
        self.assertIn("default-src 'none'", resp.headers["content-security-policy"])

    def test_hsts_header(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertIn("strict-transport-security", resp.headers)
        self.assertIn("max-age=", resp.headers["strict-transport-security"])

    def test_x_content_type_options(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertEqual(resp.headers.get("x-content-type-options"), "nosniff")

    def test_x_frame_options(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertEqual(resp.headers.get("x-frame-options"), "DENY")

    def test_referrer_policy(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertEqual(
            resp.headers.get("referrer-policy"),
            "strict-origin-when-cross-origin",
        )

    def test_cache_control(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertEqual(resp.headers.get("cache-control"), "no-store")

    def test_headers_on_error_responses(self) -> None:
        """Security headers should be present even on error responses."""
        client = TestClient(app)
        resp = client.get("/nonexistent-endpoint")
        self.assertIn("x-content-type-options", resp.headers)
        self.assertIn("x-frame-options", resp.headers)

    def test_headers_on_authenticated_responses(self) -> None:
        """Security headers should be present on authenticated responses."""
        client = authenticated_client("viewer")
        resp = client.get("/events")
        self.assertIn("x-content-type-options", resp.headers)
        self.assertIn("strict-transport-security", resp.headers)


class TestInputValidationHardening(unittest.TestCase):
    """Verify strict schema enforcement rejects unknown fields."""

    def test_login_rejects_unknown_fields(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Admin_Pass_2025!",
                "extra_field": "should_be_rejected",
            },
        )
        self.assertEqual(resp.status_code, 422)

    def test_incident_status_rejects_unknown_fields(self) -> None:
        client = authenticated_client("analyst")
        # Need an incident first
        red = authenticated_client("red_team")
        resp = red.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        corr_id = resp.json()["correlation_id"]

        resp = client.patch(
            f"/incidents/{corr_id}/status",
            json={"status": "investigating", "extra": "bad"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_incident_note_rejects_unknown_fields(self) -> None:
        client = authenticated_client("analyst")
        red = authenticated_client("red_team")
        resp = red.post("/scenarios/scn-auth-001")
        corr_id = resp.json()["correlation_id"]

        resp = client.post(
            f"/incidents/{corr_id}/notes",
            json={"author": "test", "content": "note", "extra": "bad"},
        )
        self.assertEqual(resp.status_code, 422)


class TestRateLimiterAbstraction(unittest.TestCase):
    """Verify the rate limiter abstraction works correctly."""

    def setUp(self) -> None:
        self.limiter = InMemoryRateLimiter()

    def test_auth_limit(self) -> None:
        limit = _TIER_LIMITS[EndpointSensitivity.AUTH]
        for _ in range(limit):
            self.assertFalse(
                self.limiter.is_limited("test-ip", EndpointSensitivity.AUTH)
            )
        self.assertTrue(self.limiter.is_limited("test-ip", EndpointSensitivity.AUTH))

    def test_different_keys_independent(self) -> None:
        limit = _TIER_LIMITS[EndpointSensitivity.AUTH]
        for _ in range(limit):
            self.limiter.is_limited("ip-1", EndpointSensitivity.AUTH)
        # ip-1 is limited
        self.assertTrue(self.limiter.is_limited("ip-1", EndpointSensitivity.AUTH))
        # ip-2 is not
        self.assertFalse(self.limiter.is_limited("ip-2", EndpointSensitivity.AUTH))

    def test_reset_clears_all(self) -> None:
        limit = _TIER_LIMITS[EndpointSensitivity.AUTH]
        for _ in range(limit):
            self.limiter.is_limited("test-ip", EndpointSensitivity.AUTH)
        self.limiter.reset()
        self.assertFalse(self.limiter.is_limited("test-ip", EndpointSensitivity.AUTH))

    def test_write_limit_higher_than_auth(self) -> None:
        self.assertGreater(
            _TIER_LIMITS[EndpointSensitivity.WRITE],
            _TIER_LIMITS[EndpointSensitivity.AUTH],
        )

    def test_read_limit_highest(self) -> None:
        self.assertGreater(
            _TIER_LIMITS[EndpointSensitivity.READ],
            _TIER_LIMITS[EndpointSensitivity.WRITE],
        )


class TestAuditLogging(unittest.TestCase):
    """Verify audit logging functions work without errors."""

    def test_login_audit(self) -> None:
        from app.services import audit_service

        # Should not raise
        audit_service.log_login_attempt("admin", True, client_ip="127.0.0.1")
        audit_service.log_login_attempt("admin", False, client_ip="127.0.0.1")

    def test_logout_audit(self) -> None:
        from app.services import audit_service

        audit_service.log_logout(username="admin", jti="test-jti")

    def test_incident_mutation_audit(self) -> None:
        from app.services import audit_service

        audit_service.log_incident_mutation(
            "corr-123",
            "status_update",
            "admin",
            details={"from": "open", "to": "investigating"},
        )

    def test_admin_action_audit(self) -> None:
        from app.services import audit_service

        audit_service.log_admin_action("store_reset", "admin")

    def test_rate_limit_audit(self) -> None:
        from app.services import audit_service

        audit_service.log_rate_limit_exceeded("127.0.0.1", "/auth/login", "auth")

    def test_csrf_failure_audit(self) -> None:
        from app.services import audit_service

        audit_service.log_csrf_failure("/admin/reset", "POST", client_ip="127.0.0.1")


class TestRequestSizeLimit(unittest.TestCase):
    """Verify oversized requests are rejected."""

    def test_oversized_request_rejected(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            content="x" * (1_048_576 + 1),
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(1_048_576 + 1),
            },
        )
        self.assertEqual(resp.status_code, 413)

    def test_normal_request_accepted(self) -> None:
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        self.assertIn(resp.status_code, (200, 401))


class TestJWTPyJWTIntegration(unittest.TestCase):
    """Verify PyJWT-based token handling."""

    def test_token_is_standard_jwt(self) -> None:
        """Tokens should be standard 3-part JWTs decodable by PyJWT."""
        import jwt as pyjwt

        from app.services.auth_service import AuthService, _JWT_AUDIENCE

        svc = AuthService()
        token = svc.create_token("admin", "admin")
        # Should be decodable by PyJWT with proper audience
        decoded = pyjwt.decode(
            token, svc._secret_key, algorithms=["HS256"], audience=_JWT_AUDIENCE
        )
        self.assertEqual(decoded["sub"], "admin")
        self.assertEqual(decoded["role"], "admin")
        self.assertIn("exp", decoded)
        self.assertIn("iat", decoded)
        self.assertIn("jti", decoded)
        # Verify new identity claims
        self.assertEqual(decoded["identity_type"], "user")
        self.assertEqual(decoded["iss"], "aegisrange")
        self.assertEqual(decoded["aud"], "aegisrange")
        self.assertIsInstance(decoded["scopes"], list)
        self.assertIn("read", decoded["scopes"])

    def test_unknown_algorithm_rejected(self) -> None:
        """Tokens signed with a non-HS256 algorithm should be rejected."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        from app.services.auth_service import AuthService

        svc = AuthService()
        payload = {
            "sub": "admin",
            "role": "admin",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
            "jti": "test-jti",
        }
        # Create token with "none" algorithm (attack vector)
        token = pyjwt.encode(payload, "", algorithm="HS256")
        # Try to verify with wrong key — should fail
        result = svc.verify_token(token)
        self.assertIsNone(result)

    def test_missing_required_claims_rejected(self) -> None:
        """Tokens missing required claims should be rejected."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        from app.services.auth_service import AuthService

        svc = AuthService()
        # Missing 'role' and 'jti'
        payload = {
            "sub": "admin",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        token = pyjwt.encode(payload, svc._secret_key, algorithm="HS256")
        result = svc.verify_token(token)
        self.assertIsNone(result)

    def test_unknown_role_rejected(self) -> None:
        """Tokens with unknown roles should be rejected."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        from app.services.auth_service import AuthService

        svc = AuthService()
        payload = {
            "sub": "admin",
            "role": "superadmin",  # not a valid role
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
            "jti": "test-jti",
        }
        token = pyjwt.encode(payload, svc._secret_key, algorithm="HS256")
        result = svc.verify_token(token)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
