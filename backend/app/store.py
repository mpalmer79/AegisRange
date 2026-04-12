from __future__ import annotations

from collections import defaultdict
from contextlib import contextmanager
from typing import TYPE_CHECKING, Generator

from app.models import Alert, Event, Incident, ResponseAction

if TYPE_CHECKING:
    from app.services.risk_service import RiskProfile


class InMemoryStore:
    """In-memory backing store. Optionally backed by SQLite persistence."""

    def __init__(self) -> None:
        self.events: list[Event] = []
        self.alerts: list[Alert] = []
        self.responses: list[ResponseAction] = []
        self.incidents_by_correlation: dict[str, Incident] = {}
        self.actor_sessions: dict[str, str] = {}
        self.revoked_sessions: set[str] = set()
        self.revoked_jtis: set[str] = set()
        self.step_up_required: set[str] = set()
        self.download_restricted_actors: set[str] = set()
        self.alert_signatures: set[tuple[str, str, str]] = set()
        self.login_failures_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.document_reads_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
        self.disabled_services: set[str] = set()
        self.blocked_routes: dict[str, set[str]] = {}
        self.quarantined_artifacts: set[str] = set()
        self.policy_change_restricted_actors: set[str] = set()
        self.authorization_failures_by_actor: defaultdict[str, list[Event]] = (
            defaultdict(list)
        )
        self.artifact_failures_by_actor: defaultdict[str, list[Event]] = defaultdict(
            list
        )
        self.risk_profiles: dict[str, RiskProfile] = {}
        self.scenario_history: list[dict] = []
        self.incident_notes: defaultdict[str, list[dict]] = defaultdict(list)
        self._persistence = None

    # --- Entity write methods (incremental persistence) ---

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

    # --- Authoritative operational-state write methods ---
    #
    # Containment sets and risk profiles are authoritative state that
    # must persist across restarts.  These methods encapsulate all
    # mutations so callers never touch the raw collections directly.
    # Persistence happens via operational-state snapshots (save()).

    def revoke_session(self, session_id: str) -> None:
        """Mark a session as revoked (authoritative containment state)."""
        self.revoked_sessions.add(session_id)

    def revoke_jti(self, jti: str) -> None:
        """Mark a JWT token ID as revoked (authoritative containment state)."""
        self.revoked_jtis.add(jti)

    def require_step_up(self, actor_id: str) -> None:
        """Require step-up authentication for an actor."""
        self.step_up_required.add(actor_id)

    def clear_step_up(self, actor_id: str) -> None:
        """Remove step-up requirement for an actor."""
        self.step_up_required.discard(actor_id)

    def restrict_downloads(self, actor_id: str) -> None:
        """Restrict download access for an actor."""
        self.download_restricted_actors.add(actor_id)

    def disable_service(self, service_id: str) -> None:
        """Disable a service."""
        self.disabled_services.add(service_id)

    def block_routes(self, service_id: str, routes: list[str]) -> None:
        """Block specific routes for a service."""
        if service_id not in self.blocked_routes:
            self.blocked_routes[service_id] = set()
        self.blocked_routes[service_id].update(routes)

    def quarantine_artifact(self, artifact_id: str) -> None:
        """Quarantine an artifact."""
        self.quarantined_artifacts.add(artifact_id)

    def restrict_policy_changes(self, actor_id: str) -> None:
        """Restrict policy changes for an actor."""
        self.policy_change_restricted_actors.add(actor_id)

    def update_risk_profile(self, actor_id: str, profile: RiskProfile) -> None:
        """Update or create a risk profile for an actor."""
        self.risk_profiles[actor_id] = profile

    # --- Derived-state write methods ---
    #
    # Derived state is rebuilt from events on load. These methods
    # still encapsulate mutations for consistency and testability,
    # but they do NOT trigger persistence.

    def record_login_failure(self, actor_id: str, event: Event) -> None:
        """Record a login failure event for derived-state tracking."""
        self.login_failures_by_actor[actor_id].append(event)

    def record_document_read(self, actor_id: str, event: Event) -> None:
        """Record a document read event for derived-state tracking."""
        self.document_reads_by_actor[actor_id].append(event)

    def record_authorization_failure(self, actor_id: str, event: Event) -> None:
        """Record an authorization failure for derived-state tracking."""
        self.authorization_failures_by_actor[actor_id].append(event)

    def record_artifact_failure(self, actor_id: str, event: Event) -> None:
        """Record an artifact failure for derived-state tracking."""
        self.artifact_failures_by_actor[actor_id].append(event)

    def add_alert_signature(self, signature: tuple[str, str, str]) -> bool:
        """Register an alert dedup signature. Returns True if novel."""
        if signature in self.alert_signatures:
            return False
        self.alert_signatures.add(signature)
        return True

    def set_actor_session(self, actor_id: str, session_id: str) -> None:
        """Record a simulated actor's session (ephemeral state)."""
        self.actor_sessions[actor_id] = session_id

    # --- Read-only accessor methods ---
    #
    # Routers and services should use these instead of reaching into
    # the raw collections.  This encapsulates the data layout and
    # makes it straightforward to swap the backing store later.

    def get_events(self) -> list[Event]:
        """Return all events (snapshot copy)."""
        return list(self.events)

    def get_alerts(self) -> list[Alert]:
        """Return all alerts (snapshot copy)."""
        return list(self.alerts)

    def get_responses(self) -> list[ResponseAction]:
        """Return all responses (snapshot copy)."""
        return list(self.responses)

    def get_incident(self, correlation_id: str) -> Incident | None:
        """Look up an incident by correlation ID."""
        return self.incidents_by_correlation.get(correlation_id)

    def get_all_incidents(self) -> list[Incident]:
        """Return all incidents."""
        return list(self.incidents_by_correlation.values())

    def get_incident_notes_for(self, correlation_id: str) -> list[dict]:
        """Return notes for a specific incident."""
        return list(self.incident_notes.get(correlation_id, []))

    def get_scenario_history_entries(self) -> list[dict]:
        """Return all scenario history entries."""
        return list(self.scenario_history)

    def is_session_revoked(self, session_id: str) -> bool:
        """Check if a session has been revoked."""
        return session_id in self.revoked_sessions

    def is_jti_revoked(self, jti: str) -> bool:
        """Check if a JWT token ID has been revoked."""
        return jti in self.revoked_jtis

    def is_step_up_required(self, actor_id: str) -> bool:
        """Check if step-up auth is required for an actor."""
        return actor_id in self.step_up_required

    def is_download_restricted(self, actor_id: str) -> bool:
        """Check if download access is restricted for an actor."""
        return actor_id in self.download_restricted_actors

    def session_exists(self, session_id: str) -> bool:
        """Check if a session exists (regardless of revocation status)."""
        return session_id in self.actor_sessions.values()

    def find_actor_for_session(self, session_id: str) -> str | None:
        """Find the actor ID associated with a session."""
        return next(
            (a for a, s in self.actor_sessions.items() if s == session_id), None
        )

    def get_containment_counts(self) -> dict[str, int]:
        """Return counts of all active containment measures."""
        return {
            "step_up_required": len(self.step_up_required),
            "revoked_sessions": len(self.revoked_sessions),
            "download_restricted": len(self.download_restricted_actors),
            "disabled_services": len(self.disabled_services),
            "quarantined_artifacts": len(self.quarantined_artifacts),
        }

    def get_all_incidents_dict(self) -> dict[str, Incident]:
        """Return a copy of the incidents-by-correlation mapping."""
        return dict(self.incidents_by_correlation)

    def is_policy_change_restricted(self, actor_id: str) -> bool:
        """Check if an actor is restricted from policy changes."""
        return actor_id in self.policy_change_restricted_actors

    def is_service_disabled(self, service_id: str) -> bool:
        """Check if a service has been disabled."""
        return service_id in self.disabled_services

    def is_artifact_quarantined(self, artifact_id: str) -> bool:
        """Check if an artifact has been quarantined."""
        return artifact_id in self.quarantined_artifacts

    def get_blocked_routes(self, service_id: str) -> set[str]:
        """Return blocked routes for a service."""
        return set(self.blocked_routes.get(service_id, set()))

    def get_all_revoked_sessions(self) -> set[str]:
        """Return all revoked session IDs (snapshot copy)."""
        return set(self.revoked_sessions)

    def get_all_download_restricted(self) -> set[str]:
        """Return all download-restricted actor IDs."""
        return set(self.download_restricted_actors)

    def get_all_step_up_required(self) -> set[str]:
        """Return all actor IDs requiring step-up auth."""
        return set(self.step_up_required)

    def get_all_disabled_services(self) -> set[str]:
        """Return all disabled service IDs."""
        return set(self.disabled_services)

    def get_all_quarantined_artifacts(self) -> set[str]:
        """Return all quarantined artifact IDs."""
        return set(self.quarantined_artifacts)

    def get_all_policy_change_restricted(self) -> set[str]:
        """Return all policy-change-restricted actor IDs."""
        return set(self.policy_change_restricted_actors)

    def get_risk_profile(self, actor_id: str) -> RiskProfile | None:
        """Look up a risk profile by actor ID."""
        return self.risk_profiles.get(actor_id)

    def get_all_risk_profiles(self) -> list[RiskProfile]:
        """Return all risk profiles."""
        return list(self.risk_profiles.values())

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
