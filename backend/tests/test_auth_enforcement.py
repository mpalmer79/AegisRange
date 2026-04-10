"""Tests verifying that auth is enforced on protected routes."""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import (
    AuthService,
    _verify_password,
    _hash_password,
    _auth_service,
)
from app.store import STORE
from tests.auth_helper import get_viewer_token, authenticated_client


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
        resp = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
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


class TestMalformedTokens(unittest.TestCase):
    """Verify the system rejects various malformed and tampered tokens."""

    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_empty_bearer(self) -> None:
        self.client.headers["Authorization"] = "Bearer "
        resp = self.client.get("/events")
        self.assertIn(resp.status_code, (401, 422))

    def test_no_bearer_prefix(self) -> None:
        self.client.headers["Authorization"] = "Token some-value"
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 401)

    def test_garbage_token(self) -> None:
        self.client.headers["Authorization"] = "Bearer not.a.valid.jwt"
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 401)

    def test_truncated_token(self) -> None:
        self.client.headers["Authorization"] = "Bearer abc.def"
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 401)

    def test_wrong_secret_token(self) -> None:
        """Token signed with a different secret should be rejected."""
        rogue = AuthService(secret_key="wrong-secret-key")
        token = rogue.create_token("admin", "admin")
        self.client.headers["Authorization"] = f"Bearer {token}"
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 401)

    def test_expired_token_rejected(self) -> None:
        """A manually backdated token should fail verification."""
        svc = AuthService()
        # Build a token that expired 1 hour ago
        now = datetime.now(timezone.utc)
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": "admin",
            "role": "admin",
            "exp": (now - timedelta(hours=1)).isoformat(),
            "iat": (now - timedelta(hours=2)).isoformat(),
            "jti": "expired-test-jti",
        }
        h_b64 = svc._b64_encode(json.dumps(header, separators=(",", ":")))
        p_b64 = svc._b64_encode(json.dumps(payload, separators=(",", ":")))
        sig = svc._sign(f"{h_b64}.{p_b64}")
        s_b64 = svc._b64_encode(sig)
        expired_token = f"{h_b64}.{p_b64}.{s_b64}"

        self.client.headers["Authorization"] = f"Bearer {expired_token}"
        resp = self.client.get("/events")
        self.assertEqual(resp.status_code, 401)


