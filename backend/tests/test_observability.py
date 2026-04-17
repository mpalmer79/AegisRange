"""Tests for the 0.10.0 observability additions: enriched /health and
the /metrics/prometheus exposition endpoint."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.models import Confidence, Severity
from app.store import STORE
from tests.auth_helper import authenticated_client


class TestHealthEnrichment(unittest.TestCase):
    def test_health_returns_subsystems_block(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("subsystems", data)
        subsystems = data["subsystems"]
        self.assertIn("persistence_sqlite", subsystems)
        self.assertIn("auth_cache", subsystems)
        self.assertIn("jwt_secret_configured", subsystems)

    def test_health_reports_auth_cache_backend(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        data = resp.json()
        # Default deployment uses the in-memory cache.
        self.assertEqual(data["subsystems"]["auth_cache"]["backend"], "memory")
        self.assertEqual(data["subsystems"]["auth_cache"]["status"], "ok")

    def test_health_reports_version_and_uptime(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        data = resp.json()
        self.assertEqual(data["version"], "0.10.0")
        self.assertIsInstance(data["uptime_seconds"], float)
        self.assertGreaterEqual(data["uptime_seconds"], 0.0)

    def test_health_is_unauthenticated(self) -> None:
        """/health must stay unauthenticated — load balancer probes
        don't carry tokens."""
        client = TestClient(app)
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)


class TestPrometheusMetrics(unittest.TestCase):
    def test_prometheus_requires_admin(self) -> None:
        unauth = TestClient(app)
        resp = unauth.get("/metrics/prometheus")
        self.assertEqual(resp.status_code, 401)

    def test_prometheus_rejects_viewer(self) -> None:
        client = authenticated_client("viewer")
        resp = client.get("/metrics/prometheus")
        self.assertEqual(resp.status_code, 403)

    def test_prometheus_emits_openmetrics_text(self) -> None:
        client = authenticated_client("admin")
        resp = client.get("/metrics/prometheus")
        self.assertEqual(resp.status_code, 200)
        self.assertIn(
            "text/plain", resp.headers.get("content-type", "").lower()
        )
        body = resp.text
        # Required OpenMetrics framing.
        self.assertIn("# HELP aegisrange_events_total", body)
        self.assertIn("# TYPE aegisrange_events_total gauge", body)
        self.assertIn("aegisrange_events_total ", body)
        # Must end with a newline per spec.
        self.assertTrue(body.endswith("\n"))

    def test_prometheus_emits_per_rule_counters(self) -> None:
        client = authenticated_client("admin")
        resp = client.get("/metrics/prometheus")
        body = resp.text
        # Every registered rule gets a trigger-count line.
        self.assertIn('aegisrange_rule_triggers_total{rule_id="DET-AUTH-001"}', body)
        # Rules added in 0.10.0 are present.
        self.assertIn('aegisrange_rule_triggers_total{rule_id="DET-GEO-011"}', body)
        self.assertIn('aegisrange_rule_triggers_total{rule_id="DET-EXFIL-012"}', body)

    def test_prometheus_counts_alerts_by_severity(self) -> None:
        # Seed one HIGH alert.
        from app.models import Alert

        alert = Alert(
            rule_id="DET-AUTH-001",
            rule_name="t",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id="user-alice",
            correlation_id="corr-metric",
            contributing_event_ids=[],
            summary="",
            payload={},
        )
        STORE.extend_alerts([alert])
        try:
            client = authenticated_client("admin")
            resp = client.get("/metrics/prometheus")
            body = resp.text
            self.assertIn(
                'aegisrange_alerts_by_severity{severity="high"} 1', body
            )
        finally:
            # conftest autouse fixture resets the store between tests.
            pass

    def test_prometheus_label_escaping(self) -> None:
        """Ensure characters that would break label quoting are escaped.

        Not all rule ids contain such characters today, but if one ever
        does we must not emit invalid OpenMetrics. This guards the
        escaper directly."""
        from app.routers.metrics import _escape_label_value

        self.assertEqual(_escape_label_value('quote "x"'), 'quote \\"x\\"')
        self.assertEqual(_escape_label_value("slash \\ path"), "slash \\\\ path")
        self.assertEqual(_escape_label_value("line\nfeed"), "line\\nfeed")


if __name__ == "__main__":
    unittest.main()
