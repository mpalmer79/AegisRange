"""Phase 2-3: Integration tests for SCN-SVC-005 and SCN-CORR-006 scenarios."""

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


class TestSCNSVC005(ScenarioTestBase):
    """SCN-SVC-005: Unauthorized Service Access."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_svc_005(corr)

        self.assertEqual(summary["scenario_id"], "SCN-SVC-005")
        self.assertEqual(summary["correlation_id"], corr)
        self.assertGreater(summary["events_total"], 0)
        self.assertGreaterEqual(summary["alerts_total"], 1)
        self.assertGreaterEqual(summary["responses_total"], 1)

    def test_service_disabled(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_svc_005(corr)
        self.assertIn("svc-data-processor", summary["disabled_services"])

    def test_detection_rule(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_svc_005(corr)
        rule_ids = {a.rule_id for a in self.store.alerts if a.correlation_id == corr}
        self.assertIn("DET-SVC-007", rule_ids)

    def test_incident_created(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_svc_005(corr)
        incident = self.store.incidents_by_correlation.get(corr)
        self.assertIsNotNone(incident)

    def test_incident_has_service_type(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_svc_005(corr)
        incident = self.store.incidents_by_correlation.get(corr)
        self.assertIsNotNone(incident)
        self.assertEqual(incident.incident_type, "service_misuse")

    def test_response_playbook(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_svc_005(corr)
        playbook_ids = {
            r.playbook_id for r in self.store.responses if r.correlation_id == corr
        }
        self.assertIn("PB-SVC-007", playbook_ids)


class TestSCNCORR006(ScenarioTestBase):
    """SCN-CORR-006: Multi-Signal Compromise Sequence."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_corr_006(corr)

        self.assertEqual(summary["scenario_id"], "SCN-CORR-006")
        self.assertEqual(summary["correlation_id"], corr)
        self.assertGreater(summary["events_total"], 0)
        # Should have multiple alerts from different rules
        self.assertGreaterEqual(summary["alerts_total"], 3)

    def test_multiple_detection_rules_triggered(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_corr_006(corr)
        rule_ids = {a.rule_id for a in self.store.alerts if a.correlation_id == corr}
        # Must trigger at least auth and doc rules
        self.assertIn("DET-AUTH-001", rule_ids)
        self.assertIn("DET-AUTH-002", rule_ids)
        self.assertIn("DET-DOC-005", rule_ids)

    def test_incident_created(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_corr_006(corr)
        incident = self.store.incidents_by_correlation.get(corr)
        self.assertIsNotNone(incident)

    def test_incident_has_timeline(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_corr_006(corr)
        incident = self.store.incidents_by_correlation.get(corr)
        self.assertIsNotNone(incident)
        self.assertGreater(len(incident.timeline), 0)
        entry_types = {e.entry_type for e in incident.timeline}
        self.assertIn("detection", entry_types)
        self.assertIn("response", entry_types)

    def test_step_up_required(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_corr_006(corr)
        self.assertTrue(summary["step_up_required"])

    def test_severity_escalation(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_corr_006(corr)
        incident = self.store.incidents_by_correlation.get(corr)
        self.assertIsNotNone(incident)
        # DET-DOC-006 is CRITICAL, so incident should escalate
        self.assertEqual(incident.severity.value, "critical")

    def test_multiple_response_playbooks(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_corr_006(corr)
        playbook_ids = {
            r.playbook_id for r in self.store.responses if r.correlation_id == corr
        }
        # Should have auth and doc response playbooks
        self.assertIn("PB-AUTH-001", playbook_ids)
        self.assertIn("PB-AUTH-002", playbook_ids)
        self.assertIn("PB-DOC-005", playbook_ids)


if __name__ == "__main__":
    unittest.main()
