"""Tests for SQLite persistence layer."""
from __future__ import annotations

import os
import tempfile
import unittest

from app.models import Confidence, Event, Severity
from app.persistence import PersistenceLayer
from app.store import InMemoryStore


class TestPersistenceRoundTrip(unittest.TestCase):
    def setUp(self) -> None:
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(self.db_fd)
        os.unlink(self.db_path)  # PersistenceLayer will create it

    def tearDown(self) -> None:
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def _make_event(self, actor_id: str = "user-alice", event_type: str = "test.event") -> Event:
        return Event(
            event_type=event_type,
            category="test",
            actor_id=actor_id,
            actor_type="user",
            request_id="req-001",
            correlation_id="corr-001",
            status="success",
            source_ip="10.0.0.1",
            origin="test",
            payload={"key": "value"},
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
        )

    def test_save_and_load_events(self) -> None:
        store1 = InMemoryStore()
        event = self._make_event()
        store1.events.append(event)
        store1.events.append(self._make_event("user-bob", "auth.login"))

        persistence1 = PersistenceLayer(store1, db_path=self.db_path)
        persistence1.save()

        store2 = InMemoryStore()
        persistence2 = PersistenceLayer(store2, db_path=self.db_path)
        loaded = persistence2.load()
        self.assertTrue(loaded)
        self.assertEqual(len(store2.events), 2)
        self.assertEqual(store2.events[0].event_id, event.event_id)
        self.assertEqual(store2.events[0].actor_id, "user-alice")
        self.assertEqual(store2.events[0].payload, {"key": "value"})
        self.assertEqual(store2.events[1].actor_id, "user-bob")

    def test_save_and_load_alerts(self) -> None:
        from app.models import Alert

        store1 = InMemoryStore()
        alert = Alert(
            rule_id="DET-AUTH-001",
            rule_name="Test Rule",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id="user-alice",
            correlation_id="corr-001",
            contributing_event_ids=["evt-1", "evt-2"],
            summary="Test alert",
            payload={"detail": "info"},
        )
        store1.alerts.append(alert)

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertEqual(len(store2.alerts), 1)
        self.assertEqual(store2.alerts[0].alert_id, alert.alert_id)
        self.assertEqual(store2.alerts[0].rule_id, "DET-AUTH-001")
        self.assertEqual(store2.alerts[0].severity, Severity.HIGH)
        self.assertEqual(store2.alerts[0].contributing_event_ids, ["evt-1", "evt-2"])

    def test_save_and_load_incidents(self) -> None:
        from app.models import Incident

        store1 = InMemoryStore()
        incident = Incident(
            incident_type="authentication_abuse",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="corr-001",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
        )
        incident.detection_ids.append("alert-1")
        incident.detection_summary.append("Failed login burst")
        incident.add_timeline_entry("detection", "alert-1", "Alert triggered")
        store1.incidents_by_correlation["corr-001"] = incident

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertEqual(len(store2.incidents_by_correlation), 1)
        loaded = store2.incidents_by_correlation["corr-001"]
        self.assertEqual(loaded.incident_id, incident.incident_id)
        self.assertEqual(loaded.primary_actor_id, "user-alice")
        self.assertEqual(loaded.severity, Severity.HIGH)
        self.assertEqual(len(loaded.timeline), 1)
        self.assertEqual(loaded.timeline[0].entry_type, "detection")

    def test_save_and_load_sets(self) -> None:
        store1 = InMemoryStore()
        store1.revoked_sessions.add("sess-001")
        store1.revoked_sessions.add("sess-002")
        store1.disabled_services.add("svc-data")
        store1.step_up_required.add("user-alice")

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertEqual(store2.revoked_sessions, {"sess-001", "sess-002"})
        self.assertEqual(store2.disabled_services, {"svc-data"})
        self.assertEqual(store2.step_up_required, {"user-alice"})

    def test_save_and_load_scenario_history(self) -> None:
        store1 = InMemoryStore()
        store1.scenario_history.append({
            "scenario_id": "SCN-AUTH-001",
            "correlation_id": "corr-001",
            "events_total": 10,
        })

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertEqual(len(store2.scenario_history), 1)
        self.assertEqual(store2.scenario_history[0]["scenario_id"], "SCN-AUTH-001")

    def test_save_and_load_incident_notes(self) -> None:
        store1 = InMemoryStore()
        store1.incident_notes["corr-001"].append({
            "note_id": "note-001",
            "author": "analyst1",
            "content": "Investigating",
            "created_at": "2024-01-01T00:00:00",
        })

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertEqual(len(store2.incident_notes["corr-001"]), 1)
        self.assertEqual(store2.incident_notes["corr-001"][0]["author"], "analyst1")

    def test_clear_removes_all_data(self) -> None:
        store1 = InMemoryStore()
        store1.events.append(self._make_event())
        pl = PersistenceLayer(store1, db_path=self.db_path)
        pl.save()
        pl.clear()

        store2 = InMemoryStore()
        loaded = PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertFalse(loaded)
        self.assertEqual(len(store2.events), 0)

    def test_load_empty_db_returns_false(self) -> None:
        store = InMemoryStore()
        persistence = PersistenceLayer(store, db_path=self.db_path)
        loaded = persistence.load()
        self.assertFalse(loaded)

    def test_store_enable_persistence(self) -> None:
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        store.events.append(self._make_event())
        store.save()

        store2 = InMemoryStore()
        store2.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(store2.events), 1)

    def test_store_reset_clears_persistence(self) -> None:
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        store.events.append(self._make_event())
        store.save()
        store.reset()

        store2 = InMemoryStore()
        store2.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(store2.events), 0)

    def test_full_scenario_roundtrip(self) -> None:
        """Run a scenario through the pipeline, persist, restore, and verify."""
        from tests.auth_helper import authenticated_client

        # Use a separate test db
        client = authenticated_client()
        client.post("/admin/reset")
        resp = client.post("/scenarios/scn-auth-001")
        data = resp.json()
        events_count = data["events_total"]
        alerts_count = data["alerts_total"]
        corr_id = data["correlation_id"]

        # Manually save (middleware won't fire for test env)
        store = InMemoryStore()
        store.events = list(client.app.state._state.get("store", {}).get("events", []))  # noqa

        # Verify the store has data
        from app.store import STORE
        self.assertGreater(len(STORE.events), 0)
        self.assertGreater(len(STORE.alerts), 0)

        # Save to temp db
        pl = PersistenceLayer(STORE, db_path=self.db_path)
        pl.save()

        # Create a fresh store and load
        fresh = InMemoryStore()
        pl2 = PersistenceLayer(fresh, db_path=self.db_path)
        loaded = pl2.load()
        self.assertTrue(loaded)

        # Verify counts match
        self.assertEqual(len(fresh.events), len(STORE.events))
        self.assertEqual(len(fresh.alerts), len(STORE.alerts))
        self.assertEqual(len(fresh.responses), len(STORE.responses))
        self.assertIn(corr_id, fresh.incidents_by_correlation)


if __name__ == "__main__":
    unittest.main()
