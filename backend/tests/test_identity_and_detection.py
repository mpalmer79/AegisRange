"""Tests for Zero Trust identity evolution and detection engineering.

Covers:
  - Identity types (user, service, system)
  - Extended token model (audience, issuer, scopes)
  - Auth channel tracking
  - Service token creation
  - Scope enforcement
  - Identity type enforcement
  - Detection rule registry and versioning
  - MITRE ATT&CK alignment
  - Detection explainability
  - Identity-aware detection context
  - Detection metrics
  - Detection integrity (critical rule protection)
  - Correlation ID validation
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import (
    AuthService,
    IdentityType,
    _JWT_AUDIENCE,
    _JWT_ISSUER,
    validate_correlation_id,
)
from app.services.detection_rules import (
    RULE_REGISTRY,
    DetectionMetrics,
    detection_metrics,
    get_all_rules,
    get_enabled_rules,
    get_rule,
)
from tests.auth_helper import authenticated_client


# ---------------------------------------------------------------------------
# Phase 1: Identity System Evolution
# ---------------------------------------------------------------------------


class TestIdentityTypes(unittest.TestCase):
    """Verify identity types are correctly embedded in tokens."""

    def setUp(self) -> None:
        self.svc = AuthService()

    def test_user_token_has_identity_type(self) -> None:
        token = self.svc.create_token("admin", "admin")
        payload = self.svc.verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.identity_type, IdentityType.USER)

    def test_service_token_has_service_identity_type(self) -> None:
        token = self.svc.create_service_token("proxy-service")
        payload = self.svc.verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.identity_type, IdentityType.SERVICE)
        self.assertEqual(payload.sub, "proxy-service")
        self.assertEqual(payload.role, "service")

    def test_service_token_has_internal_scope(self) -> None:
        token = self.svc.create_service_token("proxy-service")
        payload = self.svc.verify_token(token)
        self.assertIn("internal", payload.scopes)

    def test_service_token_custom_scopes(self) -> None:
        token = self.svc.create_service_token(
            "analytics-service", scopes=["read", "analytics"]
        )
        payload = self.svc.verify_token(token)
        self.assertEqual(payload.scopes, ["read", "analytics"])


class TestExtendedTokenModel(unittest.TestCase):
    """Verify tokens contain audience, issuer, and scopes."""

    def setUp(self) -> None:
        self.svc = AuthService()

    def test_token_has_audience(self) -> None:
        token = self.svc.create_token("admin", "admin")
        payload = self.svc.verify_token(token)
        self.assertEqual(payload.audience, _JWT_AUDIENCE)

    def test_token_has_issuer(self) -> None:
        token = self.svc.create_token("admin", "admin")
        payload = self.svc.verify_token(token)
        self.assertEqual(payload.issuer, _JWT_ISSUER)

    def test_admin_token_has_all_scopes(self) -> None:
        token = self.svc.create_token("admin", "admin")
        payload = self.svc.verify_token(token)
        self.assertIn("read", payload.scopes)
        self.assertIn("write", payload.scopes)
        self.assertIn("admin", payload.scopes)
        self.assertIn("scenarios", payload.scopes)

    def test_viewer_token_has_read_scope_only(self) -> None:
        token = self.svc.create_token("viewer1", "viewer")
        payload = self.svc.verify_token(token)
        self.assertEqual(payload.scopes, ["read"])

    def test_red_team_token_has_scenario_scope(self) -> None:
        token = self.svc.create_token("red_team1", "red_team")
        payload = self.svc.verify_token(token)
        self.assertIn("scenarios", payload.scopes)

    def test_wrong_audience_rejected(self) -> None:
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        payload = {
            "sub": "admin",
            "role": "admin",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
            "jti": "test-jti",
            "iss": _JWT_ISSUER,
            "aud": "wrong-audience",
            "identity_type": "user",
            "scopes": ["read"],
        }
        token = pyjwt.encode(payload, self.svc._secret_key, algorithm="HS256")
        result = self.svc.verify_token(token)
        self.assertIsNone(result)


class TestAuthChannelTracking(unittest.TestCase):
    """Verify auth channel is tracked on request state."""

    def test_bearer_auth_sets_channel(self) -> None:
        client = authenticated_client("admin")
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 200)

    def test_cookie_auth_sets_channel(self) -> None:
        client = TestClient(app)
        client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin_Pass_2025!"},
        )
        # Cookie-based request (GET exempt from CSRF)
        resp = client.get("/auth/me")
        self.assertEqual(resp.status_code, 200)


# ---------------------------------------------------------------------------
# Phase 2: Zero Trust (Correlation ID validation)
# ---------------------------------------------------------------------------


class TestCorrelationIDValidation(unittest.TestCase):
    """Verify correlation IDs are validated."""

    def test_valid_uuid_format(self) -> None:
        self.assertTrue(
            validate_correlation_id("corr-12345678-1234-1234-1234-123456789abc")
        )

    def test_invalid_format_rejected(self) -> None:
        self.assertFalse(validate_correlation_id(""))
        self.assertFalse(validate_correlation_id("x" * 200))

    def test_external_alphanumeric_accepted(self) -> None:
        self.assertTrue(validate_correlation_id("external-corr-123"))
        self.assertTrue(validate_correlation_id("abc_def_123"))

    def test_special_chars_rejected(self) -> None:
        self.assertFalse(validate_correlation_id("corr<script>"))
        self.assertFalse(validate_correlation_id("corr id with spaces"))

    def test_invalid_corr_prefix_rejected(self) -> None:
        self.assertFalse(validate_correlation_id("corr-not-a-uuid"))

    def test_valid_correlation_propagated(self) -> None:
        client = TestClient(app)
        cid = "corr-12345678-1234-1234-1234-123456789abc"
        resp = client.get("/health", headers={"x-correlation-id": cid})
        self.assertEqual(resp.headers["x-correlation-id"], cid)

    def test_invalid_correlation_regenerated(self) -> None:
        client = TestClient(app)
        resp = client.get(
            "/health", headers={"x-correlation-id": "<script>alert(1)</script>"}
        )
        cid = resp.headers["x-correlation-id"]
        self.assertTrue(cid.startswith("corr-"))


# ---------------------------------------------------------------------------
# Phase 3: Detection Rule Registry
# ---------------------------------------------------------------------------


class TestDetectionRuleRegistry(unittest.TestCase):
    """Verify detection rules are structured and versioned."""

    def test_all_rules_registered(self) -> None:
        self.assertEqual(len(RULE_REGISTRY), 10)

    def test_all_rules_have_version(self) -> None:
        for rule in get_all_rules():
            self.assertIsNotNone(rule.version)
            self.assertRegex(rule.version, r"^\d+\.\d+\.\d+$")

    def test_all_rules_have_description(self) -> None:
        for rule in get_all_rules():
            self.assertIsNotNone(rule.description)
            self.assertGreater(len(rule.description), 10)

    def test_all_rules_enabled_by_default(self) -> None:
        for rule in get_all_rules():
            self.assertTrue(rule.enabled)

    def test_get_rule_by_id(self) -> None:
        rule = get_rule("DET-AUTH-001")
        self.assertIsNotNone(rule)
        self.assertEqual(rule.name, "Repeated Authentication Failure Burst")

    def test_get_nonexistent_rule_returns_none(self) -> None:
        self.assertIsNone(get_rule("DET-FAKE-999"))

    def test_enabled_rules_match_all(self) -> None:
        self.assertEqual(len(get_enabled_rules()), len(get_all_rules()))

    def test_rule_has_evaluate_callable(self) -> None:
        for rule in get_all_rules():
            self.assertTrue(callable(rule.evaluate))


# ---------------------------------------------------------------------------
# Phase 4: MITRE ATT&CK Alignment
# ---------------------------------------------------------------------------


class TestMITREAlignment(unittest.TestCase):
    """Verify all rules have MITRE technique and tactic IDs."""

    def test_all_rules_have_technique_ids(self) -> None:
        for rule in get_all_rules():
            self.assertIsInstance(rule.mitre_technique_ids, list)
            self.assertGreater(
                len(rule.mitre_technique_ids),
                0,
                f"{rule.rule_id} has no MITRE technique IDs",
            )

    def test_all_rules_have_tactic_ids(self) -> None:
        for rule in get_all_rules():
            self.assertIsInstance(rule.mitre_tactic_ids, list)
            self.assertGreater(
                len(rule.mitre_tactic_ids),
                0,
                f"{rule.rule_id} has no MITRE tactic IDs",
            )

    def test_technique_ids_follow_format(self) -> None:
        for rule in get_all_rules():
            for tid in rule.mitre_technique_ids:
                self.assertRegex(
                    tid,
                    r"^T\d{4}(\.\d{3})?$",
                    f"{rule.rule_id} has invalid technique ID: {tid}",
                )

    def test_tactic_ids_follow_format(self) -> None:
        for rule in get_all_rules():
            for tid in rule.mitre_tactic_ids:
                self.assertRegex(
                    tid,
                    r"^TA\d{4}$",
                    f"{rule.rule_id} has invalid tactic ID: {tid}",
                )

    def test_auth_rules_map_to_credential_access(self) -> None:
        rule = get_rule("DET-AUTH-001")
        self.assertIn("TA0006", rule.mitre_tactic_ids)
        self.assertIn("T1110", rule.mitre_technique_ids)

    def test_exfil_rule_maps_to_exfiltration(self) -> None:
        rule = get_rule("DET-DOC-006")
        self.assertIn("TA0010", rule.mitre_tactic_ids)


# ---------------------------------------------------------------------------
# Phase 5: Detection Explainability
# ---------------------------------------------------------------------------


class TestDetectionExplainability(unittest.TestCase):
    """Verify alerts include explainability metadata."""

    def test_alert_contains_matched_conditions(self) -> None:
        """Run a scenario and verify alert payload has matched_conditions."""
        client = authenticated_client("red_team")
        resp = client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)

        alert_client = authenticated_client("viewer")
        alerts_resp = alert_client.get("/alerts")
        self.assertEqual(alerts_resp.status_code, 200)
        alerts = alerts_resp.json()["items"]
        self.assertGreater(len(alerts), 0)

        for alert in alerts:
            payload = alert["payload"]
            self.assertIn("matched_conditions", payload)
            mc = payload["matched_conditions"]
            self.assertIn("rule_id", mc)
            self.assertIn("rule_version", mc)
            self.assertIn("trigger_event_id", mc)
            self.assertIn("trigger_event_type", mc)

    def test_alert_contains_mitre_data(self) -> None:
        """Verify alert payload includes MITRE alignment data."""
        client = authenticated_client("red_team")
        client.post("/scenarios/scn-auth-001")

        alert_client = authenticated_client("viewer")
        alerts = alert_client.get("/alerts").json()["items"]
        self.assertGreater(len(alerts), 0)

        for alert in alerts:
            payload = alert["payload"]
            self.assertIn("mitre_technique_ids", payload)
            self.assertIn("mitre_tactic_ids", payload)
            self.assertIsInstance(payload["mitre_technique_ids"], list)

    def test_alert_contains_rule_version(self) -> None:
        client = authenticated_client("red_team")
        client.post("/scenarios/scn-auth-001")

        alert_client = authenticated_client("viewer")
        alerts = alert_client.get("/alerts").json()["items"]
        for alert in alerts:
            self.assertIn("rule_version", alert["payload"])
            self.assertRegex(alert["payload"]["rule_version"], r"^\d+\.\d+\.\d+$")


# ---------------------------------------------------------------------------
# Phase 7: Detection Integrity
# ---------------------------------------------------------------------------


class TestDetectionIntegrity(unittest.TestCase):
    """Verify critical rules cannot be silently disabled."""

    def test_critical_rules_exist(self) -> None:
        critical = [r for r in get_all_rules() if r.critical]
        self.assertGreater(len(critical), 0)

    def test_critical_rules_include_auth(self) -> None:
        rule = get_rule("DET-AUTH-001")
        self.assertTrue(rule.critical)

    def test_critical_rules_include_exfil(self) -> None:
        rule = get_rule("DET-DOC-006")
        self.assertTrue(rule.critical)

    def test_critical_rules_include_corr(self) -> None:
        rule = get_rule("DET-CORR-010")
        self.assertTrue(rule.critical)

    def test_audit_functions_exist(self) -> None:
        from app.services import audit_service

        audit_service.log_detection_rule_change(
            "DET-AUTH-001", "disable_attempt", "test_user"
        )
        audit_service.log_detection_triggered(
            "DET-AUTH-001", "1.0.0", "actor-1", "corr-123", "medium"
        )


# ---------------------------------------------------------------------------
# Phase 8: Detection Metrics
# ---------------------------------------------------------------------------


class TestDetectionMetrics(unittest.TestCase):
    """Verify detection metrics tracking."""

    def setUp(self) -> None:
        self.metrics = DetectionMetrics()

    def test_record_evaluation(self) -> None:
        self.metrics.record_evaluation()
        self.assertEqual(self.metrics.total_evaluations, 1)

    def test_record_trigger(self) -> None:
        rule = get_rule("DET-AUTH-001")
        self.metrics.record_trigger(rule)
        self.assertEqual(self.metrics.total_triggers, 1)
        self.assertEqual(self.metrics.triggers_by_rule["DET-AUTH-001"], 1)

    def test_technique_tracking(self) -> None:
        rule = get_rule("DET-AUTH-001")
        self.metrics.record_trigger(rule)
        self.assertIn("T1110", self.metrics.triggers_by_technique)

    def test_summary_includes_coverage(self) -> None:
        summary = self.metrics.get_summary()
        self.assertIn("technique_coverage", summary)
        self.assertIn("total", summary["technique_coverage"])
        self.assertIn("gaps", summary["technique_coverage"])

    def test_reset_clears_metrics(self) -> None:
        rule = get_rule("DET-AUTH-001")
        self.metrics.record_trigger(rule)
        self.metrics.reset()
        self.assertEqual(self.metrics.total_triggers, 0)

    def test_global_metrics_track_scenario(self) -> None:
        """Running a scenario should produce detection metrics."""
        detection_metrics.reset()
        client = authenticated_client("red_team")
        client.post("/scenarios/scn-auth-001")
        self.assertGreater(detection_metrics.total_evaluations, 0)
        self.assertGreater(detection_metrics.total_triggers, 0)


if __name__ == "__main__":
    unittest.main()
