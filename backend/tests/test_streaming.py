"""Tests for SSE streaming service and API endpoint."""

from __future__ import annotations

import unittest

from app.main import app
from app.services.stream_service import StreamService
from app.store import STORE
from tests.auth_helper import authenticated_client


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
