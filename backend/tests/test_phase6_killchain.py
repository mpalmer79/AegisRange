"""Tests for Phase 6: Kill chain service and API endpoints."""
from __future__ import annotations

import unittest

from app.services.killchain_service import KillChainService, RULE_TO_STAGE, KILL_CHAIN_STAGES
from app.store import STORE
from tests.auth_helper import authenticated_client


class TestKillChainService(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.service = KillChainService(STORE)

    def test_all_rules_have_stage_mapping(self) -> None:
        expected_rules = {
            "DET-AUTH-001", "DET-AUTH-002", "DET-SESSION-003",
            "DET-DOC-004", "DET-DOC-005", "DET-DOC-006",
            "DET-SVC-007", "DET-ART-008", "DET-POL-009", "DET-CORR-010",
        }
        self.assertEqual(set(RULE_TO_STAGE.keys()), expected_rules)

    def test_stage_mapping_returns_valid_stages(self) -> None:
        for rule_id, stage in RULE_TO_STAGE.items():
            self.assertIn(stage, KILL_CHAIN_STAGES,
                f"{rule_id} maps to invalid stage: {stage}")

    def test_analyze_incident_after_scenario(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        resp = client.post("/scenarios/scn-auth-001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        correlation_id = data["correlation_id"]

        analysis = self.service.analyze_incident(correlation_id)
        self.assertIsNotNone(analysis)
        self.assertEqual(analysis.correlation_id, correlation_id)
        self.assertGreater(analysis.progression_percentage, 0)
        self.assertEqual(len(analysis.stages), 7)

        detected_stages = [s for s in analysis.stages if s.detected]
        self.assertGreater(len(detected_stages), 0)

    def test_analyze_nonexistent_incident(self) -> None:
        self.assertIsNone(self.service.analyze_incident("fake-corr-id"))

    def test_analyze_all_incidents(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")
        client.post("/scenarios/scn-doc-003")

        analyses = self.service.analyze_all_incidents()
        self.assertGreaterEqual(len(analyses), 2)

    def test_kill_chain_stages_order(self) -> None:
        self.assertEqual(KILL_CHAIN_STAGES[0], "reconnaissance")
        self.assertEqual(KILL_CHAIN_STAGES[-1], "actions_on_objectives")
        self.assertEqual(len(KILL_CHAIN_STAGES), 7)

    def test_to_dict_serialization(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")

        analyses = self.service.analyze_all_incidents()
        self.assertGreater(len(analyses), 0)
        d = self.service.to_dict(analyses[0])
        self.assertIn("correlation_id", d)
        self.assertIn("stages", d)
        self.assertIn("progression_percentage", d)
        self.assertIn("highest_stage", d)


class TestKillChainAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.client = authenticated_client()
        self.client.post("/admin/reset")

    def test_get_all_killchain_empty(self) -> None:
        resp = self.client.get("/killchain")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_get_all_killchain_after_scenarios(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        resp = self.client.get("/killchain")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(len(data), 0)
        self.assertIn("stages", data[0])
        self.assertIn("progression_percentage", data[0])

    def test_get_killchain_by_correlation_id(self) -> None:
        resp = self.client.post("/scenarios/scn-auth-001")
        correlation_id = resp.json()["correlation_id"]

        resp = self.client.get(f"/killchain/{correlation_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["correlation_id"], correlation_id)

    def test_get_killchain_not_found(self) -> None:
        resp = self.client.get("/killchain/fake-corr-id")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
