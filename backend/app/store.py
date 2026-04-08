from __future__ import annotations

from collections import defaultdict

from app.models import Alert, Event, Incident, ResponseAction


class InMemoryStore:
    """Simple in-memory backing store for the Phase 1 modular monolith."""

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

    def reset(self) -> None:
        self.__init__()


STORE = InMemoryStore()
