"""1E.3: Integration tests for each scenario end-to-end."""
from __future__ import annotations

import unittest
from uuid import uuid4

from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.services.scenario_service import ScenarioEngine
from app.store import InMemoryStore


class ScenarioTestBase(unittest.TestCase):
    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.telemetry = TelemetryService(self.store)
        self.detection = DetectionService(self.telemetry)
        self.response = ResponseOrchestrator(self.store)
        self.incidents = IncidentService(self.store)
        self.pipeline = EventPipelineService(
            telemetry=self.telemetry,
            detection=self.detection,
            response=self.response,
            incidents=self.incidents,
            store=self.store,
        )
        self.identity = IdentityService(self.store)
        self.documents = DocumentService(store=self.store)
        self.engine = ScenarioEngine(
            identity=self.identity,
            documents=self.documents,
            pipeline=self.pipeline,
            store=self.store,
        )


class TestSCNAUTH001(ScenarioTestBase):
    """SCN-AUTH-001: Credential Abuse With Suspicious Success."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_auth_001(corr)

        self.assertEqual(summary["scenario_id"], "SCN-AUTH-001")
        self.assertEqual(summary["correlation_id"], corr)

        # Must produce events, alerts, responses
        self.assertGreater(summary["events_total"], 0)
        self.assertGreaterEqual(summary["alerts_total"], 2)
        self.assertGreaterEqual(summary["responses_total"], 2)

        # Must flag step-up
        self.assertTrue(summary["step_up_required"])

        # Must create incident
        self.assertIsNotNone(summary["incident_id"])

    def test_incident_has_timeline(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_auth_001(corr)
        incident = self.store.incidents_by_correlation[corr]

        self.assertGreater(len(incident.timeline), 0)
        entry_types = {e.entry_type for e in incident.timeline}
        self.assertIn("detection", entry_types)
        self.assertIn("response", entry_types)
        self.assertIn("state_transition", entry_types)

    def test_detection_rule_ids(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_auth_001(corr)
        incident = self.store.incidents_by_correlation[corr]
        self.assertIn("DET-AUTH-002", incident.detection_ids)

    def test_alerts_match_expected_rules(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_auth_001(corr)
        rule_ids = {a.rule_id for a in self.store.alerts if a.correlation_id == corr}
        self.assertIn("DET-AUTH-001", rule_ids)
        self.assertIn("DET-AUTH-002", rule_ids)


class TestSCNSESSION002(ScenarioTestBase):
    """SCN-SESSION-002: Session Token Reuse Attack."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_session_002(corr)

        self.assertEqual(summary["scenario_id"], "SCN-SESSION-002")
        self.assertGreater(summary["events_total"], 0)
        self.assertGreaterEqual(summary["alerts_total"], 1)

        # Session must be revoked
        self.assertGreater(len(summary["revoked_sessions"]), 0)

    def test_session_revocation_alert(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_session_002(corr)
        rule_ids = {a.rule_id for a in self.store.alerts if a.correlation_id == corr}
        self.assertIn("DET-SESSION-003", rule_ids)

    def test_incident_created(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_session_002(corr)
        incident = self.store.incidents_by_correlation.get(corr)
        self.assertIsNotNone(incident)
        self.assertEqual(incident.incident_type, "session_hijack")


class TestSCNDOC003(ScenarioTestBase):
    """SCN-DOC-003: Bulk Document Access."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_doc_003(corr)

        self.assertEqual(summary["scenario_id"], "SCN-DOC-003")
        self.assertGreaterEqual(summary["events_total"], 20)
        self.assertGreaterEqual(summary["alerts_total"], 1)

    def test_download_restricted(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_doc_003(corr)
        self.assertIn("user-bob", summary["download_restricted_actors"])

    def test_detection_rule(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_doc_003(corr)
        rule_ids = {a.rule_id for a in self.store.alerts if a.correlation_id == corr}
        self.assertIn("DET-DOC-005", rule_ids)


class TestSCNDOC004(ScenarioTestBase):
    """SCN-DOC-004: Read-To-Download Exfiltration Pattern."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_doc_004(corr)

        self.assertEqual(summary["scenario_id"], "SCN-DOC-004")
        self.assertGreater(summary["events_total"], 0)
        self.assertGreaterEqual(summary["alerts_total"], 1)

    def test_exfiltration_detection(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_doc_004(corr)
        rule_ids = {a.rule_id for a in self.store.alerts if a.correlation_id == corr}
        self.assertIn("DET-DOC-006", rule_ids)

    def test_download_restricted_after_exfiltration(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_doc_004(corr)
        self.assertIn("user-bob", summary["download_restricted_actors"])


if __name__ == "__main__":
    unittest.main()
