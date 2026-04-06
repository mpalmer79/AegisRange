from __future__ import annotations

from collections import defaultdict

from app.models import Alert, Event, Incident, ResponseAction


class InMemoryStore:
    """In-memory Phase 2 store with rule indexes and deduplication state."""

    def __init__(self) -> None:
        self.events: list[Event] = []
        self.alerts: list[Alert] = []
        self.responses: list[ResponseAction] = []
        self.incidents_by_correlation: dict[str, Incident] = {}

        # Identity/session state
        self.actor_sessions: dict[str, str] = {}
        self.revoked_sessions: set[str] = set()
        self.step_up_required: set[str] = set()
        self.rate_limited_actors: set[str] = set()
        self.download_restricted_actors: set[str] = set()

        # Rule-support indexes
        self.login_failures_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.login_failures_by_source: defaultdict[str, list[Event]] = defaultdict(list)
        self.document_reads_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.authz_events_by_session: defaultdict[str, list[Event]] = defaultdict(list)

        # Deduplication
        self.alert_signatures: set[tuple[str, tuple[str, ...]]] = set()
        self.response_signatures: set[tuple[str, str, str]] = set()

    def reset(self) -> None:
        self.__init__()


STORE = InMemoryStore()
