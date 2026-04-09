"""Simulation identity routes (threat actor authentication).

These endpoints simulate threat-actor authentication within adversary
scenarios.  The ``actor_id`` / ``actor_role`` in the request body and
the ``x_source_ip`` header are **simulation metadata** describing the
emulated threat actor — they are NOT the authenticated platform user.

The authenticated platform user is identified via the JWT bearer token
and recorded on every emitted event via ``platform_user_id``.
"""
from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.dependencies import identity_service, pipeline, require_role
from app.models import Confidence, Event, Severity
from app.schemas import LoginRequest
from app.store import STORE

logger = logging.getLogger("aegisrange")
router = APIRouter(prefix="/identity", tags=["identity"])


def _request_id() -> str:
    return f"req-{uuid4()}"


def _client_ip(request: Request) -> str:
    """Derive the real client IP from the ASGI request."""
    return request.client.host if request.client else "127.0.0.1"


@router.post("/login", dependencies=[Depends(require_role("viewer"))])
def login(
    payload: LoginRequest,
    request: Request,
    x_source_ip: str = Header(
        default="127.0.0.1",
        description="Simulation metadata: fictional source IP for the emulated actor. "
        "NOT used as the real source_ip — that is derived from the TCP connection.",
    ),
) -> dict:
    platform_user = getattr(request.state, "platform_user", None)
    platform_user_id = platform_user.sub if platform_user else "unknown"

    result = identity_service.authenticate(payload.username, payload.password)
    event_type = "authentication.login.success" if result.success else "authentication.login.failure"

    event = Event(
        event_type=event_type,
        category="authentication",
        actor_id=result.actor_id,
        actor_type="user",
        actor_role=result.actor_role,
        target_type="identity",
        target_id=payload.username,
        request_id=_request_id(),
        correlation_id=request.state.correlation_id,
        session_id=result.session_id,
        source_ip=_client_ip(request),
        user_agent="phase1-client",
        origin="api",
        status="success" if result.success else "failure",
        status_code="200" if result.success else "401",
        error_message=result.reason,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={
            "username": payload.username,
            "authentication_method": "password",
            "simulated_source_ip": x_source_ip,
            "platform_user_id": platform_user_id,
        },
    )
    pipeline.process(event)

    return {
        "success": result.success,
        "actor_id": result.actor_id,
        "actor_role": result.actor_role,
        "session_id": result.session_id,
        "step_up_required": result.actor_id in STORE.step_up_required,
    }


@router.post("/sessions/{session_id}/revoke", dependencies=[Depends(require_role("analyst"))])
def revoke_session(session_id: str, request: Request) -> dict:
    if session_id not in STORE.actor_sessions.values():
        raise HTTPException(status_code=404, detail="Session not found")
    STORE.revoke_session(session_id)
    actor_id = next((a for a, s in STORE.actor_sessions.items() if s == session_id), None)

    platform_user = getattr(request.state, "platform_user", None)
    platform_user_id = platform_user.sub if platform_user else "unknown"

    if actor_id:
        event = Event(
            event_type="session.token.revoked",
            category="session",
            actor_id=actor_id,
            actor_type="user",
            target_type="session",
            target_id=session_id,
            request_id=_request_id(),
            correlation_id=request.state.correlation_id,
            source_ip=_client_ip(request),
            user_agent="admin",
            origin="api",
            status="success",
            status_code="200",
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
            payload={
                "session_id": session_id,
                "session_state": "revoked",
                "platform_user_id": platform_user_id,
            },
        )
        pipeline.process(event)

    return {"status": "revoked", "session_id": session_id}
