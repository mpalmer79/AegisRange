"""Tests for Phase 6: MITRE ATT&CK service and API endpoints."""

from __future__ import annotations

import unittest

from app.services.mitre_service import MitreAttackService
from tests.auth_helper import authenticated_client


class TestMitreAttackService(unittest.TestCase):
    def setUp(self) -> None:
        self.service = MitreAttackService()

    def test_all_10_rules_have_mappings(self) -> None:
        mappings = self.service.get_all_mappings()
        rule_ids = {m.rule_id for m in mappings}
        expected = {
            "DET-AUTH-001",
            "DET-AUTH-002",
            "DET-SESSION-003",
            "DET-DOC-004",
            "DET-DOC-005",
            "DET-DOC-006",
            "DET-SVC-007",
            "DET-ART-008",
            "DET-POL-009",
            "DET-CORR-010",
        }
        self.assertEqual(rule_ids, expected)

    def test_get_mapping_returns_ttp_for_known_rule(self) -> None:
        mapping = self.service.get_mapping("DET-AUTH-001")
        self.assertIsNotNone(mapping)
        self.assertGreater(len(mapping.technique_ids), 0)
        self.assertGreater(len(mapping.tactic_ids), 0)

    def test_get_mapping_returns_none_for_unknown(self) -> None:
        self.assertIsNone(self.service.get_mapping("DET-FAKE-999"))

    def test_coverage_matrix_has_entries(self) -> None:
        matrix = self.service.get_coverage_matrix()
        self.assertGreater(len(matrix), 0)
        covered = [e for e in matrix if e.covered]
        uncovered = [e for e in matrix if not e.covered]
        self.assertGreater(len(covered), 0)
        self.assertGreater(len(uncovered), 0, "Should show gaps in coverage")

    def test_tactic_coverage_includes_all_tactics(self) -> None:
        coverage = self.service.get_tactic_coverage()
        self.assertIn("TA0001", coverage)
        self.assertIn("TA0006", coverage)
        self.assertIn("TA0010", coverage)
        for tactic_id, data in coverage.items():
            self.assertIn("name", data)
            self.assertIn("covered_techniques", data)
            self.assertIn("total_techniques", data)
            self.assertIn("percentage", data)

    def test_scenario_ttps_returns_techniques(self) -> None:
        ttps = self.service.get_scenario_ttps("SCN-AUTH-001")
        self.assertGreater(len(ttps), 0)
        for t in ttps:
            self.assertTrue(t.id.startswith("T"))

    def test_scenario_ttps_empty_for_unknown(self) -> None:
        ttps = self.service.get_scenario_ttps("SCN-FAKE-999")
        self.assertEqual(len(ttps), 0)

    def test_enrich_alert_adds_mitre_context(self) -> None:
        alert_dict = {"rule_id": "DET-AUTH-001", "summary": "test"}
        enriched = self.service.enrich_alert(alert_dict)
        self.assertIn("mitre_tactics", enriched)
        self.assertIn("mitre_techniques", enriched)

    def test_technique_details(self) -> None:
        technique = self.service.get_technique_details("T1110")
        self.assertIsNotNone(technique)
        self.assertEqual(technique.name, "Brute Force")

    def test_kill_chain_phases_in_mappings(self) -> None:
        mappings = self.service.get_all_mappings()
        for m in mappings:
            self.assertGreater(
                len(m.kill_chain_phases),
                0,
                f"{m.rule_id} should have kill chain phases",
            )


class TestMitreAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.client = authenticated_client()
        self.client.post("/admin/reset")

    def test_get_mappings(self) -> None:
        resp = self.client.get("/mitre/mappings")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 10)

    def test_get_mapping_by_rule_id(self) -> None:
        resp = self.client.get("/mitre/mappings/DET-AUTH-001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["rule_id"], "DET-AUTH-001")
        self.assertIn("technique_ids", data)

    def test_get_mapping_not_found(self) -> None:
        resp = self.client.get("/mitre/mappings/DET-FAKE-999")
        self.assertEqual(resp.status_code, 404)

    def test_get_coverage_matrix(self) -> None:
        resp = self.client.get("/mitre/coverage")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(len(data), 0)
        self.assertIn("tactic_id", data[0])
        self.assertIn("technique_id", data[0])
        self.assertIn("covered", data[0])

    def test_get_tactic_coverage(self) -> None:
        resp = self.client.get("/mitre/tactics/coverage")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(len(data), 0)
        self.assertIn("tactic_id", data[0])
        self.assertIn("percentage", data[0])

    def test_get_scenario_ttps(self) -> None:
        resp = self.client.get("/mitre/scenarios/SCN-AUTH-001/ttps")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(len(data), 0)


if __name__ == "__main__":
    unittest.main()
