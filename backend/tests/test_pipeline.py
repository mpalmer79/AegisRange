from __future__ import annotations

import unittest
from uuid import uuid4

from app.models import Confidence, Event, Severity
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.services.scenario_service import ScenarioEngine
from app.store import InMemoryStore


class PipelinePhase2Tests(unittest.TestCase):
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
        self.documents = DocumentService()
        self.scenarios = ScenarioEngine(
            identity=self.identity,
            documents=self.documents,
            pipeline=self.pipeline,
            store=self.store,
        )

    def test_auth_scenario_creates_incident_and_step_up(self) -> None:
        correlation_id = f"corr-{uuid4()}"
        summary = self.scenarios.run_auth_001(correlation_id)

        self.assertEqual(summary["scenario_id"], "SCN-AUTH-001")
        self.assertGreaterEqual(summary["alerts_total"], 2)
        self.assertGreaterEqual(summary["responses_total"], 2)
        self.assertTrue(summary["step_up_required"])
        self.assertIsNotNone(summary["incident_id"])

    def test_session_reuse_revokes_session(self) -> None:
        correlation_id = f"corr-{uuid4()}"
        summary = self.scenarios.run_session_002(correlation_id)

        self.assertEqual(summary["scenario_id"], "SCN-SESSION-002")
        self.assertGreaterEqual(summary["alerts_total"], 1)
        self.assertIn("session-user-bob", summary["revoked_sessions"])

    def test_document_policy_mismatch_triggers_doc_rule(self) -> None:
        correlation_id = f"corr-{uuid4()}"
        event = Event(
            event_type="document.read.failure",
            category="document",
            actor_id="user-alice",
            actor_type="user",
            actor_role="analyst",
            target_type="document",
            target_id="doc-003",
            request_id=f"req-{uuid4()}",
            correlation_id=correlation_id,
            session_id="session-user-alice",
            source_ip="203.0.113.10",
            user_agent="test-client",
            origin="api",
            status="failure",
            status_code="403",
            error_message="classification_mismatch",
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.LOW,
            payload={"document_id": "doc-003", "classification": "restricted"},
        )

        result = self.pipeline.process(event)

        self.assertEqual(result["alerts"], 1)
        self.assertEqual(self.store.alerts[0].rule_id, "DET-DOC-004")
        self.assertEqual(self.store.responses[0].playbook_id, "PB-DOC-004")

    def test_read_to_download_exfiltration_pattern(self) -> None:
        correlation_id = f"corr-{uuid4()}"
        summary = self.scenarios.run_doc_004(correlation_id)

        self.assertEqual(summary["scenario_id"], "SCN-DOC-004")
        self.assertGreaterEqual(summary["alerts_total"], 1)
        self.assertTrue(any(alert.rule_id == "DET-DOC-006" for alert in self.store.alerts))
        self.assertIn("user-bob", summary["download_restricted_actors"])


if __name__ == "__main__":
    unittest.main()
