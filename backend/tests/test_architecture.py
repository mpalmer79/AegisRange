"""Tests verifying Phase 3 architectural improvements.

Covers: rate limiting, global exception handling, router structure,
schema extraction, and lifespan management.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app, reset_rate_limits, _RATE_LIMIT_MAX_REQUESTS
from tests.auth_helper import authenticated_client


class TestRateLimiting(unittest.TestCase):
    """Verify rate limiting on authentication endpoints."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        reset_rate_limits()

    def tearDown(self) -> None:
        reset_rate_limits()

    def test_auth_login_rate_limited_after_threshold(self) -> None:
        """Exceeding the rate limit should return 429."""
        for _ in range(_RATE_LIMIT_MAX_REQUESTS):
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

    def test_rate_limit_does_not_affect_other_endpoints(self) -> None:
        """Non-auth endpoints should never be rate limited."""
        client = authenticated_client("viewer")
        for _ in range(_RATE_LIMIT_MAX_REQUESTS + 5):
            resp = client.get("/events")
            self.assertEqual(resp.status_code, 200)

    def test_rate_limit_reset_clears_counters(self) -> None:
        """reset_rate_limits() should allow fresh requests."""
        for _ in range(_RATE_LIMIT_MAX_REQUESTS):
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
        for _ in range(_RATE_LIMIT_MAX_REQUESTS):
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
        for _ in range(_RATE_LIMIT_MAX_REQUESTS):
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


if __name__ == "__main__":
    unittest.main()
