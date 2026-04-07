from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta

from app.models import Event
from app.store import InMemoryStore

REQUIRED_EVENT_FIELDS = {
    "event_type",
    "category",
    "actor_id",
    "actor_type",
    "request_id",
    "correlation_id",
    "status",
    "source_ip",
    "origin",
    "payload",
}


class TelemetryService:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def emit(self, event: Event) -> Event:
        self._validate(event)
        self.store.events.append(event)
        self._index(event)
        return event

    def lookup_events(
        self,
        *,
        actor_id: str | None = None,
        source_ip: str | None = None,
        correlation_id: str | None = None,
        session_id: str | None = None,
        event_types: set[str] | None = None,
        since_minutes: int | None = None,
    ) -> list[Event]:
        events: Iterable[Event] = self.store.events

        if actor_id:
            events = (event for event in events if event.actor_id == actor_id)
        if source_ip:
            events = (event for event in events if event.source_ip == source_ip)
        if correlation_id:
            events = (event for event in events if event.correlation_id == correlation_id)
        if session_id:
            events = (event for event in events if event.session_id == session_id)
        if event_types:
            events = (event for event in events if event.event_type in event_types)
        if since_minutes is not None:
            cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
            events = (event for event in events if event.timestamp >= cutoff)

        return sorted(events, key=lambda event: event.timestamp)

    @staticmethod
    def _validate(event: Event) -> None:
        event_fields = set(event.__dict__.keys())
        missing = REQUIRED_EVENT_FIELDS - event_fields
        if missing:
            missing_fields = ", ".join(sorted(missing))
            raise ValueError(f"Event missing required fields: {missing_fields}")

    def _index(self, event: Event) -> None:
        if event.event_type == "authentication.login.failure":
            self.store.login_failures_by_actor[event.actor_id].append(event)
            self.store.login_failures_by_source[event.source_ip].append(event)
        if event.event_type == "document.read.success":
            self.store.document_reads_by_actor[event.actor_id].append(event)
        if event.event_type == "document.download.success":
            self.store.document_downloads_by_actor[event.actor_id].append(event)
        if event.event_type.startswith("authorization.") and event.session_id:
            self.store.authz_events_by_session[event.session_id].append(event)
