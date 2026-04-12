"""Simulation identity routes (threat actor authentication).

These endpoints simulate threat-actor authentication within adversary
scenarios.  The ``actor_id`` / ``actor_role`` produced by the identity
service and the ``simulated_source_ip`` in the request body are
**simulation metadata** describing the emulated threat actor — they are
NOT the authenticated platform user.

The authenticated platform user is identified via the JWT bearer token
and recorded on every emitted event via ``platform_user_id``.
"""

from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from app.dependencies import identity_service, pipeline, require_role
from app.models import Confidence, Event, Severity
from app.schemas import IdentityLoginResponse, SessionRevokeResponse, SimulationLoginRequest

logger = logging.getLogger("aegisrange")
router = APIRouter(prefix="/identity", tags=["identity"])


def _request_id() -> str:
    return f"req-{uuid4()}"


def _client_ip(request: Request) -> str:
    """Derive the real client IP from the ASGI request."""
    return request.client.host if request.client else "127.0.0.1"


@router.post("/login", dependencies=[Depends(require_role("viewer"))], response_model=IdentityLoginResponse)
def login(
    payload: SimulationLoginRequest,
    request: Request,
) -> dict:
    platform_user = getattr(request.state, "platform_user", None)
    platform_user_id = platform_user.sub if platform_user else "unknown"

    result = identity_service.authenticate(payload.username, payload.password)
    event_type = (
        "authentication.login.success"
        if result.success
        else "authentication.login.failure"
    )

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
            "simulated_source_ip": payload.simulated_source_ip,
            "platform_user_id": platform_user_id,
        },
    )
    pipeline.process(event)

    return {
        "success": result.success,
        "actor_id": result.actor_id,
        "actor_role": result.actor_role,
        "session_id": result.session_id,
        "step_up_required": identity_service.is_step_up_required(result.actor_id),
    }


@router.post(
    "/sessions/{session_id}/revoke", dependencies=[Depends(require_role("analyst"))], response_model=SessionRevokeResponse
)
def revoke_session(session_id: str, request: Request) -> dict:
    if not identity_service.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    identity_service.revoke_session(session_id)
    actor_id = identity_service.find_actor_by_session(session_id)

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
