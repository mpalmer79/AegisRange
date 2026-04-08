from __future__ import annotations

import os
from collections import defaultdict

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

    def enable_persistence(self, db_path: str = "aegisrange.db") -> None:
        """Enable SQLite persistence. Call once at startup."""
        from app.persistence import PersistenceLayer
        self._persistence = PersistenceLayer(self, db_path=db_path)
        self._persistence.load()

    def save(self) -> None:
        """Persist current state to SQLite (no-op if persistence not enabled)."""
        if self._persistence:
            self._persistence.save()

    def reset(self) -> None:
        if self._persistence:
            self._persistence.clear()
        p = self._persistence
        self.__init__()
        self._persistence = p


# Module-level singleton. Tests use this directly (in-memory only).
# main.py calls STORE.enable_persistence() to add SQLite backing.
STORE = InMemoryStore()
