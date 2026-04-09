"""Phase 2-3: API route tests for new endpoints."""
from __future__ import annotations

import unittest

from app.store import STORE
from tests.auth_helper import authenticated_client


class APITestBase(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client()


class TestMetricsEndpoint(APITestBase):
    def test_metrics_empty(self) -> None:
        resp = self.client.get("/metrics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_events"], 0)
        self.assertEqual(data["total_alerts"], 0)
        self.assertEqual(data["total_incidents"], 0)

    def test_metrics_after_scenario(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/metrics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["total_events"], 0)
        self.assertGreater(data["total_alerts"], 0)
        self.assertGreater(data["total_incidents"], 0)
        self.assertGreater(data["active_containments"], 0)

    def test_metrics_keys(self) -> None:
        resp = self.client.get("/metrics")
        data = resp.json()
        expected_keys = {
            "total_events", "total_alerts", "total_responses",
            "total_incidents", "active_containments",
            "events_by_category", "alerts_by_severity",
            "incidents_by_status",
        }
        self.assertEqual(set(data.keys()), expected_keys)


class TestSCNSVC005Endpoint(APITestBase):
    def test_scn_svc_005(self) -> None:
        resp = self.client.post("/scenarios/scn-svc-005")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "SCN-SVC-005")
        self.assertIn("svc-data-processor", data["disabled_services"])

    def test_scn_svc_005_creates_incident(self) -> None:
        resp = self.client.post("/scenarios/scn-svc-005")
        data = resp.json()
        self.assertIsNotNone(data["incident_id"])

    def test_scn_svc_005_metrics(self) -> None:
        self.client.post("/scenarios/scn-svc-005")
        resp = self.client.get("/metrics")
        data = resp.json()
        self.assertGreater(data["active_containments"], 0)


class TestSCNCORR006Endpoint(APITestBase):
    def test_scn_corr_006(self) -> None:
        resp = self.client.post("/scenarios/scn-corr-006")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["scenario_id"], "SCN-CORR-006")
        self.assertIsNotNone(data["incident_id"])

    def test_scn_corr_006_has_alerts(self) -> None:
        resp = self.client.post("/scenarios/scn-corr-006")
        data = resp.json()
        self.assertGreaterEqual(data["alerts_total"], 3)

    def test_scn_corr_006_step_up(self) -> None:
        resp = self.client.post("/scenarios/scn-corr-006")
        data = resp.json()
        self.assertTrue(data["step_up_required"])

    def test_scn_corr_006_incident_detail(self) -> None:
        scenario_resp = self.client.post("/scenarios/scn-corr-006")
        corr = scenario_resp.json()["correlation_id"]

        resp = self.client.get(f"/incidents/{corr}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "open")
        self.assertGreater(len(data["timeline"]), 0)
        self.assertGreater(len(data["detection_ids"]), 0)


class TestNewAlertFiltering(APITestBase):
    def test_alerts_filter_svc_rule(self) -> None:
        self.client.post("/scenarios/scn-svc-005")
        resp = self.client.get("/alerts", params={"rule_id": "DET-SVC-007"})
        self.assertEqual(resp.status_code, 200)
        alerts = resp.json()
        self.assertGreater(len(alerts), 0)
        self.assertTrue(all(a["rule_id"] == "DET-SVC-007" for a in alerts))


class TestNewEventFiltering(APITestBase):
    def test_events_filter_authorization_failure(self) -> None:
        self.client.post("/scenarios/scn-svc-005")
        resp = self.client.get("/events", params={"event_type": "authorization.failure"})
        self.assertEqual(resp.status_code, 200)
        events = resp.json()
        self.assertGreater(len(events), 0)
        self.assertTrue(all(e["event_type"] == "authorization.failure" for e in events))


class TestResetClearsNewState(APITestBase):
    def test_reset_clears_phase2_state(self) -> None:
        self.client.post("/scenarios/scn-svc-005")
        self.assertGreater(len(STORE.disabled_services), 0)

        self.client.post("/admin/reset")
        self.assertEqual(len(STORE.disabled_services), 0)
        self.assertEqual(len(STORE.quarantined_artifacts), 0)
        self.assertEqual(len(STORE.policy_change_restricted_actors), 0)
        self.assertEqual(len(STORE.blocked_routes), 0)


if __name__ == "__main__":
    unittest.main()
