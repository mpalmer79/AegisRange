from __future__ import annotations

from dataclasses import dataclass

from app.store import InMemoryStore


@dataclass(frozen=True)
class AuthResult:
    success: bool
    actor_id: str
    actor_role: str
    session_id: str | None
    reason: str | None = None


class IdentityService:
    """Simplified auth/session logic for Phase 1."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self._users = {
            "alice": {"password": "correct-horse", "role": "analyst", "actor_id": "user-alice"},
            "bob": {"password": "hunter2", "role": "admin", "actor_id": "user-bob"},
        }

    def authenticate(self, username: str, password: str) -> AuthResult:
        user = self._users.get(username)
        if not user or user["password"] != password:
            actor_id = user["actor_id"] if user else f"user-{username}"
            return AuthResult(success=False, actor_id=actor_id, actor_role=user["role"] if user else "unknown", session_id=None, reason="invalid_credentials")

        session_id = f"session-{user['actor_id']}"
        self.store.actor_sessions[user["actor_id"]] = session_id
        return AuthResult(
            success=True,
            actor_id=user["actor_id"],
            actor_role=user["role"],
            session_id=session_id,
        )
