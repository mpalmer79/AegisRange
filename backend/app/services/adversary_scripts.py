"""Adversary scripts — declarative beat sequences for each scenario.

A script is a list of :class:`Beat` objects. Each beat describes one unit
of adversarial activity (a failed login, a document read, a session
reuse). Scripts are data, not code — they can be inspected, tested, and
replayed at different speeds.

The :func:`apply_beat` dispatcher knows how to realise each
:class:`BeatKind` against a :class:`ScriptContext` (pipeline + services).
For Phase 2 the resulting final state is byte-equivalent to the legacy
:class:`~app.services.scenario_service.ScenarioEngine` methods — the
difference is that the async mission scheduler can pause between beats
and publish world updates to a per-run SSE stream.
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


# ---------------------------------------------------------------------------
# Event construction
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Beat dispatch
# ---------------------------------------------------------------------------


def apply_beat(beat: Beat, ctx: ScriptContext) -> None:
    """Realise a beat against the context. Mutates the store via the
    pipeline — detection + response + incident creation flow through
    exactly as they did for the legacy engine."""
    handler = _HANDLERS.get(beat.kind)
    if handler is None:
        raise ValueError(f"Unknown beat kind: {beat.kind}")
    handler(beat.params, ctx)


def _handle_failed_login(params: dict[str, Any], ctx: ScriptContext) -> None:
    username = params["username"]
    ctx.identity.authenticate(username, "wrong")
    ctx.pipeline.process(
        _new_event(
            event_type="authentication.login.failure",
            category="authentication",
            actor_id=params.get("actor_id", f"user-{username}"),
            actor_role=params.get("actor_role", "analyst"),
            correlation_id=ctx.correlation_id,
            target_id=username,
            source_ip=params.get("source_ip", "203.0.113.10"),
            status="failure",
            status_code="401",
            error_message="invalid_credentials",
            payload={
                "username": username,
                "authentication_method": "password",
            },
        )
    )


def _handle_successful_login(params: dict[str, Any], ctx: ScriptContext) -> None:
    """Authenticate the user and (unless ``emit_event=False``) emit the
    ``authentication.login.success`` event.

    ``emit_event=False`` is used by scenarios whose legacy implementation
    calls ``identity.authenticate`` only as *setup* (to get a session
    id) and does not push a login-success event into the pipeline —
    scn-session-002, scn-doc-003, scn-doc-004. Keeping the event-less
    variant preserves byte-equivalence with the legacy engine's event
    count."""
    username = params["username"]
    password = params["password"]
    result = ctx.identity.authenticate(username, password)
    if params.get("emit_event", True):
        ctx.pipeline.process(
            _new_event(
                event_type="authentication.login.success",
                category="authentication",
                actor_id=result.actor_id,
                actor_role=result.actor_role,
                correlation_id=ctx.correlation_id,
                target_id=username,
                source_ip=params.get("source_ip", "203.0.113.10"),
                status="success",
                status_code="200",
                session_id=result.session_id,
                payload={
                    "username": username,
                    "authentication_method": "password",
                },
            )
        )
    assert ctx.state is not None  # set in __post_init__
    ctx.state["session_id"] = result.session_id
    ctx.state["actor_id"] = result.actor_id
    ctx.state["actor_role"] = result.actor_role


def _handle_session_token_issued(params: dict[str, Any], ctx: ScriptContext) -> None:
    session_id = params.get("session_id") or (ctx.state or {}).get("session_id")
    if session_id is None:
        raise RuntimeError(
            "SESSION_TOKEN_ISSUED beat requires a session_id (either in params "
            "or previously emitted by a SUCCESSFUL_LOGIN beat)"
        )
    ctx.pipeline.process(
        _new_event(
            event_type="session.token.issued",
            category="session",
            actor_id=params["actor_id"],
            actor_role=params.get("actor_role", "analyst"),
            correlation_id=ctx.correlation_id,
            target_type="session",
            target_id=session_id,
            session_id=session_id,
            source_ip=params.get("source_ip", "198.51.100.10"),
            payload={
                "token_id": session_id,
                "session_state": "issued",
                "authentication_strength": "password",
            },
        )
    )


def _handle_session_reuse(params: dict[str, Any], ctx: ScriptContext) -> None:
    session_id = params.get("session_id") or (ctx.state or {}).get("session_id")
    if session_id is None:
        raise RuntimeError(
            "SESSION_REUSE beat requires a session_id (either in params or "
            "previously emitted by a SUCCESSFUL_LOGIN beat)"
        )
    ctx.pipeline.process(
        _new_event(
            event_type="authorization.check.success",
            category="session",
            actor_id=params["actor_id"],
            actor_role=params.get("actor_role", "analyst"),
            correlation_id=ctx.correlation_id,
            target_type="session",
            target_id=session_id,
            session_id=session_id,
            source_ip=params["source_ip"],
            payload={
                "session_id": session_id,
                "route": params.get("route", "/documents/doc-002/read"),
            },
        )
    )


def _handle_document_read(params: dict[str, Any], ctx: ScriptContext) -> None:
    role = params.get("role", "admin")
    doc_id = params["document_id"]
    label_suffix = params.get("label_suffix")
    enforce_access = params.get("enforce_access", True)

    if enforce_access:
        allowed, doc = ctx.documents.can_read(role, doc_id)
        if not allowed or not doc:
            raise RuntimeError(
                f"Adversary script expected read access to {doc_id} as {role}"
            )
    else:
        doc = ctx.documents.documents[doc_id]

    logical_id = (
        f"{doc.document_id}-{label_suffix}"
        if label_suffix is not None
        else doc.document_id
    )
    session_id = params.get("session_id") or (ctx.state or {}).get("session_id")
    ctx.pipeline.process(
        _new_event(
            event_type="document.read.success",
            category="document",
            actor_id=params.get("actor_id", "user-bob"),
            actor_role=role,
            correlation_id=ctx.correlation_id,
            target_type="document",
            target_id=doc.document_id,
            session_id=session_id,
            source_ip=params.get("source_ip", "198.51.100.10"),
            payload={
                "document_id": logical_id,
                "classification": doc.classification,
                "sensitivity_score": params.get("sensitivity_score", 90),
            },
        )
    )


def _handle_document_download(params: dict[str, Any], ctx: ScriptContext) -> None:
    role = params.get("role", "admin")
    doc_id = params["document_id"]
    enforce_access = params.get("enforce_access", True)

    if enforce_access:
        allowed, doc = ctx.documents.can_download(role, doc_id)
        if not allowed or not doc:
            raise RuntimeError(
                f"Adversary script expected download access to {doc_id} as {role}"
            )
    else:
        doc = ctx.documents.documents[doc_id]

    session_id = params.get("session_id") or (ctx.state or {}).get("session_id")
    ctx.pipeline.process(
        _new_event(
            event_type="document.download.success",
            category="document",
            actor_id=params.get("actor_id", "user-bob"),
            actor_role=role,
            correlation_id=ctx.correlation_id,
            target_type="document",
            target_id=doc.document_id,
            session_id=session_id,
            source_ip=params.get("source_ip", "198.51.100.10"),
            payload={
                "document_id": doc.document_id,
                "classification": doc.classification,
                "sensitivity_score": params.get("sensitivity_score", 90),
            },
        )
    )


def _handle_authorization_failure(params: dict[str, Any], ctx: ScriptContext) -> None:
    route = params["route"]
    ctx.pipeline.process(
        _new_event(
            event_type="authorization.failure",
            category="system",
            actor_id=params["actor_id"],
            actor_type=params.get("actor_type", "service"),
            actor_role=params.get("actor_role", "service"),
            correlation_id=ctx.correlation_id,
            target_id=route,
            source_ip=params.get("source_ip", "10.0.1.50"),
            status="failure",
            status_code="403",
            payload={
                "route": route,
                "service_id": params["actor_id"].removeprefix("svc-")
                if params["actor_id"].startswith("svc-")
                else params["actor_id"],
            },
        )
    )


_HANDLERS: dict[BeatKind, Any] = {
    BeatKind.FAILED_LOGIN: _handle_failed_login,
    BeatKind.SUCCESSFUL_LOGIN: _handle_successful_login,
    BeatKind.SESSION_TOKEN_ISSUED: _handle_session_token_issued,
    BeatKind.SESSION_REUSE: _handle_session_reuse,
    BeatKind.DOCUMENT_READ: _handle_document_read,
    BeatKind.DOCUMENT_DOWNLOAD: _handle_document_download,
    BeatKind.AUTHORIZATION_FAILURE: _handle_authorization_failure,
}


# ---------------------------------------------------------------------------
# Script builders (one per scenario)
#
# Delays are base (analyst pacing). The scheduler applies a
# difficulty-specific multiplier at replay time. Total durations are
# chosen to land near the scenario's time budget.
# ---------------------------------------------------------------------------


def _script_auth_001() -> list[Beat]:
    beats: list[Beat] = []
    for attempt in range(1, 6):
        beats.append(
            Beat(
                kind=BeatKind.FAILED_LOGIN,
                label=(
                    f"Intruder attempts to authenticate as alice "
                    f"({attempt}/5) from 203.0.113.10"
                ),
                delay_before_seconds=2.0 if attempt > 1 else 0.0,
                params={"username": "alice", "source_ip": "203.0.113.10"},
            )
        )
    beats.append(
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="Intruder succeeds with a valid credential for alice",
            delay_before_seconds=3.0,
            params={
                "username": "alice",
                "password": "Correct_Horse_42!",
                "source_ip": "203.0.113.10",
            },
        )
    )
    return beats


def _script_session_002() -> list[Beat]:
    # The scenario logs bob in with a valid password, then emits two
    # authorization.check.success events — one from the original IP
    # and one from a different IP, simulating token theft.
    #
    # Legacy scn-session-002 does NOT emit a login.success event — the
    # authenticate() call is setup-only. Pass ``emit_event=False`` so
    # the script stays byte-equivalent to the legacy engine.
    return [
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="bob authenticates from 198.51.100.10",
            delay_before_seconds=0.0,
            params={
                "username": "bob",
                "password": "Hunter2_Strong_99!",
                "source_ip": "198.51.100.10",
                "emit_event": False,
            },
        ),
        Beat(
            kind=BeatKind.SESSION_TOKEN_ISSUED,
            label="Session token issued to bob",
            delay_before_seconds=1.5,
            params={
                # These refs are resolved in the builder below after the
                # login beat has been applied; see build_script().
                "actor_id": "user-bob",
                "actor_role": "admin",
                "source_ip": "198.51.100.10",
                # session_id is filled in from login result at replay time
                "session_id": None,
            },
        ),
        Beat(
            kind=BeatKind.SESSION_REUSE,
            label="Same session used from 198.51.100.10",
            delay_before_seconds=2.0,
            params={
                "actor_id": "user-bob",
                "actor_role": "admin",
                "source_ip": "198.51.100.10",
                "session_id": None,
            },
        ),
        Beat(
            kind=BeatKind.SESSION_REUSE,
            label="Same session reused from 203.0.113.55 (anomalous origin)",
            delay_before_seconds=2.0,
            params={
                "actor_id": "user-bob",
                "actor_role": "admin",
                "source_ip": "203.0.113.55",
                "session_id": None,
            },
        ),
    ]


def _script_doc_003() -> list[Beat]:
    # Legacy scn-doc-003 does the login as setup-only, without an
    # emitted login.success event. emit_event=False mirrors that.
    beats: list[Beat] = [
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="bob authenticates from 198.51.100.10",
            delay_before_seconds=0.0,
            params={
                "username": "bob",
                "password": "Hunter2_Strong_99!",
                "source_ip": "198.51.100.10",
                "emit_event": False,
            },
        )
    ]
    # 20 bulk reads of doc-002 as admin.
    for index in range(20):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Bulk read doc-002 ({index + 1}/20)",
                delay_before_seconds=0.3,
                params={
                    "role": "admin",
                    "document_id": "doc-002",
                    "label_suffix": index,
                    "actor_id": "user-bob",
                    "source_ip": "198.51.100.10",
                    "sensitivity_score": 80,
                },
            )
        )
    return beats


def _script_doc_004() -> list[Beat]:
    # Legacy scn-doc-004 does the login as setup-only, without an
    # emitted login.success event. emit_event=False mirrors that.
    beats: list[Beat] = [
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="bob authenticates from 198.51.100.10",
            delay_before_seconds=0.0,
            params={
                "username": "bob",
                "password": "Hunter2_Strong_99!",
                "source_ip": "198.51.100.10",
                "emit_event": False,
            },
        )
    ]
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Read {doc_id}",
                delay_before_seconds=0.7,
                params={
                    "role": "admin",
                    "document_id": doc_id,
                    "actor_id": "user-bob",
                    "source_ip": "198.51.100.10",
                    "sensitivity_score": 90,
                },
            )
        )
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_DOWNLOAD,
                label=f"Download {doc_id}",
                delay_before_seconds=0.7,
                params={
                    "role": "admin",
                    "document_id": doc_id,
                    "actor_id": "user-bob",
                    "source_ip": "198.51.100.10",
                    "sensitivity_score": 90,
                },
            )
        )
    return beats


def _script_svc_005() -> list[Beat]:
    return [
        Beat(
            kind=BeatKind.AUTHORIZATION_FAILURE,
            label=f"svc-data-processor attempts {route}",
            delay_before_seconds=0.5 if idx > 0 else 0.0,
            params={
                "actor_id": "svc-data-processor",
                "actor_type": "service",
                "actor_role": "service",
                "route": route,
                "source_ip": "10.0.1.50",
            },
        )
        for idx, route in enumerate(
            ["/admin/config", "/admin/secrets", "/admin/users", "/admin/audit"]
        )
    ]


def _script_corr_006() -> list[Beat]:
    beats: list[Beat] = []
    # Phase 1: credential abuse.
    for attempt in range(1, 6):
        beats.append(
            Beat(
                kind=BeatKind.FAILED_LOGIN,
                label=f"Credential spray {attempt}/5 against alice",
                delay_before_seconds=1.5 if attempt > 1 else 0.0,
                params={"username": "alice", "source_ip": "203.0.113.10"},
            )
        )
    beats.append(
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="Intruder succeeds as alice",
            delay_before_seconds=2.5,
            params={
                "username": "alice",
                "password": "Correct_Horse_42!",
                "source_ip": "203.0.113.10",
            },
        )
    )
    # Phase 2: bulk document reads.
    docs_cycle = ("doc-001", "doc-002")
    for index in range(20):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Bulk read {docs_cycle[index % 2]} ({index + 1}/20)",
                delay_before_seconds=0.25,
                params={
                    "role": "analyst",
                    "document_id": docs_cycle[index % 2],
                    "label_suffix": index,
                    "actor_id": "user-alice",
                    "source_ip": "203.0.113.10",
                    "sensitivity_score": 80,
                    # session_id injected at replay time
                    "session_id": None,
                },
            )
        )
    # Phase 3: read-to-download exfiltration.
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Read {doc_id} ahead of download",
                delay_before_seconds=0.5,
                params={
                    "role": "analyst",
                    "document_id": doc_id,
                    "actor_id": "user-alice",
                    "source_ip": "203.0.113.10",
                    "sensitivity_score": 90,
                    "enforce_access": doc_id in ("doc-001", "doc-002"),
                    "session_id": None,
                },
            )
        )
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_DOWNLOAD,
                label=f"Download {doc_id}",
                delay_before_seconds=0.5,
                params={
                    "role": "analyst",
                    "document_id": doc_id,
                    "actor_id": "user-alice",
                    "source_ip": "203.0.113.10",
                    "sensitivity_score": 90,
                    "enforce_access": False,  # actor may be restricted after detections
                    "session_id": None,
                },
            )
        )
    return beats


_SCRIPT_BUILDERS: dict[str, Any] = {
    "scn-auth-001": _script_auth_001,
    "scn-session-002": _script_session_002,
    "scn-doc-003": _script_doc_003,
    "scn-doc-004": _script_doc_004,
    "scn-svc-005": _script_svc_005,
    "scn-corr-006": _script_corr_006,
}


def build_script(scenario_id: str) -> list[Beat]:
    """Return a fresh mutable list of beats for ``scenario_id``.

    Beats are frozen dataclasses; the list itself is fresh per call so
    transient fields (e.g. session_id filled in at replay) do not leak
    across runs when stored in ``params``."""
    builder = _SCRIPT_BUILDERS.get(scenario_id)
    if builder is None:
        raise ValueError(f"No adversary script for scenario: {scenario_id}")
    # Make a shallow copy of params so replay mutations don't persist.
    return [
        Beat(
            kind=b.kind,
            label=b.label,
            delay_before_seconds=b.delay_before_seconds,
            params=dict(b.params),
        )
        for b in builder()
    ]


# ---------------------------------------------------------------------------
# Difficulty pacing
# ---------------------------------------------------------------------------


DIFFICULTY_PACING: dict[str, float] = {
    "recruit": 1.5,  # slower, teach-first
    "analyst": 1.0,  # baseline
    "operator": 0.5,  # tight time pressure
}


def total_duration_seconds(beats: list[Beat], *, difficulty: str = "analyst") -> float:
    multiplier = DIFFICULTY_PACING.get(difficulty, 1.0)
    return sum(b.delay_before_seconds for b in beats) * multiplier
