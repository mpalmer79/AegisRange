from __future__ import annotations

from collections import defaultdict
from contextlib import contextmanager
from typing import Generator

from app.models import Alert, Event, Incident, ResponseAction


class InMemoryStore:
    """In-memory backing store. Optionally backed by SQLite persistence."""

    def __init__(self) -> None:
        self.events: list[Event] = []
        self.alerts: list[Alert] = []
        self.responses: list[ResponseAction] = []
        self.incidents_by_correlation: dict[str, Incident] = {}
        self.actor_sessions: dict[str, str] = {}
        self.revoked_sessions: set[str] = set()
        self.step_up_required: set[str] = set()
        self.download_restricted_actors: set[str] = set()
        self.alert_signatures: set[tuple[str, str, str]] = set()
        self.login_failures_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.document_reads_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.disabled_services: set[str] = set()
        self.blocked_routes: dict[str, set[str]] = {}
        self.quarantined_artifacts: set[str] = set()
        self.policy_change_restricted_actors: set[str] = set()
        self.authorization_failures_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.artifact_failures_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.risk_profiles: dict[str, object] = {}
        self.scenario_history: list[dict] = []
        self.incident_notes: defaultdict[str, list[dict]] = defaultdict(list)
        self._persistence = None

    # --- Write methods (single owners of entity mutations) ---

    def append_event(self, event: Event) -> None:
        """Append a single event and persist incrementally."""
        self.events.append(event)
        if self._persistence:
            self._persistence.persist_event(event)

    def extend_alerts(self, alerts: list[Alert]) -> None:
        """Extend alerts list and persist incrementally."""
        self.alerts.extend(alerts)
        if self._persistence:
            self._persistence.persist_alerts(alerts)

    def extend_responses(self, responses: list[ResponseAction]) -> None:
        """Extend responses list and persist incrementally."""
        self.responses.extend(responses)
        if self._persistence:
            self._persistence.persist_responses(responses)

    def upsert_incident(self, incident: Incident) -> None:
        """Insert or update an incident and persist incrementally."""
        self.incidents_by_correlation[incident.correlation_id] = incident
        if self._persistence:
            self._persistence.persist_incident(incident)

    def append_incident_note(self, correlation_id: str, note: dict) -> None:
        """Append an incident note and persist incrementally."""
        self.incident_notes[correlation_id].append(note)
        if self._persistence:
            self._persistence.persist_incident_note(correlation_id, note)

    def append_scenario_history(self, entry: dict) -> None:
        """Append a scenario history entry and persist incrementally."""
        self.scenario_history.append(entry)
        if self._persistence:
            self._persistence.persist_scenario_history_entry(entry)

    # --- Transaction context ---

    @contextmanager
    def transaction(self) -> Generator[None, None, None]:
        """Group multiple persistence writes into a single SQLite transaction.

        Usage::

            with store.transaction():
                store.append_event(event)
                store.extend_alerts(alerts)
                store.upsert_incident(incident)

        If persistence is not enabled, this is a no-op context manager.
        On exception the transaction is rolled back; otherwise it commits.
        """
        if self._persistence is None:
            yield
            return
        self._persistence.begin_transaction()
        try:
            yield
            self._persistence.commit_transaction()
        except Exception:
            self._persistence.rollback_transaction()
            raise

    # --- Persistence lifecycle ---

    def enable_persistence(self, db_path: str = "aegisrange.db") -> None:
        """Enable SQLite persistence. Call once at startup."""
        from app.persistence import PersistenceLayer
        self._persistence = PersistenceLayer(self, db_path=db_path)
        self._persistence.load()

    def save(self) -> None:
        """Persist operational state to SQLite (no-op if persistence not enabled).

        Entity tables (events, alerts, responses, incidents, notes,
        scenario_history) are persisted incrementally via write methods.
        This only saves operational state (sets, dicts).
        """
        if self._persistence:
            self._persistence.save_operational_state()

    def reset(self) -> None:
        if self._persistence:
            self._persistence.clear()
        p = self._persistence
        self.__init__()
        self._persistence = p


# Module-level singleton. Tests use this directly (in-memory only).
# main.py calls STORE.enable_persistence() to add SQLite backing.
STORE = InMemoryStore()
