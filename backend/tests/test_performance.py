"""Performance tests — secondary indices and lookup benchmarks."""

from __future__ import annotations

import time
import unittest
from uuid import uuid4

from app.models import Confidence, Event, Severity
from app.services.event_services import TelemetryService
from app.store import InMemoryStore


def _make_event(**overrides: object) -> Event:
    defaults = dict(
        event_type="authentication.login.failure",
        category="authentication",
        actor_id="user-alice",
        actor_type="user",
        actor_role="analyst",
        target_type="identity",
        target_id="alice",
        request_id=f"req-{uuid4()}",
        correlation_id=f"corr-{uuid4()}",
        session_id=None,
        source_ip="203.0.113.10",
        user_agent="test",
        origin="internal",
        status="failure",
        status_code="401",
        error_message=None,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={"test": True},
    )
    defaults.update(overrides)
    return Event(**defaults)


class TestEventIndexPerformance(unittest.TestCase):
    """Verify secondary indices make lookups sublinear."""

    def test_indexed_lookup_under_50ms_with_5000_events(self) -> None:
        """Lookup by actor_id + event_type on 5000 events < 50ms."""
        store = InMemoryStore()
        telemetry = TelemetryService(store)

        # Ingest 5000 events from 10 different actors
        for i in range(5000):
            actor = f"user-{i % 10}"
            evt = _make_event(
                actor_id=actor,
                event_type=f"auth.login.{'failure' if i % 2 == 0 else 'success'}",
                correlation_id=f"corr-{i % 100}",
            )
            store.append_event(evt)

        # Warm up
        telemetry.lookup_events(actor_id="user-0", event_types={"auth.login.failure"})

        # Timed lookup
        start = time.monotonic()
        for _ in range(100):
            results = telemetry.lookup_events(
                actor_id="user-0", event_types={"auth.login.failure"}
            )
        elapsed_ms = (time.monotonic() - start) * 1000

        # 100 lookups in under 5000ms (50ms each) — generous ceiling
        self.assertLess(elapsed_ms, 5000, f"100 lookups took {elapsed_ms:.1f}ms")
        self.assertGreater(len(results), 0, "Should find matching events")

    def test_indices_populated_on_append(self) -> None:
        """Secondary indices are populated by append_event."""
        store = InMemoryStore()
        event = _make_event(actor_id="user-bob", correlation_id="corr-123")
        store.append_event(event)

        self.assertEqual(len(store.get_events_by_actor("user-bob")), 1)
        self.assertEqual(len(store.get_events_by_correlation("corr-123")), 1)
        self.assertEqual(
            len(store.get_events_by_type("authentication.login.failure")), 1
        )

    def test_indices_empty_for_unknown_keys(self) -> None:
        """Querying non-existent keys returns empty lists."""
        store = InMemoryStore()
        self.assertEqual(store.get_events_by_actor("nobody"), [])
        self.assertEqual(store.get_events_by_correlation("no-corr"), [])
        self.assertEqual(store.get_events_by_type("no.type"), [])

    def test_indices_cleared_on_reset(self) -> None:
        """Store reset clears secondary indices."""
        store = InMemoryStore()
        store.append_event(_make_event(actor_id="user-x"))
        self.assertEqual(len(store.get_events_by_actor("user-x")), 1)
        store.reset()
        self.assertEqual(store.get_events_by_actor("user-x"), [])


if __name__ == "__main__":
    unittest.main()
