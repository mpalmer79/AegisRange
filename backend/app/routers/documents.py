"""Document access simulation routes.

These endpoints simulate document read/download within adversary
scenarios.  The ``actor_id``, ``actor_role``, and ``session_id`` in
the request body are **simulation metadata** describing the emulated
threat actor — they are NOT the authenticated platform user.

The authenticated platform user is identified via the JWT bearer token
and recorded on every emitted event via ``platform_user_id``.
"""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.dependencies import document_service, pipeline, require_role
from app.models import Confidence, Event, Severity
from app.schemas import DownloadRequest, ReadRequest
from app.store import STORE

router = APIRouter(prefix="/documents", tags=["documents"])


def _request_id() -> str:
    return f"req-{uuid4()}"


def _client_ip(request: Request) -> str:
    """Derive the real client IP from the ASGI request."""
    return request.client.host if request.client else "127.0.0.1"


@router.post("/{document_id}/read", dependencies=[Depends(require_role("viewer"))])
def read_document(
    document_id: str,
    payload: ReadRequest,
    request: Request,
    x_source_ip: str = Header(
        default="127.0.0.1",
        description="Simulation metadata: fictional source IP for the emulated actor. "
        "NOT used as the real source_ip — that is derived from the TCP connection.",
    ),
) -> dict:
    if payload.session_id and payload.session_id in STORE.revoked_sessions:
        raise HTTPException(status_code=401, detail="Session revoked")
    if payload.actor_id in STORE.step_up_required:
        raise HTTPException(status_code=403, detail="Step-up authentication required")

    allowed, document = document_service.can_read(payload.actor_role, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    platform_user = getattr(request.state, "platform_user", None)
    platform_user_id = platform_user.sub if platform_user else "unknown"

    event = Event(
        event_type="document.read.success" if allowed else "document.read.failure",
        category="document",
        actor_id=payload.actor_id,
        actor_type="user",
        actor_role=payload.actor_role,
        target_type="document",
        target_id=document_id,
        request_id=_request_id(),
        correlation_id=request.state.correlation_id,
        session_id=payload.session_id,
        source_ip=_client_ip(request),
        user_agent="phase1-client",
        origin="api",
        status="success" if allowed else "failure",
        status_code="200" if allowed else "403",
        error_message=None if allowed else "classification_mismatch",
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={
            "document_id": document.document_id,
            "classification": document.classification,
            "simulated_source_ip": x_source_ip,
            "platform_user_id": platform_user_id,
        },
    )
    pipeline.process(event)

    return {"allowed": allowed, "document_id": document.document_id, "classification": document.classification}


@router.post("/{document_id}/download", dependencies=[Depends(require_role("viewer"))])
def download_document(
    document_id: str,
    payload: DownloadRequest,
    request: Request,
    x_source_ip: str = Header(
        default="127.0.0.1",
        description="Simulation metadata: fictional source IP for the emulated actor. "
        "NOT used as the real source_ip — that is derived from the TCP connection.",
    ),
) -> dict:
    if payload.session_id and payload.session_id in STORE.revoked_sessions:
        raise HTTPException(status_code=401, detail="Session revoked")
    if payload.actor_id in STORE.step_up_required:
        raise HTTPException(status_code=403, detail="Step-up authentication required")

    allowed, document = document_service.can_download(payload.actor_role, document_id, actor_id=payload.actor_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    platform_user = getattr(request.state, "platform_user", None)
    platform_user_id = platform_user.sub if platform_user else "unknown"

    event = Event(
        event_type="document.download.success" if allowed else "document.download.failure",
        category="document",
        actor_id=payload.actor_id,
        actor_type="user",
        actor_role=payload.actor_role,
        target_type="document",
        target_id=document_id,
        request_id=_request_id(),
        correlation_id=request.state.correlation_id,
        session_id=payload.session_id,
        source_ip=_client_ip(request),
        user_agent="phase1-client",
        origin="api",
        status="success" if allowed else "failure",
        status_code="200" if allowed else "403",
        error_message=None if allowed else "download_restricted",
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={
            "document_id": document.document_id,
            "classification": document.classification,
            "simulated_source_ip": x_source_ip,
            "platform_user_id": platform_user_id,
        },
    )
    pipeline.process(event)

    return {"allowed": allowed, "document_id": document.document_id, "classification": document.classification}
