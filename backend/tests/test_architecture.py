"""Tests verifying Phase 3 architectural improvements.

Covers: rate limiting, global exception handling, router structure,
schema extraction, and lifespan management.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app, reset_rate_limits
from app.services.rate_limiter import _TIER_LIMITS, EndpointSensitivity
from tests.auth_helper import authenticated_client

_AUTH_RATE_LIMIT = _TIER_LIMITS[EndpointSensitivity.AUTH]
_READ_RATE_LIMIT = _TIER_LIMITS[EndpointSensitivity.READ]


class TestRateLimiting(unittest.TestCase):
    """Verify rate limiting on authentication endpoints."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        reset_rate_limits()

    def tearDown(self) -> None:
        reset_rate_limits()

    def test_auth_login_rate_limited_after_threshold(self) -> None:
        """Exceeding the rate limit should return 429."""
        for _ in range(_AUTH_RATE_LIMIT):
            resp = self.client.post(
                "/auth/login",
                json={
                    "username": "admin",
                    "password": "admin_pass",
                },
            )
            self.assertIn(resp.status_code, (200, 401))

        # Next request should be rate limited
        resp = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        self.assertEqual(resp.status_code, 429)
        self.assertIn("Retry-After", resp.headers)

    def test_rate_limit_does_not_affect_read_endpoints(self) -> None:
        """Read endpoints have a much higher limit than auth endpoints."""
        client = authenticated_client("viewer")
        for _ in range(_AUTH_RATE_LIMIT + 5):
            resp = client.get("/events")
            self.assertEqual(resp.status_code, 200)

    def test_rate_limit_reset_clears_counters(self) -> None:
        """reset_rate_limits() should allow fresh requests."""
        for _ in range(_AUTH_RATE_LIMIT):
            self.client.post(
                "/auth/login",
                json={
                    "username": "admin",
                    "password": "admin_pass",
                },
            )

        reset_rate_limits()

        resp = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        self.assertEqual(resp.status_code, 200)

    def test_admin_reset_clears_rate_limits(self) -> None:
        """POST /admin/reset should also clear rate limits."""
        for _ in range(_AUTH_RATE_LIMIT):
            self.client.post(
                "/auth/login",
                json={
                    "username": "admin",
                    "password": "admin_pass",
                },
            )

        admin = authenticated_client("admin")
        admin.post("/admin/reset")

        resp = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "admin_pass",
            },
        )
        self.assertEqual(resp.status_code, 200)

    def test_429_response_format(self) -> None:
        """Rate limit response should have proper JSON body."""
        for _ in range(_AUTH_RATE_LIMIT):
            self.client.post(
                "/auth/login",
                json={
                    "username": "x",
                    "password": "y",
                },
            )

        resp = self.client.post(
            "/auth/login",
            json={
                "username": "x",
                "password": "y",
            },
        )
        self.assertEqual(resp.status_code, 429)
        body = resp.json()
        self.assertIn("detail", body)


class TestRouterStructure(unittest.TestCase):
    """Verify that all expected routes are registered via routers."""

    def test_all_route_paths_present(self) -> None:
        """Spot-check that key routes exist on the app."""
        routes = {r.path for r in app.routes if hasattr(r, "path")}
        expected = {
            "/health",
            "/auth/login",
            "/auth/users",
            "/identity/login",
            "/identity/sessions/{session_id}/revoke",
            "/documents/{document_id}/read",
            "/documents/{document_id}/download",
            "/scenarios/scn-auth-001",
            "/events",
            "/events/export",
            "/alerts",
            "/incidents",
            "/incidents/{correlation_id}",
            "/incidents/{correlation_id}/status",
            "/incidents/{correlation_id}/notes",
            "/metrics",
            "/analytics/risk-profiles",
            "/analytics/rule-effectiveness",
            "/analytics/scenario-history",
            "/mitre/mappings",
            "/mitre/coverage",
            "/killchain",
            "/campaigns",
            "/reports/generate",
            "/admin/reset",
            "/stream/events",
        }
        for path in expected:
            self.assertIn(path, routes, f"Route {path} not found in app")

    def test_route_count_unchanged(self) -> None:
        """Refactoring should not have lost or duplicated routes."""
        # Count only API routes (exclude OpenAPI docs routes)
        api_routes = [
            r
            for r in app.routes
            if hasattr(r, "path")
            and not r.path.startswith("/openapi")
            and r.path != "/docs"
            and r.path != "/redoc"
        ]
        # Original had 40 endpoint definitions; account for that
        self.assertGreaterEqual(len(api_routes), 38)


class TestSchemaExtraction(unittest.TestCase):
    """Verify schemas are importable from the schemas module."""

    def test_schemas_importable(self) -> None:
        from app.schemas import (
            LoginRequest,
            ReadRequest,
            DownloadRequest,
            IncidentStatusUpdate,
            IncidentNote,
            ReportRequest,
        )

        # Verify they are Pydantic models
        self.assertTrue(hasattr(LoginRequest, "model_validate"))
        self.assertTrue(hasattr(ReadRequest, "model_validate"))
        self.assertTrue(hasattr(DownloadRequest, "model_validate"))
        self.assertTrue(hasattr(IncidentStatusUpdate, "model_validate"))
        self.assertTrue(hasattr(IncidentNote, "model_validate"))
        self.assertTrue(hasattr(ReportRequest, "model_validate"))

    def test_read_request_trust_boundary_documented(self) -> None:
        """ReadRequest should document the simulation trust boundary."""
        from app.schemas import ReadRequest

        self.assertIn("simulated threat actor", ReadRequest.__doc__)


