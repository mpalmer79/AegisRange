from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta

from app.models import Event, utc_now
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

VALID_CATEGORIES = {
    "authentication",
    "session",
    "document",
    "system",
    "detection",
    "response",
    "incident",
    "scenario",
    "authorization",
    "artifact",
    "policy",
}

VALID_STATUSES = {"success", "failure"}

VALID_ACTOR_TYPES = {"user", "service", "system"}


class TelemetryService:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def emit(self, event: Event) -> Event:
        self._validate(event)
        self.store.append_event(event)

        if event.event_type == "authentication.login.failure":
            self.store.record_login_failure(event.actor_id, event)
        if event.event_type == "document.read.success":
            self.store.record_document_read(event.actor_id, event)
        if event.event_type == "authorization.failure":
            self.store.record_authorization_failure(event.actor_id, event)
        if event.event_type == "artifact.validation.failed":
            self.store.record_artifact_failure(event.actor_id, event)

        return event

    def lookup_events(
        self,
        *,
        actor_id: str | None = None,
        correlation_id: str | None = None,
        event_types: set[str] | None = None,
        since_minutes: int | None = None,
    ) -> list[Event]:
        # Use the narrowest secondary index first, then filter remaining
        # predicates.  This avoids scanning the entire event list.
        if actor_id:
            events: Iterable[Event] = self.store.get_events_by_actor(actor_id)
        elif correlation_id:
            events = self.store.get_events_by_correlation(correlation_id)
        else:
            events = self.store.get_events()

        # Apply remaining filters (skipping the one already used as index)
        if actor_id and correlation_id:
            events = (
                event for event in events if event.correlation_id == correlation_id
            )
        if event_types:
            events = (event for event in events if event.event_type in event_types)
        if since_minutes is not None:
            cutoff = utc_now() - timedelta(minutes=since_minutes)
            events = (event for event in events if event.timestamp >= cutoff)

        return sorted(events, key=lambda event: event.timestamp)

    @staticmethod
    def _validate(event: Event) -> None:
        event_fields = set(event.__dict__.keys())
        missing = REQUIRED_EVENT_FIELDS - event_fields
        if missing:
            missing_fields = ", ".join(sorted(missing))
            raise ValueError(f"Event missing required fields: {missing_fields}")

        if not event.event_type or "." not in event.event_type:
            raise ValueError(
                f"Invalid event_type format: '{event.event_type}'. Expected dotted notation (e.g. 'authentication.login.success')."
            )

        if event.category not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category: '{event.category}'. Must be one of: {sorted(VALID_CATEGORIES)}"
            )

        if event.status not in VALID_STATUSES:
            raise ValueError(
                f"Invalid status: '{event.status}'. Must be one of: {sorted(VALID_STATUSES)}"
            )

        if event.actor_type not in VALID_ACTOR_TYPES:
            raise ValueError(
                f"Invalid actor_type: '{event.actor_type}'. Must be one of: {sorted(VALID_ACTOR_TYPES)}"
            )

        if not isinstance(event.payload, dict):
            raise ValueError("Event payload must be a dict.")
