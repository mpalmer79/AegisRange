"""Tests for Phase 6: Campaign detection service and API endpoints."""

from __future__ import annotations

import unittest

from app.services.campaign_service import CampaignDetectionService
from app.store import STORE
from tests.auth_helper import authenticated_client


class TestCampaignService(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.service = CampaignDetectionService(STORE)

    def test_no_campaigns_with_zero_incidents(self) -> None:
        campaigns = self.service.detect_campaigns()
        self.assertEqual(len(campaigns), 0)

    def test_no_campaigns_with_single_incident(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")
        campaigns = self.service.detect_campaigns()
        self.assertEqual(len(campaigns), 0)

    def test_campaigns_detected_with_shared_actor(self) -> None:
        """Two scenarios with the same actor should form a campaign."""
        client = authenticated_client()
        client.post("/admin/reset")
        # SCN-AUTH-001 and SCN-DOC-003 both involve user-alice
        client.post("/scenarios/scn-auth-001")
        client.post("/scenarios/scn-doc-003")

        campaigns = self.service.detect_campaigns()
        # At least one campaign should be detected due to shared actor
        self.assertGreaterEqual(len(campaigns), 1)

        # Verify campaign has required fields
        c = campaigns[0]
        self.assertGreater(len(c.incident_correlation_ids), 1)
        self.assertGreater(len(c.campaign_name), 0)
        self.assertIn(
            c.campaign_type,
            {
                "credential_campaign",
                "exfiltration_campaign",
                "session_campaign",
                "multi_vector_campaign",
            },
        )

    def test_campaign_to_dict(self) -> None:
        client = authenticated_client()
        client.post("/admin/reset")
        client.post("/scenarios/scn-auth-001")
        client.post("/scenarios/scn-doc-003")

        campaigns = self.service.detect_campaigns()
        if campaigns:
            d = self.service.to_dict(campaigns[0])
            self.assertIn("campaign_id", d)
            self.assertIn("campaign_name", d)
            self.assertIn("shared_actors", d)
            self.assertIn("shared_ttps", d)
            self.assertIn("first_seen", d)
            self.assertIn("last_seen", d)


class TestCampaignAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.client = authenticated_client()
        self.client.post("/admin/reset")

    def test_get_campaigns_empty(self) -> None:
        resp = self.client.get("/campaigns")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_get_campaigns_after_scenarios(self) -> None:
        self.client.post("/scenarios/scn-auth-001")
        self.client.post("/scenarios/scn-doc-003")

        resp = self.client.get("/campaigns")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Should detect at least one campaign
        self.assertGreaterEqual(len(data), 1)
        if data:
            self.assertIn("campaign_id", data[0])
            self.assertIn("campaign_name", data[0])

    def test_get_campaign_not_found(self) -> None:
        resp = self.client.get("/campaigns/fake-campaign-id")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
