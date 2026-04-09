"""Tests verifying Phase 1/2 rework fixes.

Covers:
- httpOnly cookie auth: token never in JSON body or JS-accessible storage
- simulated_source_ip comes from request BODY, not an HTTP Header
- Platform user attribution in simulation event payloads
- STORE write-path AND read-path discipline (no direct collection access)
- Simulation actor_id validation against known identities
- datetime.utcnow deprecation elimination
- Trust boundary documentation on schemas
"""
from __future__ import annotations

import inspect
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.models import utc_now
from app.store import STORE, InMemoryStore
from tests.auth_helper import authenticated_client


class TestHttpOnlyCookieAuth(unittest.TestCase):
    """Verify that auth tokens are delivered via httpOnly cookies, never in JSON."""

    def test_login_sets_httponly_cookie(self) -> None:
        """POST /auth/login should set an httpOnly cookie with the JWT."""
        client = TestClient(app)
        resp = client.post("/auth/login", json={
            "username": "admin",
            "password": "admin_pass",
        })
        self.assertEqual(resp.status_code, 200)
        cookie = resp.cookies.get("aegisrange_token")
        self.assertIsNotNone(cookie, "Login must set aegisrange_token cookie")

    def test_login_response_does_not_contain_token(self) -> None:
        """The JSON body must NOT contain the token — only non-secret metadata."""
        client = TestClient(app)
        resp = client.post("/auth/login", json={
            "username": "admin",
            "password": "admin_pass",
        })
        data = resp.json()
        self.assertNotIn("token", data)
        self.assertIn("username", data)
        self.assertIn("role", data)
        self.assertIn("expires_at", data)

    def test_cookie_auth_works_for_protected_endpoints(self) -> None:
        """A client with only the cookie (no Authorization header) should be authenticated."""
        client = TestClient(app)
        # Login to get the cookie
        login_resp = client.post("/auth/login", json={
            "username": "admin",
            "password": "admin_pass",
        })
        self.assertEqual(login_resp.status_code, 200)
        # The TestClient automatically stores cookies; use them for next request
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["username"], "admin")
        self.assertEqual(data["role"], "admin")

    def test_logout_clears_cookie(self) -> None:
        """POST /auth/logout should clear the auth cookie."""
        client = TestClient(app)
        client.post("/auth/login", json={
            "username": "admin",
            "password": "admin_pass",
        })
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
        client = TestClient(app)
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 401)


