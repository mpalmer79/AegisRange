from __future__ import annotations

from collections import defaultdict

from app.models import Alert, Event, Incident, ResponseAction


class InMemoryStore:
    """In-memory Phase 2 store with richer indexes for rule correlation and scenarios."""

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
        self.document_reads_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.authz_events_by_session: defaultdict[str, list[Event]] = defaultdict(list)

    def reset(self) -> None:
        self.__init__()


STORE = InMemoryStore()
