"""Tests for pagination on events and alerts endpoints."""

from __future__ import annotations

import unittest

from app.store import STORE
from tests.auth_helper import authenticated_client


class TestEventsPagination(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client("red_team")
        # Run a scenario to generate events
        self.client.post("/scenarios/scn-auth-001")
        self.viewer = authenticated_client("viewer")

    def test_default_pagination_envelope(self) -> None:
        resp = self.viewer.get("/events")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertIn("page", data)
        self.assertIn("page_size", data)
        self.assertIn("pages", data)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["page_size"], 50)

    def test_custom_page_size(self) -> None:
        resp = self.viewer.get("/events", params={"page_size": 2})
        data = resp.json()
        self.assertLessEqual(len(data["items"]), 2)
        self.assertGreater(data["total"], 2)
        self.assertGreater(data["pages"], 1)

    def test_page_2(self) -> None:
        resp1 = self.viewer.get("/events", params={"page_size": 2, "page": 1})
        resp2 = self.viewer.get("/events", params={"page_size": 2, "page": 2})
        items1 = resp1.json()["items"]
        items2 = resp2.json()["items"]
        self.assertGreater(len(items1), 0)
        self.assertGreater(len(items2), 0)
        ids1 = {e["event_id"] for e in items1}
        ids2 = {e["event_id"] for e in items2}
        self.assertTrue(ids1.isdisjoint(ids2), "Pages should not overlap")

    def test_empty_page_beyond_total(self) -> None:
        resp = self.viewer.get("/events", params={"page": 9999})
        data = resp.json()
        self.assertEqual(data["items"], [])
        self.assertEqual(data["page"], 9999)

    def test_invalid_page_size_rejected(self) -> None:
        resp = self.viewer.get("/events", params={"page_size": 0})
        self.assertEqual(resp.status_code, 422)

    def test_page_size_capped_at_200(self) -> None:
        resp = self.viewer.get("/events", params={"page_size": 999})
        self.assertEqual(resp.status_code, 422)


class TestAlertsPagination(unittest.TestCase):
    def setUp(self) -> None:
        STORE.reset()
        self.client = authenticated_client("red_team")
        self.client.post("/scenarios/scn-auth-001")
        self.viewer = authenticated_client("viewer")

    def test_default_pagination_envelope(self) -> None:
        resp = self.viewer.get("/alerts")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertIn("page", data)
        self.assertIn("page_size", data)
        self.assertIn("pages", data)

    def test_custom_page_size(self) -> None:
        resp = self.viewer.get("/alerts", params={"page_size": 1})
        data = resp.json()
        self.assertLessEqual(len(data["items"]), 1)

    def test_filters_with_pagination(self) -> None:
        resp = self.viewer.get(
            "/alerts", params={"rule_id": "DET-AUTH-002", "page_size": 1}
        )
        data = resp.json()
        for alert in data["items"]:
            self.assertEqual(alert["rule_id"], "DET-AUTH-002")


if __name__ == "__main__":
    unittest.main()
