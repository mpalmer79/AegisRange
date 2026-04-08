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
        store.append_event(self._make_event())

        store2 = InMemoryStore()
        store2.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(store2.events), 1)

    def test_store_reset_clears_persistence(self) -> None:
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        store.append_event(self._make_event())
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


class TestPersistenceCorrectness(unittest.TestCase):
    """Tests for persistence correctness bugs found during architecture audit."""

    def setUp(self) -> None:
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def tearDown(self) -> None:
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def _make_event(self, actor_id: str = "user-alice", event_type: str = "authentication.login.failure") -> Event:
        return Event(
            event_type=event_type,
            category="authentication",
            actor_id=actor_id,
            actor_type="user",
            request_id="req-001",
            correlation_id="corr-001",
            status="failure",
            source_ip="10.0.0.1",
            origin="test",
            payload={"key": "value"},
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
        )

    def test_load_failure_does_not_destroy_sqlite_data(self) -> None:
        """A deserialization error during load must NOT delete SQLite data."""
        # Save valid data
        store1 = InMemoryStore()
        store1.events.append(self._make_event())
        store1.revoked_sessions.add("sess-001")
        pl1 = PersistenceLayer(store1, db_path=self.db_path)
        pl1.save()

        # Corrupt the events table by inserting invalid JSON
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        conn.execute("INSERT INTO events (event_id, data) VALUES ('bad-id', 'NOT-VALID-JSON{')")
        conn.commit()
        conn.close()

        # Attempt to load into a fresh store — should fail gracefully
        store2 = InMemoryStore()
        pl2 = PersistenceLayer(store2, db_path=self.db_path)
        result = pl2.load()
        # load() returns False on error
        self.assertFalse(result)

        # The critical assertion: SQLite data must still be intact
        # Load into yet another store after removing the corrupt row
        conn = sqlite3.connect(self.db_path)
        conn.execute("DELETE FROM events WHERE event_id = 'bad-id'")
        conn.commit()
        # Verify original data still exists
        count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        conn.close()
        self.assertEqual(count, 1, "Original event must survive a failed load()")

        # Verify the original data loads correctly now
        store3 = InMemoryStore()
        pl3 = PersistenceLayer(store3, db_path=self.db_path)
        self.assertTrue(pl3.load())
        self.assertEqual(len(store3.events), 1)
        self.assertEqual(store3.revoked_sessions, {"sess-001"})

    def test_failed_load_leaves_prior_memory_state_unchanged(self) -> None:
        """If load() fails, the live store must retain its prior contents."""
        # Save valid data to SQLite
        save_store = InMemoryStore()
        save_store.events.append(self._make_event("user-saved"))
        PersistenceLayer(save_store, db_path=self.db_path).save()

        # Corrupt the incidents table so deserialization fails mid-load
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO incidents (correlation_id, data) VALUES ('bad', 'CORRUPT')"
        )
        conn.commit()
        conn.close()

        # Prepare a live store that already has its own data
        live_store = InMemoryStore()
        pre_existing_event = self._make_event("user-pre-existing")
        live_store.events.append(pre_existing_event)
        live_store.revoked_sessions.add("existing-session")

        # Attempt to load — should fail
        pl = PersistenceLayer(live_store, db_path=self.db_path)
        result = pl.load()
        self.assertFalse(result)

        # The pre-existing in-memory state must be UNTOUCHED
        self.assertEqual(len(live_store.events), 1)
        self.assertEqual(live_store.events[0].actor_id, "user-pre-existing")
        self.assertEqual(live_store.revoked_sessions, {"existing-session"})
        self.assertEqual(len(live_store.alerts), 0)
        self.assertEqual(len(live_store.incidents_by_correlation), 0)

    def test_successful_load_replaces_entire_prior_state(self) -> None:
        """A successful load must fully replace whatever was in the store."""
        from app.models import Alert

        # Save a known state to SQLite
        save_store = InMemoryStore()
        save_store.events.append(self._make_event("user-from-db"))
        save_store.alerts.append(Alert(
            rule_id="DET-AUTH-001",
            rule_name="Test",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            actor_id="user-from-db",
            correlation_id="corr-db",
            contributing_event_ids=["e1"],
            summary="From DB",
            payload={},
        ))
        save_store.revoked_sessions = {"db-sess"}
        PersistenceLayer(save_store, db_path=self.db_path).save()

        # Prepare a live store with different pre-existing data
        live_store = InMemoryStore()
        live_store.events.append(self._make_event("user-old-memory"))
        live_store.events.append(self._make_event("user-old-memory-2"))
        live_store.revoked_sessions = {"old-sess-1", "old-sess-2"}

        # Load should succeed and REPLACE the old memory state
        pl = PersistenceLayer(live_store, db_path=self.db_path)
        result = pl.load()
        self.assertTrue(result)

        # Memory now matches what was in SQLite, not the old data
        self.assertEqual(len(live_store.events), 1)
        self.assertEqual(live_store.events[0].actor_id, "user-from-db")
        self.assertEqual(len(live_store.alerts), 1)
        self.assertEqual(live_store.alerts[0].rule_id, "DET-AUTH-001")
        self.assertEqual(live_store.revoked_sessions, {"db-sess"})

    def test_risk_profiles_round_trip(self) -> None:
        """Risk profiles must survive save/load cycle."""
        from app.services.risk_service import RiskProfile
        from datetime import datetime

        store1 = InMemoryStore()
        profile = RiskProfile(
            actor_id="user-alice",
            current_score=75,
            peak_score=90,
            contributing_rules=["DET-AUTH-001", "DET-DOC-005"],
            score_history=[
                {"timestamp": "2024-01-01T00:00:00", "rule_id": "DET-AUTH-001", "delta": 15, "new_score": 15},
                {"timestamp": "2024-01-01T00:01:00", "rule_id": "DET-DOC-005", "delta": 60, "new_score": 75},
            ],
            last_updated=datetime(2024, 1, 1, 0, 1, 0),
        )
        store1.risk_profiles["user-alice"] = profile

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        loaded = PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertTrue(loaded)
        self.assertIn("user-alice", store2.risk_profiles)
        restored = store2.risk_profiles["user-alice"]
        self.assertEqual(restored.actor_id, "user-alice")
        self.assertEqual(restored.current_score, 75)
        self.assertEqual(restored.peak_score, 90)
        self.assertEqual(restored.contributing_rules, ["DET-AUTH-001", "DET-DOC-005"])
        self.assertEqual(len(restored.score_history), 2)
        self.assertEqual(restored.last_updated, datetime(2024, 1, 1, 0, 1, 0))

    def test_blocked_routes_round_trip(self) -> None:
        """Blocked routes must survive save/load cycle."""
        store1 = InMemoryStore()
        store1.blocked_routes["svc-data-processor"] = {"/admin/config", "/admin/secrets"}
        store1.blocked_routes["svc-analytics"] = {"/admin/users"}

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        loaded = PersistenceLayer(store2, db_path=self.db_path).load()
        self.assertTrue(loaded)
        self.assertIn("svc-data-processor", store2.blocked_routes)
        self.assertEqual(store2.blocked_routes["svc-data-processor"], {"/admin/config", "/admin/secrets"})
        self.assertIn("svc-analytics", store2.blocked_routes)
        self.assertEqual(store2.blocked_routes["svc-analytics"], {"/admin/users"})

    def test_derived_event_indices_rebuilt_on_load(self) -> None:
        """After load, login_failures_by_actor etc. must be rebuilt from events."""
        store1 = InMemoryStore()
        # Add events of different types
        store1.events.append(self._make_event("user-alice", "authentication.login.failure"))
        store1.events.append(self._make_event("user-alice", "authentication.login.failure"))
        store1.events.append(self._make_event("user-bob", "document.read.success"))
        store1.events.append(Event(
            event_type="authorization.failure",
            category="system",
            actor_id="svc-data",
            actor_type="service",
            request_id="req-002",
            correlation_id="corr-002",
            status="failure",
            source_ip="10.0.0.2",
            origin="test",
            payload={},
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
        ))

        PersistenceLayer(store1, db_path=self.db_path).save()

        store2 = InMemoryStore()
        PersistenceLayer(store2, db_path=self.db_path).load()

        # Verify indices were rebuilt
        self.assertEqual(len(store2.login_failures_by_actor["user-alice"]), 2)
        self.assertEqual(len(store2.document_reads_by_actor["user-bob"]), 1)
        self.assertEqual(len(store2.authorization_failures_by_actor["svc-data"]), 1)

    def test_reset_is_explicit_and_intentional(self) -> None:
        """store.reset() should clear both memory and SQLite."""
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        store.append_event(self._make_event())
        store.revoked_sessions.add("sess-001")
        store.save()

        # Reset clears both
        store.reset()
        self.assertEqual(len(store.events), 0)
        self.assertEqual(len(store.revoked_sessions), 0)

        # Verify SQLite is also empty
        fresh = InMemoryStore()
        loaded = PersistenceLayer(fresh, db_path=self.db_path).load()
        self.assertFalse(loaded)
        self.assertEqual(len(fresh.events), 0)


