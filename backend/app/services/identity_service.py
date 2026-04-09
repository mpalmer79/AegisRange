from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from app.store import InMemoryStore


@dataclass(frozen=True)
class AuthResult:
    success: bool
    actor_id: str
    actor_role: str
    session_id: str | None
    reason: str | None = None


class IdentityService:
    """Authentication, session management, and step-up enforcement for Phase 1."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self._users = {
            "alice": {
                "password": "correct-horse",
                "role": "analyst",
                "actor_id": "user-alice",
            },
            "bob": {"password": "hunter2", "role": "admin", "actor_id": "user-bob"},
        }

    def authenticate(self, username: str, password: str) -> AuthResult:
        user = self._users.get(username)
        if not user or user["password"] != password:
            actor_id = user["actor_id"] if user else f"user-{username}"
            return AuthResult(
                success=False,
                actor_id=actor_id,
                actor_role=user["role"] if user else "unknown",
                session_id=None,
                reason="invalid_credentials",
            )

        session_id = f"session-{uuid4()}"
        self.store.set_actor_session(user["actor_id"], session_id)
        return AuthResult(
            success=True,
            actor_id=user["actor_id"],
            actor_role=user["role"],
            session_id=session_id,
        )

    def validate_session(self, session_id: str) -> bool:
        if session_id in self.store.revoked_sessions:
            return False
        return session_id in self.store.actor_sessions.values()

    def revoke_session(self, session_id: str) -> bool:
        if session_id not in self.store.actor_sessions.values():
            return False
        self.store.revoke_session(session_id)
        return True

    def is_step_up_required(self, actor_id: str) -> bool:
        return self.store.is_step_up_required(actor_id)

    def is_session_revoked(self, session_id: str) -> bool:
        return self.store.is_session_revoked(session_id)

    def session_exists(self, session_id: str) -> bool:
        return self.store.session_exists(session_id)

    def find_actor_by_session(self, session_id: str) -> str | None:
        return self.store.find_actor_for_session(session_id)

    def is_known_simulation_actor(self, actor_id: str) -> bool:
        """Check whether actor_id matches a known simulation identity."""
        known_actor_ids = {u["actor_id"] for u in self._users.values()}
        return actor_id in known_actor_ids

    def clear_step_up(self, actor_id: str) -> None:
        self.store.clear_step_up(actor_id)