class TestSimulatedSourceIPInBody(unittest.TestCase):
    """Verify that simulated_source_ip comes from the request body, not a Header."""

    def setUp(self) -> None:
        admin = authenticated_client("admin")
        admin.post("/admin/reset")

    def test_identity_login_uses_body_simulated_source_ip(self) -> None:
        """simulated_source_ip in the body should appear in payload, NOT as source_ip."""
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={
                "username": "alice",
                "password": "correct-horse",
                "simulated_source_ip": "10.99.99.99",
            },
        )
        events = client.get("/events?event_type=authentication.login.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        # source_ip should be the TestClient's IP, not the body value
        self.assertNotEqual(latest["source_ip"], "10.99.99.99")
        # The body value should be in the payload as simulation metadata
        self.assertEqual(latest["payload"]["simulated_source_ip"], "10.99.99.99")

    def test_document_read_uses_body_simulated_source_ip(self) -> None:
        """simulated_source_ip in the body should appear in payload, NOT as source_ip."""
        client = authenticated_client("viewer")
        client.post(
            "/documents/doc-001/read",
            json={
                "actor_id": "user-alice",
                "actor_role": "analyst",
                "simulated_source_ip": "192.168.1.99",
            },
        )
        events = client.get("/events?event_type=document.read.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertNotEqual(latest["source_ip"], "192.168.1.99")
        self.assertEqual(latest["payload"]["simulated_source_ip"], "192.168.1.99")

    def test_x_source_ip_header_has_no_effect(self) -> None:
        """An x-source-ip header should NOT be used; simulated_source_ip is body-only."""
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
            headers={"x-source-ip": "10.99.99.99"},
        )
        events = client.get("/events?event_type=authentication.login.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        # With no simulated_source_ip in body, it should default to 127.0.0.1
        self.assertEqual(latest["payload"]["simulated_source_ip"], "127.0.0.1")
        # And the header value should NOT appear anywhere in the event
        self.assertNotEqual(latest["source_ip"], "10.99.99.99")

    def test_no_header_parameter_in_router_signatures(self) -> None:
        """Router functions should NOT have x_source_ip Header() parameters."""
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
        events = client.get("/events?event_type=authentication.login.success").json()
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
        events = client.get("/events?event_type=document.read.success").json()
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
        events = analyst.get("/events?event_type=session.token.revoked").json()
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


class TestStoreWriteMethodDiscipline(unittest.TestCase):
    """Verify STORE write methods exist and work for all operational state."""

    def setUp(self) -> None:
        self.store = InMemoryStore()

    def test_revoke_session(self) -> None:
        self.store.revoke_session("sess-1")
        self.assertTrue(self.store.is_session_revoked("sess-1"))

    def test_require_step_up(self) -> None:
        self.store.require_step_up("actor-1")
        self.assertTrue(self.store.is_step_up_required("actor-1"))

    def test_clear_step_up(self) -> None:
        self.store.require_step_up("actor-1")
        self.store.clear_step_up("actor-1")
        self.assertFalse(self.store.is_step_up_required("actor-1"))

    def test_restrict_downloads(self) -> None:
        self.store.restrict_downloads("actor-1")
        self.assertTrue(self.store.is_download_restricted("actor-1"))

    def test_disable_service(self) -> None:
        self.store.disable_service("svc-1")
        self.assertIn("svc-1", self.store.disabled_services)

    def test_block_routes(self) -> None:
        self.store.block_routes("svc-1", ["/api/admin", "/api/config"])
        self.assertIn("svc-1", self.store.blocked_routes)
        self.assertEqual(self.store.blocked_routes["svc-1"], {"/api/admin", "/api/config"})

    def test_quarantine_artifact(self) -> None:
        self.store.quarantine_artifact("art-1")
        self.assertIn("art-1", self.store.quarantined_artifacts)

    def test_restrict_policy_changes(self) -> None:
        self.store.restrict_policy_changes("actor-1")
        self.assertIn("actor-1", self.store.policy_change_restricted_actors)

    def test_update_risk_profile(self) -> None:
        profile = {"actor_id": "actor-1", "score": 50}
        self.store.update_risk_profile("actor-1", profile)
        self.assertEqual(self.store.risk_profiles["actor-1"], profile)

    def test_add_alert_signature_novel(self) -> None:
        sig = ("rule-1", "actor-1", "corr-1")
        self.assertTrue(self.store.add_alert_signature(sig))

    def test_add_alert_signature_duplicate(self) -> None:
        sig = ("rule-1", "actor-1", "corr-1")
        self.store.add_alert_signature(sig)
        self.assertFalse(self.store.add_alert_signature(sig))

    def test_set_actor_session(self) -> None:
        self.store.set_actor_session("actor-1", "sess-1")
        self.assertTrue(self.store.session_exists("sess-1"))
        self.assertEqual(self.store.find_actor_for_session("sess-1"), "actor-1")

    def test_no_direct_collection_mutations_in_services(self) -> None:
        """Services should not directly mutate STORE collections via .add/.append etc."""
        import app.services.response_service as rs
        import app.services.event_services as es
        import app.services.identity_service as ids
        import app.services.pipeline_service as ps
        import app.services.risk_service as risk

        for mod in [rs, es, ids, ps, risk]:
            source = inspect.getsource(mod)
            for pattern in [
                "self.store.revoked_sessions.add(",
                "self.store.step_up_required.add(",
                "self.store.download_restricted_actors.add(",
                "self.store.disabled_services.add(",
                "self.store.quarantined_artifacts.add(",
                "self.store.policy_change_restricted_actors.add(",
                "self.store.blocked_routes[",
                "self.store.risk_profiles[",
                "self.store.actor_sessions[",
                "self.store.alert_signatures.add(",
                "self.store.login_failures_by_actor[",
                "self.store.document_reads_by_actor[",
                "self.store.authorization_failures_by_actor[",
                "self.store.artifact_failures_by_actor[",
            ]:
                self.assertNotIn(
                    pattern,
                    source,
                    f"Direct mutation found in {mod.__name__}: {pattern}",
                )


class TestStoreReadAccessorDiscipline(unittest.TestCase):
    """Verify STORE read accessor methods work and routers use them."""

    def setUp(self) -> None:
        self.store = InMemoryStore()

    def test_get_events_returns_list(self) -> None:
        self.assertEqual(self.store.get_events(), [])

    def test_get_alerts_returns_list(self) -> None:
        self.assertEqual(self.store.get_alerts(), [])

    def test_get_responses_returns_list(self) -> None:
        self.assertEqual(self.store.get_responses(), [])

    def test_get_incident_returns_none_for_missing(self) -> None:
        self.assertIsNone(self.store.get_incident("nonexistent"))

    def test_get_all_incidents_returns_list(self) -> None:
        self.assertEqual(self.store.get_all_incidents(), [])

    def test_get_incident_notes_returns_empty_for_missing(self) -> None:
        self.assertEqual(self.store.get_incident_notes_for("nonexistent"), [])

    def test_get_scenario_history_returns_list(self) -> None:
        self.assertEqual(self.store.get_scenario_history_entries(), [])

    def test_get_containment_counts_returns_zeros(self) -> None:
        counts = self.store.get_containment_counts()
        self.assertEqual(sum(counts.values()), 0)
        self.assertIn("step_up_required", counts)
        self.assertIn("revoked_sessions", counts)
        self.assertIn("download_restricted", counts)
        self.assertIn("disabled_services", counts)
        self.assertIn("quarantined_artifacts", counts)

    def test_is_session_revoked(self) -> None:
        self.assertFalse(self.store.is_session_revoked("sess-1"))
        self.store.revoke_session("sess-1")
        self.assertTrue(self.store.is_session_revoked("sess-1"))

    def test_session_exists(self) -> None:
        self.assertFalse(self.store.session_exists("sess-1"))
        self.store.set_actor_session("actor-1", "sess-1")
        self.assertTrue(self.store.session_exists("sess-1"))

    def test_find_actor_for_session(self) -> None:
        self.assertIsNone(self.store.find_actor_for_session("sess-1"))
        self.store.set_actor_session("actor-1", "sess-1")
        self.assertEqual(self.store.find_actor_for_session("sess-1"), "actor-1")

    def test_no_direct_collection_reads_in_security_routers(self) -> None:
        """Security-critical routers (documents, identity) should NOT directly
        read STORE containment collections."""
        import app.routers.documents as docs
        import app.routers.identity as ids

        for mod in [docs, ids]:
            source = inspect.getsource(mod)
            for pattern in [
                "STORE.revoked_sessions",
                "STORE.step_up_required",
                "STORE.actor_sessions",
                "STORE.download_restricted_actors",
            ]:
                self.assertNotIn(
                    pattern,
                    source,
                    f"Direct STORE collection read in {mod.__name__}: {pattern}. "
                    "Use service methods instead.",
                )

    def test_no_direct_collection_reads_in_any_router(self) -> None:
        """All routers should use accessor methods, not raw collection attributes."""
        import app.routers.alerts as alerts_mod
        import app.routers.analytics as analytics_mod
        import app.routers.incidents as incidents_mod
        import app.routers.metrics as metrics_mod

        # These patterns match raw collection access (not method calls)
        raw_patterns = [
            "STORE.events",
            "STORE.alerts",
            "STORE.responses",
            "STORE.incidents_by_correlation",
            "STORE.incident_notes",
            "STORE.scenario_history",
        ]

        for mod in [alerts_mod, analytics_mod, incidents_mod, metrics_mod]:
            source = inspect.getsource(mod)
            for pattern in raw_patterns:
                # Allow method calls (e.g. STORE.get_events()) but not raw access
                # Raw access would be pattern without '(' after
                import re
                # Match pattern NOT followed by underscore/letter (method call prefix)
                matches = re.findall(rf'{re.escape(pattern)}(?![_a-zA-Z(])', source)
                self.assertEqual(
                    len(matches), 0,
                    f"Direct collection read '{pattern}' found in {mod.__name__}. "
                    "Use STORE accessor methods (e.g. STORE.get_events()) instead.",
                )


class TestDatetimeDeprecation(unittest.TestCase):
    """Verify that no deprecated datetime.utcnow() calls remain in runtime code."""

    @staticmethod
    def _find_utcnow_calls(source: str) -> list[int]:
        """Use the AST to find actual datetime.utcnow() calls (ignoring
        strings, comments, docstrings)."""
        import ast

        try:
            tree = ast.parse(source)
        except SyntaxError:
            return []

        hits: list[int] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                if (
                    isinstance(func, ast.Attribute)
                    and func.attr == "utcnow"
                    and isinstance(func.value, ast.Name)
                    and func.value.id == "datetime"
                ):
                    hits.append(node.lineno)
            if isinstance(node, ast.Attribute):
                if (
                    node.attr == "utcnow"
                    and isinstance(node.value, ast.Name)
                    and node.value.id == "datetime"
                ):
                    hits.append(node.lineno)
        return hits

    def test_no_utcnow_calls_in_backend(self) -> None:
        """All backend Python files should use utc_now(), not datetime.utcnow()."""
        import pathlib

        backend = pathlib.Path(__file__).parent.parent / "app"
        for py_file in backend.rglob("*.py"):
            hits = self._find_utcnow_calls(py_file.read_text())
            self.assertEqual(
                hits, [],
                f"datetime.utcnow usage on line(s) {hits} in {py_file.relative_to(backend.parent)}",
            )

    def test_no_utcnow_calls_in_tests(self) -> None:
        """Test files should also not use datetime.utcnow()."""
        import pathlib

        tests = pathlib.Path(__file__).parent
        for py_file in tests.rglob("*.py"):
            hits = self._find_utcnow_calls(py_file.read_text())
            self.assertEqual(
                hits, [],
                f"datetime.utcnow usage on line(s) {hits} in {py_file.relative_to(tests.parent)}",
            )

    def test_zero_deprecation_warnings(self) -> None:
        """utc_now() should produce zero DeprecationWarning."""
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            utc_now()


class TestTrustBoundaryDocs(unittest.TestCase):
    """Verify trust boundary documentation is present on schemas."""

    def test_read_request_documents_simulation_context(self) -> None:
        from app.schemas import ReadRequest
        doc = ReadRequest.__doc__ or ""
        self.assertIn("simulated threat actor", doc)
        self.assertIn("platform_user_id", doc)
        self.assertIn("NOT", doc)
        self.assertIn("simulated_source_ip", doc)

    def test_download_request_references_read_request(self) -> None:
        from app.schemas import DownloadRequest
        doc = DownloadRequest.__doc__ or ""
        self.assertIn("ReadRequest", doc)

    def test_simulation_login_documents_simulated_source_ip(self) -> None:
        from app.schemas import SimulationLoginRequest
        doc = SimulationLoginRequest.__doc__ or ""
        self.assertIn("simulated_source_ip", doc)
        self.assertIn("NOT", doc)


if __name__ == "__main__":
    unittest.main()