class TestIncrementalPersistence(unittest.TestCase):
    """Tests proving the incremental persistence boundary works correctly."""

    def setUp(self) -> None:
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(self.db_fd)
        os.unlink(self.db_path)

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

    def test_append_event_persists_immediately(self) -> None:
        """append_event() should write to SQLite without needing save()."""
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        event = self._make_event()
        store.append_event(event)

        # Load into a fresh store without calling save()
        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.events), 1)
        self.assertEqual(fresh.events[0].event_id, event.event_id)

    def test_extend_alerts_persists_immediately(self) -> None:
        """extend_alerts() should write to SQLite without needing save()."""
        from app.models import Alert

        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        alerts = [
            Alert(
                rule_id="DET-AUTH-001",
                rule_name="Test",
                severity=Severity.HIGH,
                confidence=Confidence.HIGH,
                actor_id="user-alice",
                correlation_id="corr-001",
                contributing_event_ids=["e1"],
                summary="Test alert",
                payload={},
            ),
            Alert(
                rule_id="DET-DOC-005",
                rule_name="Bulk",
                severity=Severity.MEDIUM,
                confidence=Confidence.MEDIUM,
                actor_id="user-bob",
                correlation_id="corr-002",
                contributing_event_ids=["e2"],
                summary="Bulk alert",
                payload={},
            ),
        ]
        store.extend_alerts(alerts)

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.alerts), 2)
        self.assertEqual(fresh.alerts[0].rule_id, "DET-AUTH-001")

    def test_extend_responses_persists_immediately(self) -> None:
        """extend_responses() should write to SQLite without needing save()."""
        from app.models import ResponseAction

        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        responses = [
            ResponseAction(
                playbook_id="PB-AUTH-001",
                action_type="rate_limit",
                actor_id="user-alice",
                correlation_id="corr-001",
                reason="test",
                related_alert_id="alert-1",
                payload={},
            ),
        ]
        store.extend_responses(responses)

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.responses), 1)
        self.assertEqual(fresh.responses[0].playbook_id, "PB-AUTH-001")

    def test_upsert_incident_persists_immediately(self) -> None:
        """upsert_incident() should write to SQLite without needing save()."""
        from app.models import Incident

        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        incident = Incident(
            incident_type="credential_abuse",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="corr-001",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
        )
        store.upsert_incident(incident)

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertIn("corr-001", fresh.incidents_by_correlation)
        self.assertEqual(fresh.incidents_by_correlation["corr-001"].incident_id, incident.incident_id)

    def test_upsert_incident_updates_existing(self) -> None:
        """Repeated upsert_incident() should update, not duplicate."""
        from app.models import Incident

        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        incident = Incident(
            incident_type="credential_abuse",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="corr-001",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
        )
        store.upsert_incident(incident)

        # Mutate and upsert again
        incident.status = "investigating"
        incident.detection_ids.append("DET-AUTH-001")
        store.upsert_incident(incident)

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.incidents_by_correlation), 1)
        loaded = fresh.incidents_by_correlation["corr-001"]
        self.assertEqual(loaded.status, "investigating")
        self.assertEqual(loaded.detection_ids, ["DET-AUTH-001"])

    def test_append_incident_note_persists_immediately(self) -> None:
        """append_incident_note() should write to SQLite without needing save()."""
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        note = {"note_id": "note-001", "author": "admin", "content": "test", "created_at": "2024-01-01"}
        store.append_incident_note("corr-001", note)

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.incident_notes["corr-001"]), 1)
        self.assertEqual(fresh.incident_notes["corr-001"][0]["author"], "admin")

    def test_append_scenario_history_persists_immediately(self) -> None:
        """append_scenario_history() should write to SQLite without needing save()."""
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        entry = {"scenario_id": "SCN-AUTH-001", "correlation_id": "corr-001", "executed_at": "2024-01-01"}
        store.append_scenario_history(entry)

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.scenario_history), 1)
        self.assertEqual(fresh.scenario_history[0]["scenario_id"], "SCN-AUTH-001")

    def test_save_persists_operational_state(self) -> None:
        """store.save() should persist operational state (sets/dicts)."""
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        store.revoked_sessions.add("sess-001")
        store.step_up_required.add("user-alice")
        store.alert_signatures.add(("DET-AUTH-001", "user-alice", "corr-001"))
        store.save()

        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(fresh.revoked_sessions, {"sess-001"})
        self.assertEqual(fresh.step_up_required, {"user-alice"})
        self.assertIn(("DET-AUTH-001", "user-alice", "corr-001"), fresh.alert_signatures)

    def test_append_event_is_idempotent(self) -> None:
        """Appending the same event twice should only persist one copy (INSERT OR IGNORE)."""
        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)
        event = self._make_event()
        store.append_event(event)

        # Manually call persist again with same event
        store._persistence.persist_event(event)

        import sqlite3
        conn = sqlite3.connect(self.db_path)
        count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        conn.close()
        self.assertEqual(count, 1)

    def test_no_persistence_write_methods_still_work(self) -> None:
        """Write methods should work even without persistence enabled."""
        store = InMemoryStore()
        event = self._make_event()
        store.append_event(event)
        self.assertEqual(len(store.events), 1)

        from app.models import Alert
        store.extend_alerts([Alert(
            rule_id="DET-AUTH-001", rule_name="Test", severity=Severity.HIGH,
            confidence=Confidence.HIGH, actor_id="a", correlation_id="c",
            contributing_event_ids=[], summary="s", payload={},
        )])
        self.assertEqual(len(store.alerts), 1)

        store.append_scenario_history({"test": True})
        self.assertEqual(len(store.scenario_history), 1)

    def test_mixed_incremental_and_operational_roundtrip(self) -> None:
        """Full roundtrip: entities via write methods + operational via save()."""
        from app.models import Incident

        store = InMemoryStore()
        store.enable_persistence(db_path=self.db_path)

        # Entity writes (incremental)
        store.append_event(self._make_event())
        incident = Incident(
            incident_type="credential_abuse",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="corr-001",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
        )
        store.upsert_incident(incident)
        store.append_incident_note("corr-001", {
            "note_id": "note-001", "author": "admin", "content": "test", "created_at": "2024-01-01",
        })

        # Operational writes (saved via save())
        store.revoked_sessions.add("sess-001")
        store.step_up_required.add("user-alice")
        store.save()

        # Verify full roundtrip
        fresh = InMemoryStore()
        fresh.enable_persistence(db_path=self.db_path)
        self.assertEqual(len(fresh.events), 1)
        self.assertIn("corr-001", fresh.incidents_by_correlation)
        self.assertEqual(len(fresh.incident_notes["corr-001"]), 1)
        self.assertEqual(fresh.revoked_sessions, {"sess-001"})
        self.assertEqual(fresh.step_up_required, {"user-alice"})


if __name__ == "__main__":
    unittest.main()
