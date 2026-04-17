"""Core adversary-script types — ``Beat``, ``BeatKind``, ``ScriptContext``.

A script is a list of :class:`Beat` objects. Each beat describes one
unit of adversarial activity (a failed login, a document read, a
session reuse). Scripts are data, not code — they can be inspected,
tested, and replayed at different speeds.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any
from uuid import uuid4

from app.models import Confidence, Event, Severity, utc_now
from app.services.document_service import DocumentService
from app.services.identity_service import IdentityService
from app.services.pipeline_service import EventPipelineService
from app.store import InMemoryStore


class BeatKind(str, Enum):
    """Types of adversarial action a beat can represent."""

    FAILED_LOGIN = "failed_login"
    SUCCESSFUL_LOGIN = "successful_login"
    SESSION_TOKEN_ISSUED = "session_token_issued"
    SESSION_REUSE = "session_reuse"
    DOCUMENT_READ = "document_read"
    DOCUMENT_DOWNLOAD = "document_download"
    AUTHORIZATION_FAILURE = "authorization_failure"


@dataclass(frozen=True)
class Beat:
    """One step of an adversary script.

    ``delay_before_seconds`` is the *base* delay (pre-difficulty).
    Schedulers multiply it by a pacing factor per difficulty rank.
    """

    kind: BeatKind
    label: str
    delay_before_seconds: float
    params: dict[str, Any]


@dataclass
class ScriptContext:
    """Services a beat needs in order to mutate the world.

    ``state`` is a scratch dict that outputs from one beat can be read
    by subsequent beats (e.g. the session id minted by a successful
    login is needed by later reuse/read/download beats). Handlers
    should treat ``state`` as the fallback when a param is None."""

    correlation_id: str
    pipeline: EventPipelineService
    identity: IdentityService
    documents: DocumentService
    store: InMemoryStore
    state: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        if self.state is None:
            self.state = {}


def _new_event(
    *,
    event_type: str,
    category: str,
    actor_id: str,
    actor_role: str,
    correlation_id: str,
    payload: dict[str, Any],
    actor_type: str = "user",
    target_id: str | None = None,
    target_type: str = "identity",
    session_id: str | None = None,
    source_ip: str = "203.0.113.10",
    status: str = "success",
    status_code: str | None = "200",
    error_message: str | None = None,
) -> Event:
    """Mirror of :meth:`ScenarioEngine._new_event` — kept in-sync so a
    beat-driven script produces structurally identical events to the
    legacy synchronous engine."""
    return Event(
        event_type=event_type,
        category=category,
        timestamp=utc_now(),
        actor_id=actor_id,
        actor_type=actor_type,
        actor_role=actor_role,
        target_type=target_type,
        target_id=target_id or actor_id,
        request_id=f"req-{uuid4()}",
        correlation_id=correlation_id,
        session_id=session_id,
        source_ip=source_ip,
        user_agent="Scenario/1.0",
        origin="scenario",
        status=status,
        status_code=status_code,
        error_message=error_message,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.HIGH,
        payload=payload,
    )