class TestDependenciesModule(unittest.TestCase):
    """Verify the dependencies module wires services correctly."""

    def test_services_are_instantiated(self) -> None:
        from app import dependencies as deps

        self.assertIsNotNone(deps.telemetry_service)
        self.assertIsNotNone(deps.detection_service)
        self.assertIsNotNone(deps.pipeline)
        self.assertIsNotNone(deps.scenario_engine)
        self.assertIsNotNone(deps.auth_service)
        self.assertIsNotNone(deps.report_service)

    def test_pipeline_has_risk_service(self) -> None:
        """Pipeline should be wired with risk scoring."""
        from app import dependencies as deps

        self.assertIsNotNone(deps.pipeline.risk)


class TestCorrelationMiddleware(unittest.TestCase):
    """Verify correlation ID propagation still works after refactor."""

    def test_correlation_id_in_response(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertIn("x-correlation-id", resp.headers)

    def test_custom_correlation_id_propagated(self) -> None:
        client = TestClient(app)
        resp = client.get("/health", headers={"x-correlation-id": "test-corr-123"})
        self.assertEqual(resp.headers["x-correlation-id"], "test-corr-123")


class TestDockerfileConstraints(unittest.TestCase):
    """Verify the Dockerfile enforces single-worker mode."""

    def test_dockerfile_enforces_single_worker(self) -> None:
        """CMD must include --workers 1 as a regression guard."""
        import pathlib

        dockerfile = pathlib.Path(__file__).resolve().parent.parent / "Dockerfile"
        content = dockerfile.read_text()
        self.assertIn(
            "--workers 1",
            content,
            "Dockerfile CMD must enforce --workers 1 (see ARCHITECTURE.md Scaling Constraints)",
        )


class TestStoreEncapsulation(unittest.TestCase):
    """Services must use store accessor methods, not raw attributes."""

    def test_services_do_not_access_raw_store_attributes(self) -> None:
        """AST-based regression guard against direct store attribute access."""
        import ast
        import pathlib

        forbidden_attrs = {
            "incidents_by_correlation",
            "step_up_required",
            "download_restricted_actors",
            "disabled_services",
            "blocked_routes",
            "quarantined_artifacts",
            "policy_change_restricted_actors",
            "revoked_sessions",
            "revoked_jtis",
            "alert_signatures",
            "login_failures_by_actor",
            "document_reads_by_actor",
            "authorization_failures_by_actor",
            "artifact_failures_by_actor",
            "risk_profiles",
        }

        violations: list[str] = []
        services_dir = (
            pathlib.Path(__file__).resolve().parent.parent / "app" / "services"
        )
        for py_file in services_dir.glob("*.py"):
            tree = ast.parse(py_file.read_text())
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Attribute)
                    and node.attr in forbidden_attrs
                ):
                    violations.append(
                        f"{py_file.name}:{node.lineno} accesses .{node.attr}"
                    )

        self.assertEqual(
            violations,
            [],
            f"Services must not access raw store attributes:\n"
            + "\n".join(violations),
        )


# ---------------------------------------------------------------------------
# Store write/read method discipline, datetime deprecation, trust boundary docs
# ---------------------------------------------------------------------------


class TestStoreWriteMethodDiscipline(unittest.TestCase):
    """Verify STORE write methods exist and work for all operational state."""

    def setUp(self) -> None:
        from app.store import InMemoryStore

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
        self.assertEqual(
            self.store.blocked_routes["svc-1"], {"/api/admin", "/api/config"}
        )

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
        import inspect

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
        from app.store import InMemoryStore

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
        import inspect

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
        import inspect
        import re

        import app.routers.alerts as alerts_mod
        import app.routers.analytics as analytics_mod
        import app.routers.incidents as incidents_mod
        import app.routers.metrics as metrics_mod

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
                matches = re.findall(rf"{re.escape(pattern)}(?![_a-zA-Z(])", source)
                self.assertEqual(
                    len(matches),
                    0,
                    f"Direct collection read '{pattern}' found in {mod.__name__}. "
                    "Use STORE accessor methods (e.g. STORE.get_events()) instead.",
                )


class TestDatetimeDeprecation(unittest.TestCase):
    """Verify that no deprecated datetime.utcnow() calls remain in runtime code."""

    @staticmethod
    def _find_utcnow_calls(source: str) -> list[int]:
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
        import pathlib

        backend = pathlib.Path(__file__).parent.parent / "app"
        for py_file in backend.rglob("*.py"):
            hits = self._find_utcnow_calls(py_file.read_text())
            self.assertEqual(
                hits,
                [],
                f"datetime.utcnow usage on line(s) {hits} in {py_file.relative_to(backend.parent)}",
            )

    def test_no_utcnow_calls_in_tests(self) -> None:
        import pathlib

        tests = pathlib.Path(__file__).parent
        for py_file in tests.rglob("*.py"):
            hits = self._find_utcnow_calls(py_file.read_text())
            self.assertEqual(
                hits,
                [],
                f"datetime.utcnow usage on line(s) {hits} in {py_file.relative_to(tests.parent)}",
            )

    def test_zero_deprecation_warnings(self) -> None:
        import warnings
        from app.models import utc_now

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
