"""Beat handlers — the logic that realises each :class:`BeatKind` against
a :class:`ScriptContext`. Handlers mutate the world through the
pipeline; detection, response, and incident creation flow through
exactly as they did for the legacy synchronous engine.
"""

from __future__ import annotations

from typing import Any

from .base import Beat, BeatKind, ScriptContext, _new_event


def apply_beat(beat: Beat, ctx: ScriptContext) -> None:
    """Realise a beat against the context."""
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