class TestRoleBoundaryEscalation(unittest.TestCase):
    """Verify that lower-privilege roles cannot access higher-privilege endpoints."""

    def test_analyst_cannot_reset(self) -> None:
        client = authenticated_client("analyst")
        resp = client.post("/admin/reset")
        self.assertEqual(resp.status_code, 403)

    def test_red_team_cannot_reset(self) -> None:
        client = authenticated_client("red_team")
        resp = client.post("/admin/reset")
        self.assertEqual(resp.status_code, 403)

    def test_viewer_cannot_add_notes(self) -> None:
        """Viewer should not be able to write incident notes (requires analyst)."""
        # First create an incident via a red_team scenario
        rt = authenticated_client("red_team")
        resp = rt.post("/scenarios/scn-auth-001")
        corr_id = resp.json()["correlation_id"]

        viewer = authenticated_client("viewer")
        resp = viewer.post(
            f"/incidents/{corr_id}/notes",
            json={"author": "attacker", "content": "injected note"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_viewer_cannot_change_incident_status(self) -> None:
        rt = authenticated_client("red_team")
        resp = rt.post("/scenarios/scn-auth-001")
        corr_id = resp.json()["correlation_id"]

        viewer = authenticated_client("viewer")
        resp = viewer.patch(
            f"/incidents/{corr_id}/status",
            json={"status": "investigating"},
        )
        self.assertEqual(resp.status_code, 403)


class TestInputValidation(unittest.TestCase):
    """Verify query parameter validation bounds."""

    def setUp(self) -> None:
        self.client = authenticated_client("viewer")

    def test_since_minutes_negative_rejected(self) -> None:
        resp = self.client.get("/events?since_minutes=-1")
        self.assertEqual(resp.status_code, 422)

    def test_since_minutes_zero_rejected(self) -> None:
        resp = self.client.get("/events?since_minutes=0")
        self.assertEqual(resp.status_code, 422)

    def test_since_minutes_too_large_rejected(self) -> None:
        resp = self.client.get("/events?since_minutes=9999")
        self.assertEqual(resp.status_code, 422)

    def test_since_minutes_valid_accepted(self) -> None:
        resp = self.client.get("/events?since_minutes=60")
        self.assertEqual(resp.status_code, 200)

    def test_export_since_minutes_validated(self) -> None:
        resp = self.client.get("/events/export?since_minutes=-5")
        self.assertEqual(resp.status_code, 422)


class TestPasswordHashing(unittest.TestCase):
    """Verify PBKDF2 password hashing works correctly."""

    def test_hash_and_verify_roundtrip(self) -> None:
        pw = "test_password_123"
        pw_hash, pw_salt = _hash_password(pw)
        self.assertTrue(_verify_password(pw, pw_hash, pw_salt))

    def test_wrong_password_fails(self) -> None:
        pw_hash, pw_salt = _hash_password("correct_password")
        self.assertFalse(_verify_password("wrong_password", pw_hash, pw_salt))

    def test_different_salts_produce_different_hashes(self) -> None:
        pw = "same_password"
        h1, s1 = _hash_password(pw)
        h2, s2 = _hash_password(pw)
        self.assertNotEqual(s1, s2)  # salts differ
        self.assertNotEqual(h1, h2)  # hashes differ due to different salts

    def test_all_default_users_authenticate(self) -> None:
        svc = AuthService()
        for username in ("admin", "soc_lead", "analyst1", "red_team1", "viewer1"):
            success, token, _ = svc.authenticate(username, f"{username}_pass")
            self.assertTrue(success, f"{username} should authenticate with PBKDF2")
            self.assertIsNotNone(token)

    def test_old_plain_text_password_fails(self) -> None:
        """The old plain-text password format should no longer work."""
        svc = AuthService()
        # Passwords are now PBKDF2-hashed; supplying the hash directly should fail
        success, _, _ = svc.authenticate("admin", "admin_hash")
        self.assertFalse(success)


class TestConfigExternalization(unittest.TestCase):
    """Verify that auth config is sourced from Settings."""

    def test_custom_secret_produces_different_tokens(self) -> None:
        svc1 = AuthService(secret_key="secret-a")
        svc2 = AuthService(secret_key="secret-b")
        t1 = svc1.create_token("admin", "admin")
        t2 = svc2.create_token("admin", "admin")
        # Same payload but different signatures
        self.assertNotEqual(t1.split(".")[-1], t2.split(".")[-1])

    def test_token_from_one_secret_invalid_in_another(self) -> None:
        svc1 = AuthService(secret_key="secret-a")
        svc2 = AuthService(secret_key="secret-b")
        token = svc1.create_token("admin", "admin")
        self.assertIsNone(svc2.verify_token(token))

    def test_custom_expiry(self) -> None:
        svc = AuthService(token_expiry_hours=1)
        token = svc.create_token("admin", "admin")
        payload = svc.verify_token(token)
        self.assertIsNotNone(payload)
        # Verify expiry is ~1 hour from now, not 24
        delta = payload.exp - payload.iat
        self.assertLessEqual(delta.total_seconds(), 3601)


class TestTokenRevocationOnLogout(unittest.TestCase):
    """Verify that logging out revokes the token's JTI."""

    def setUp(self) -> None:
        STORE.reset()

    def test_token_rejected_after_logout(self) -> None:
        """A token used after logout must return 401."""
        client = TestClient(app)
        resp = client.post(
            "/auth/login",
            json={"username": "admin", "password": "admin_pass"},
        )
        self.assertEqual(resp.status_code, 200)
        token = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(token)

        # Verify the token works before logout
        resp = client.get(
            "/auth/me",
            cookies={"aegisrange_token": token},
        )
        self.assertEqual(resp.status_code, 200)

        # Logout
        resp = client.post(
            "/auth/logout",
            cookies={"aegisrange_token": token},
        )
        self.assertEqual(resp.status_code, 200)

        # Token should now be rejected
        resp = client.get(
            "/auth/me",
            cookies={"aegisrange_token": token},
        )
        self.assertEqual(resp.status_code, 401)

    def test_revoked_jti_persisted_across_reload(self) -> None:
        """Revoked JTIs must survive a simulated store reload."""
        import os
        import tempfile

        token = _auth_service.create_token("admin", "admin")
        jti = _auth_service.extract_jti(token)
        self.assertIsNotNone(jti)

        STORE.revoke_jti(jti)
        self.assertTrue(STORE.is_jti_revoked(jti))

        # Simulate persistence round-trip using a temp file
        fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            STORE.enable_persistence(db_path=db_path)
            STORE.save()

            # Reset in-memory state and reload
            STORE.revoked_jtis = set()
            self.assertFalse(STORE.is_jti_revoked(jti))

            STORE._persistence.load()
            self.assertTrue(
                STORE.is_jti_revoked(jti),
                "Revoked JTI should survive persistence reload",
            )
        finally:
            STORE._persistence = None
            os.unlink(db_path)

    def test_logout_without_cookie_is_safe(self) -> None:
        """Logout without a cookie should succeed without error."""
        client = TestClient(app)
        resp = client.post("/auth/logout")
        self.assertEqual(resp.status_code, 200)

    def test_logout_with_malformed_cookie_is_safe(self) -> None:
        """Logout with a malformed cookie should succeed gracefully."""
        client = TestClient(app)
        resp = client.post(
            "/auth/logout",
            cookies={"aegisrange_token": "not-a-valid-token"},
        )
        self.assertEqual(resp.status_code, 200)

    def test_bearer_header_also_rejected_after_revocation(self) -> None:
        """A revoked JTI should also be rejected via Authorization header."""
        token = _auth_service.create_token("admin", "admin")
        jti = _auth_service.extract_jti(token)
        STORE.revoke_jti(jti)

        client = TestClient(app)
        resp = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main()
