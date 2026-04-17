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


# ---------------------------------------------------------------------------
# SCN-SVC-005 and SCN-CORR-006 scenarios
# ---------------------------------------------------------------------------


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


class TestSCNGEO007(ScenarioTestBase):
    """SCN-GEO-007: Impossible-Travel Authentication → DET-GEO-011."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_geo_007(corr)
        self.assertEqual(summary["scenario_id"], "SCN-GEO-007")
        self.assertEqual(summary["correlation_id"], corr)
        self.assertGreater(summary["events_total"], 0)
        self.assertGreaterEqual(summary["alerts_total"], 1)

    def test_fires_impossible_travel_rule(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_geo_007(corr)
        rule_ids = {
            a.rule_id for a in self.store.alerts if a.correlation_id == corr
        }
        self.assertIn("DET-GEO-011", rule_ids)

    def test_alert_carries_regions_observed(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_geo_007(corr)
        geo_alerts = [
            a
            for a in self.store.alerts
            if a.correlation_id == corr and a.rule_id == "DET-GEO-011"
        ]
        self.assertEqual(len(geo_alerts), 1)
        regions = set(geo_alerts[0].payload["regions_observed"])
        self.assertIn("us-east-1", regions)
        self.assertIn("ap-south-1", regions)


class TestSCNEXFIL008(ScenarioTestBase):
    """SCN-EXFIL-008: Large-Volume Data Exfiltration → DET-EXFIL-012."""

    def test_end_to_end(self) -> None:
        corr = f"corr-{uuid4()}"
        summary = self.engine.run_exfil_008(corr)
        self.assertEqual(summary["scenario_id"], "SCN-EXFIL-008")
        self.assertEqual(summary["correlation_id"], corr)
        # 12 downloads → at least 12 events + the exfil alert.
        self.assertGreaterEqual(summary["events_total"], 12)
        self.assertGreaterEqual(summary["alerts_total"], 1)

    def test_fires_exfiltration_rule(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_exfil_008(corr)
        rule_ids = {
            a.rule_id for a in self.store.alerts if a.correlation_id == corr
        }
        self.assertIn("DET-EXFIL-012", rule_ids)

    def test_alert_reports_cumulative_volume(self) -> None:
        corr = f"corr-{uuid4()}"
        self.engine.run_exfil_008(corr)
        exfil_alerts = [
            a
            for a in self.store.alerts
            if a.correlation_id == corr and a.rule_id == "DET-EXFIL-012"
        ]
        self.assertEqual(len(exfil_alerts), 1)
        total_bytes = exfil_alerts[0].payload["total_bytes"]
        self.assertGreaterEqual(total_bytes, 500 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
