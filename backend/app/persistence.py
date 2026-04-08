"""SQLite persistence layer for AegisRange store.

Provides snapshot-based persistence: the in-memory store is the primary
data source during runtime; SQLite serves as durable storage for state
that survives process restarts.

Usage:
    from app.persistence import PersistenceLayer
    persistence = PersistenceLayer(store, db_path="aegisrange.db")
    persistence.load()   # restore from last saved state
    persistence.save()   # persist current state to SQLite
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from app.models import (
    Alert,
    Confidence,
    Event,
    Incident,
    ResponseAction,
    Severity,
    TimelineEntry,
)

DEFAULT_DB_PATH = Path("aegisrange.db")


class PersistenceLayer:
    """Snapshot-based persistence: serializes/deserializes InMemoryStore to SQLite."""

    def __init__(self, store: Any, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        self.store = store
        self.db_path = Path(db_path)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def _init_db(self) -> None:
        conn = self._connect()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS alerts (
                    alert_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS responses (
                    response_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS incidents (
                    correlation_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS state_sets (
                    key TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS state_dicts (
                    key TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS scenario_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS incident_notes (
                    note_id TEXT PRIMARY KEY,
                    correlation_id TEXT NOT NULL,
                    data TEXT NOT NULL
                );
            """)
            conn.commit()
        finally:
            conn.close()

    # --- Serialization helpers ---

    @staticmethod
    def _serialize_event(event: Event) -> str:
        return json.dumps({
            "event_id": event.event_id,
            "event_type": event.event_type,
            "category": event.category,
            "actor_id": event.actor_id,
            "actor_type": event.actor_type,
            "actor_role": event.actor_role,
            "target_type": event.target_type,
            "target_id": event.target_id,
            "request_id": event.request_id,
            "correlation_id": event.correlation_id,
            "session_id": event.session_id,
            "source_ip": event.source_ip,
            "user_agent": event.user_agent,
            "origin": event.origin,
            "status": event.status,
            "status_code": event.status_code,
            "error_message": event.error_message,
            "severity": event.severity.value,
            "confidence": event.confidence.value,
            "risk_score": event.risk_score,
            "payload": event.payload,
            "timestamp": event.timestamp.isoformat(),
            "ingestion_timestamp": event.ingestion_timestamp.isoformat(),
        })

    @staticmethod
    def _deserialize_event(data: str) -> Event:
        d = json.loads(data)
        return Event(
            event_id=d["event_id"],
            event_type=d["event_type"],
            category=d["category"],
            actor_id=d["actor_id"],
            actor_type=d["actor_type"],
            actor_role=d.get("actor_role"),
            target_type=d.get("target_type"),
            target_id=d.get("target_id"),
            request_id=d["request_id"],
            correlation_id=d["correlation_id"],
            session_id=d.get("session_id"),
            source_ip=d["source_ip"],
            user_agent=d.get("user_agent"),
            origin=d["origin"],
            status=d["status"],
            status_code=d.get("status_code"),
            error_message=d.get("error_message"),
            severity=Severity(d["severity"]),
            confidence=Confidence(d["confidence"]),
            risk_score=d.get("risk_score"),
            payload=d["payload"],
            timestamp=datetime.fromisoformat(d["timestamp"]),
            ingestion_timestamp=datetime.fromisoformat(d["ingestion_timestamp"]),
        )

    @staticmethod
    def _serialize_alert(alert: Alert) -> str:
        return json.dumps({
            "alert_id": alert.alert_id,
            "rule_id": alert.rule_id,
            "rule_name": alert.rule_name,
            "severity": alert.severity.value,
            "confidence": alert.confidence.value,
            "actor_id": alert.actor_id,
            "correlation_id": alert.correlation_id,
            "contributing_event_ids": alert.contributing_event_ids,
            "summary": alert.summary,
            "payload": alert.payload,
            "created_at": alert.created_at.isoformat(),
        })

    @staticmethod
    def _deserialize_alert(data: str) -> Alert:
        d = json.loads(data)
        return Alert(
            alert_id=d["alert_id"],
            rule_id=d["rule_id"],
            rule_name=d["rule_name"],
            severity=Severity(d["severity"]),
            confidence=Confidence(d["confidence"]),
            actor_id=d["actor_id"],
            correlation_id=d["correlation_id"],
            contributing_event_ids=d["contributing_event_ids"],
            summary=d["summary"],
            payload=d["payload"],
            created_at=datetime.fromisoformat(d["created_at"]),
        )

    @staticmethod
    def _serialize_response(resp: ResponseAction) -> str:
        return json.dumps({
            "response_id": resp.response_id,
            "playbook_id": resp.playbook_id,
            "action_type": resp.action_type,
            "actor_id": resp.actor_id,
            "correlation_id": resp.correlation_id,
            "reason": resp.reason,
            "related_alert_id": resp.related_alert_id,
            "payload": resp.payload,
            "created_at": resp.created_at.isoformat(),
        })

    @staticmethod
    def _deserialize_response(data: str) -> ResponseAction:
        d = json.loads(data)
        return ResponseAction(
            response_id=d["response_id"],
            playbook_id=d["playbook_id"],
            action_type=d["action_type"],
            actor_id=d["actor_id"],
            correlation_id=d["correlation_id"],
            reason=d["reason"],
            related_alert_id=d["related_alert_id"],
            payload=d["payload"],
            created_at=datetime.fromisoformat(d["created_at"]),
        )

    @staticmethod
    def _serialize_incident(incident: Incident) -> str:
        return json.dumps({
            "incident_id": incident.incident_id,
            "incident_type": incident.incident_type,
            "primary_actor_id": incident.primary_actor_id,
            "actor_type": incident.actor_type,
            "actor_role": incident.actor_role,
            "correlation_id": incident.correlation_id,
            "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
            "confidence": incident.confidence.value if hasattr(incident.confidence, "value") else incident.confidence,
            "status": incident.status,
            "risk_score": incident.risk_score,
            "detection_ids": incident.detection_ids,
            "detection_summary": incident.detection_summary,
            "response_ids": incident.response_ids,
            "containment_status": incident.containment_status,
            "event_ids": incident.event_ids,
            "affected_documents": incident.affected_documents,
            "affected_sessions": incident.affected_sessions,
            "affected_services": incident.affected_services,
            "timeline": [
                {
                    "timestamp": e.timestamp.isoformat(),
                    "entry_type": e.entry_type,
                    "reference_id": e.reference_id,
                    "summary": e.summary,
                }
                for e in incident.timeline
            ],
            "created_at": incident.created_at.isoformat(),
            "updated_at": incident.updated_at.isoformat(),
            "closed_at": incident.closed_at.isoformat() if incident.closed_at else None,
        })

    @staticmethod
    def _deserialize_incident(data: str) -> Incident:
        d = json.loads(data)
        incident = Incident(
            incident_id=d["incident_id"],
            incident_type=d["incident_type"],
            primary_actor_id=d["primary_actor_id"],
            actor_type=d["actor_type"],
            actor_role=d.get("actor_role"),
            correlation_id=d["correlation_id"],
            severity=Severity(d["severity"]),
            confidence=Confidence(d["confidence"]),
            status=d["status"],
            risk_score=d.get("risk_score"),
            detection_ids=d.get("detection_ids", []),
            detection_summary=d.get("detection_summary", []),
            response_ids=d.get("response_ids", []),
            containment_status=d.get("containment_status", "none"),
            event_ids=d.get("event_ids", []),
            affected_documents=d.get("affected_documents", []),
            affected_sessions=d.get("affected_sessions", []),
            affected_services=d.get("affected_services", []),
            created_at=datetime.fromisoformat(d["created_at"]),
            updated_at=datetime.fromisoformat(d["updated_at"]),
            closed_at=datetime.fromisoformat(d["closed_at"]) if d.get("closed_at") else None,
        )
        for te in d.get("timeline", []):
            incident.timeline.append(
                TimelineEntry(
                    timestamp=datetime.fromisoformat(te["timestamp"]),
                    entry_type=te["entry_type"],
                    reference_id=te["reference_id"],
                    summary=te["summary"],
                )
            )
        return incident

    # --- Save ---

    def save(self) -> None:
        """Persist the entire store state to SQLite."""
        conn = self._connect()
        try:
            conn.execute("DELETE FROM events")
            conn.execute("DELETE FROM alerts")
            conn.execute("DELETE FROM responses")
            conn.execute("DELETE FROM incidents")
            conn.execute("DELETE FROM state_sets")
            conn.execute("DELETE FROM state_dicts")
            conn.execute("DELETE FROM scenario_history")
            conn.execute("DELETE FROM incident_notes")

            # Events
            conn.executemany(
                "INSERT INTO events (event_id, data) VALUES (?, ?)",
                [(e.event_id, self._serialize_event(e)) for e in self.store.events],
            )

            # Alerts
            conn.executemany(
                "INSERT INTO alerts (alert_id, data) VALUES (?, ?)",
                [(a.alert_id, self._serialize_alert(a)) for a in self.store.alerts],
            )

            # Responses
            conn.executemany(
                "INSERT INTO responses (response_id, data) VALUES (?, ?)",
                [(r.response_id, self._serialize_response(r)) for r in self.store.responses],
            )

            # Incidents
            conn.executemany(
                "INSERT INTO incidents (correlation_id, data) VALUES (?, ?)",
                [
                    (inc.correlation_id, self._serialize_incident(inc))
                    for inc in self.store.incidents_by_correlation.values()
                ],
            )

            # Sets (transient operational state)
            set_data = {
                "revoked_sessions": sorted(self.store.revoked_sessions),
                "step_up_required": sorted(self.store.step_up_required),
                "download_restricted_actors": sorted(self.store.download_restricted_actors),
                "disabled_services": sorted(self.store.disabled_services),
                "quarantined_artifacts": sorted(self.store.quarantined_artifacts),
                "policy_change_restricted_actors": sorted(self.store.policy_change_restricted_actors),
                "alert_signatures": [list(s) for s in self.store.alert_signatures],
            }
            for key, value in set_data.items():
                conn.execute(
                    "INSERT INTO state_sets (key, data) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )

            # Dicts
            dict_data = {
                "actor_sessions": self.store.actor_sessions,
                "risk_profiles": {
                    k: {
                        "actor_id": v.actor_id,
                        "current_score": v.current_score,
                        "peak_score": v.peak_score,
                        "contributing_rules": v.contributing_rules,
                        "score_history": v.score_history,
                        "last_updated": v.last_updated.isoformat() if hasattr(v.last_updated, "isoformat") else v.last_updated,
                    }
                    for k, v in self.store.risk_profiles.items()
                },
                "blocked_routes": {
                    k: sorted(v) for k, v in self.store.blocked_routes.items()
                },
            }
            for key, value in dict_data.items():
                conn.execute(
                    "INSERT INTO state_dicts (key, data) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )

            # Scenario history
            for entry in self.store.scenario_history:
                conn.execute(
                    "INSERT INTO scenario_history (data) VALUES (?)",
                    (json.dumps(entry),),
                )

            # Incident notes
            for corr_id, notes in self.store.incident_notes.items():
                for note in notes:
                    conn.execute(
                        "INSERT INTO incident_notes (note_id, correlation_id, data) VALUES (?, ?, ?)",
                        (note["note_id"], corr_id, json.dumps(note)),
                    )

            conn.commit()
        finally:
            conn.close()

    # --- Load ---

    def load(self) -> bool:
        """Load store state from SQLite. Returns True if data was loaded.

        Loading is **atomic with respect to the in-memory store**: all rows
        are deserialized into staging variables first.  Only after every
        table has been parsed successfully are the results swapped into the
        live store.  A deserialization failure therefore leaves the
        existing in-memory state completely untouched.
        """
        if not self.db_path.exists():
            return False

        conn = self._connect()
        try:
            # Check if any data exists across all tables
            total = 0
            for table in ("events", "alerts", "responses", "incidents",
                          "state_sets", "state_dicts", "scenario_history",
                          "incident_notes"):
                total += conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if total == 0:
                return False

            # ----------------------------------------------------------
            # Stage 1: deserialize everything into local variables.
            # If any row is corrupt the exception is raised here and
            # the live store is never touched.
            # ----------------------------------------------------------

            staged_events: list[Event] = []
            for row in conn.execute("SELECT data FROM events"):
                staged_events.append(self._deserialize_event(row[0]))

            staged_alerts: list[Alert] = []
            for row in conn.execute("SELECT data FROM alerts"):
                staged_alerts.append(self._deserialize_alert(row[0]))

            staged_responses: list[ResponseAction] = []
            for row in conn.execute("SELECT data FROM responses"):
                staged_responses.append(self._deserialize_response(row[0]))

            staged_incidents: dict[str, Incident] = {}
            for row in conn.execute("SELECT data FROM incidents"):
                incident = self._deserialize_incident(row[0])
                staged_incidents[incident.correlation_id] = incident

            # Sets
            staged_sets: dict[str, Any] = {}
            for row in conn.execute("SELECT key, data FROM state_sets"):
                key, raw = row[0], json.loads(row[1])
                if key == "alert_signatures":
                    staged_sets[key] = {tuple(s) for s in raw}
                else:
                    staged_sets[key] = set(raw)

            # Dicts
            staged_actor_sessions: dict[str, str] = {}
            staged_risk_profiles: dict[str, object] = {}
            staged_blocked_routes: dict[str, set[str]] = {}
            for row in conn.execute("SELECT key, data FROM state_dicts"):
                key, raw = row[0], json.loads(row[1])
                if key == "actor_sessions":
                    staged_actor_sessions = raw
                elif key == "risk_profiles":
                    from app.services.risk_service import RiskProfile
                    for actor_id, pd in raw.items():
                        staged_risk_profiles[actor_id] = RiskProfile(
                            actor_id=pd["actor_id"],
                            current_score=pd["current_score"],
                            peak_score=pd["peak_score"],
                            contributing_rules=pd["contributing_rules"],
                            score_history=pd["score_history"],
                            last_updated=datetime.fromisoformat(pd["last_updated"]),
                        )
                elif key == "blocked_routes":
                    staged_blocked_routes = {
                        k: set(v) for k, v in raw.items()
                    }

            staged_scenario_history: list[dict] = []
            for row in conn.execute("SELECT data FROM scenario_history ORDER BY id"):
                staged_scenario_history.append(json.loads(row[0]))

            from collections import defaultdict
            staged_incident_notes: defaultdict[str, list[dict]] = defaultdict(list)
            for row in conn.execute("SELECT correlation_id, data FROM incident_notes"):
                staged_incident_notes[row[0]].append(json.loads(row[1]))

            # ----------------------------------------------------------
            # Stage 2: all deserialization succeeded — swap into the
            # live store.  This block contains only assignments, no
            # parsing, so it cannot partially fail.
            # ----------------------------------------------------------

            self.store.events = staged_events
            self.store.alerts = staged_alerts
            self.store.responses = staged_responses
            self.store.incidents_by_correlation = staged_incidents
            self.store.actor_sessions = staged_actor_sessions
            self.store.risk_profiles = staged_risk_profiles
            self.store.blocked_routes = staged_blocked_routes
            self.store.scenario_history = staged_scenario_history
            self.store.incident_notes = staged_incident_notes

            self.store.revoked_sessions = staged_sets.get("revoked_sessions", set())
            self.store.step_up_required = staged_sets.get("step_up_required", set())
            self.store.download_restricted_actors = staged_sets.get("download_restricted_actors", set())
            self.store.disabled_services = staged_sets.get("disabled_services", set())
            self.store.quarantined_artifacts = staged_sets.get("quarantined_artifacts", set())
            self.store.policy_change_restricted_actors = staged_sets.get("policy_change_restricted_actors", set())
            self.store.alert_signatures = staged_sets.get("alert_signatures", set())

            # Clear derived indices before rebuilding so a second load()
            # on the same store doesn't accumulate stale entries.
            self.store.login_failures_by_actor.clear()
            self.store.document_reads_by_actor.clear()
            self.store.authorization_failures_by_actor.clear()
            self.store.artifact_failures_by_actor.clear()

            # Rebuild derived event indices from loaded events.
            self._rebuild_event_indices()

            return True
        except Exception as exc:
            # Log the error but leave the live store untouched (no
            # staging data was swapped in).  SQLite data is also
            # preserved — nothing is deleted.
            import logging
            logging.getLogger("aegisrange.persistence").error(
                "Failed to load persisted state: %s. Starting with empty store.", exc
            )
            return False
        finally:
            conn.close()

    def clear(self) -> None:
        """Delete all persisted data."""
        conn = self._connect()
        try:
            conn.executescript("""
                DELETE FROM events;
                DELETE FROM alerts;
                DELETE FROM responses;
                DELETE FROM incidents;
                DELETE FROM state_sets;
                DELETE FROM state_dicts;
                DELETE FROM scenario_history;
                DELETE FROM incident_notes;
            """)
            conn.commit()
        finally:
            conn.close()

    def _rebuild_event_indices(self) -> None:
        """Rebuild derived per-actor event indices from loaded events.

        These defaultdict indices are populated by TelemetryService.emit()
        during normal runtime. After a cold load from SQLite, the events
        exist in store.events but the indices are empty. This method
        replays the indexing logic so the indices stay consistent.
        """
        event_type_to_index = {
            "authentication.login.failure": self.store.login_failures_by_actor,
            "document.read.success": self.store.document_reads_by_actor,
            "authorization.failure": self.store.authorization_failures_by_actor,
            "artifact.validation.failed": self.store.artifact_failures_by_actor,
        }
        for event in self.store.events:
            index = event_type_to_index.get(event.event_type)
            if index is not None:
                index[event.actor_id].append(event)
