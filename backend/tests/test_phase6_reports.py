"""Tests for Phase 6: Exercise report generation and SSE streaming."""
from __future__ import annotations

import unittest

from app.main import app
from app.services.report_service import ReportService
from app.services.stream_service import StreamService
from app.store import STORE
from tests.auth_helper import authenticated_client


class TestReportService(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.service = ReportService(STORE)

    def test_generate_empty_report(self) -> None:
        report = self.service.generate_report()
        self.assertIsNotNone(report.report_id)
        self.assertEqual(report.title, "AegisRange Exercise Report")
        self.assertEqual(report.summary["total_events"], 0)
        self.assertEqual(report.summary["total_alerts"], 0)
        self.assertGreater(len(report.recommendations), 0)

    def test_generate_report_after_scenarios(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")
        client.post("/scenarios/scn-doc-003")

        report = self.service.generate_report("Test Exercise")
        self.assertEqual(report.title, "Test Exercise")
        self.assertGreater(report.summary["total_events"], 0)
        self.assertGreater(report.summary["total_alerts"], 0)
        self.assertGreater(report.summary["total_incidents"], 0)

    def test_report_detection_coverage(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")

        report = self.service.generate_report()
        self.assertEqual(report.detection_coverage["rules_total"], 10)
        self.assertGreater(report.detection_coverage["rules_triggered"], 0)

    def test_report_has_recommendations(self) -> None:
        report = self.service.generate_report()
        self.assertIsInstance(report.recommendations, list)
        self.assertGreater(len(report.recommendations), 0)

    def test_report_has_mitre_coverage(self) -> None:
        report = self.service.generate_report()
        self.assertIn("tactics_covered", report.mitre_coverage)
        self.assertIn("techniques_covered", report.mitre_coverage)
        self.assertIn("coverage_percentage", report.mitre_coverage)

    def test_to_dict_serialization(self) -> None:
        report = self.service.generate_report()
        d = self.service.to_dict(report)
        self.assertIn("report_id", d)
        self.assertIn("summary", d)
        self.assertIn("detection_coverage", d)
        self.assertIn("recommendations", d)
        self.assertIn("mitre_coverage", d)
        self.assertIn("generated_at", d)

    def test_report_response_effectiveness(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")

        report = self.service.generate_report()
        self.assertIn("total_responses", report.response_effectiveness)

    def test_report_risk_summary(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")

        report = self.service.generate_report()
        self.assertIn("actors_assessed", report.risk_summary)


class TestReportAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.client = authenticated_client()
        self.client.post("/admin/reset")

    def test_generate_report_endpoint(self) -> None:
        resp = self.client.post("/reports/generate")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("report_id", data)
        self.assertIn("summary", data)
        self.assertIn("recommendations", data)

    def test_generate_report_with_title(self) -> None:
        resp = self.client.post("/reports/generate", json={"title": "Custom Report"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Custom Report")

    def test_generate_report_after_scenarios(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        self.client.post("/scenarios/scn-corr-006")

        resp = self.client.post("/reports/generate")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["summary"]["total_events"], 0)
        self.assertGreater(data["summary"]["total_alerts"], 0)


class TestStreamService(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.service = StreamService(STORE)

    def test_subscribe_creates_queue(self) -> None:
        queue = self.service.subscribe()
        self.assertIsNotNone(queue)
        self.assertEqual(len(self.service.subscribers), 1)

    def test_unsubscribe_removes_queue(self) -> None:
        queue = self.service.subscribe()
        self.assertEqual(len(self.service.subscribers), 1)
        self.service.unsubscribe(queue)
        self.assertEqual(len(self.service.subscribers), 0)

    def test_publish_puts_message_on_queue(self) -> None:
        queue = self.service.subscribe()
        self.service.publish("alert", {"alert_id": "test-123"})
        # Queue should have a message
        self.assertFalse(queue.empty())

    def test_publish_to_multiple_subscribers(self) -> None:
        q1 = self.service.subscribe()
        q2 = self.service.subscribe()
        self.service.publish("event", {"event_id": "test"})
        self.assertFalse(q1.empty())
        self.assertFalse(q2.empty())


class TestStreamAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.client = authenticated_client()

    def test_stream_endpoint_exists(self) -> None:
        # Verify the endpoint is registered in the app routes
        routes = [r.path for r in app.routes]
        self.assertIn("/stream/events", routes)


if __name__ == "__main__":
    unittest.main()
