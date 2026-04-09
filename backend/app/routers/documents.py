"""Document access simulation routes."""
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


@router.post("/{document_id}/read", dependencies=[Depends(require_role("viewer"))])
def read_document(
    document_id: str,
    payload: ReadRequest,
    request: Request,
    x_source_ip: str = Header(default="127.0.0.1", description="Simulation metadata: source IP for the emulated actor"),
) -> dict:
    if payload.session_id and payload.session_id in STORE.revoked_sessions:
        raise HTTPException(status_code=401, detail="Session revoked")
    if payload.actor_id in STORE.step_up_required:
        raise HTTPException(status_code=403, detail="Step-up authentication required")

    allowed, document = document_service.can_read(payload.actor_role, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

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
        source_ip=x_source_ip,
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
        },
    )
    pipeline.process(event)

    return {"allowed": allowed, "document_id": document.document_id, "classification": document.classification}


@router.post("/{document_id}/download", dependencies=[Depends(require_role("viewer"))])
def download_document(
    document_id: str,
    payload: DownloadRequest,
    request: Request,
    x_source_ip: str = Header(default="127.0.0.1", description="Simulation metadata: source IP for the emulated actor"),
) -> dict:
    if payload.session_id and payload.session_id in STORE.revoked_sessions:
        raise HTTPException(status_code=401, detail="Session revoked")
    if payload.actor_id in STORE.step_up_required:
        raise HTTPException(status_code=403, detail="Step-up authentication required")

    allowed, document = document_service.can_download(payload.actor_role, document_id, actor_id=payload.actor_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

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
        source_ip=x_source_ip,
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
        },
    )
    pipeline.process(event)

    return {"allowed": allowed, "document_id": document.document_id, "classification": document.classification}
