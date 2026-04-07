from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel

from app.models import Confidence, Event, Severity
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.response_service import ResponseOrchestrator
from app.store import STORE

app = FastAPI(title="AegisRange Phase 1 API", version="0.1.0")

telemetry_service = TelemetryService(STORE)
detection_service = DetectionService(telemetry_service)
identity_service = IdentityService(STORE)
document_service = DocumentService()
response_service = ResponseOrchestrator(STORE)
incident_service = IncidentService(STORE)


class LoginRequest(BaseModel):
    username: str
    password: str


class ReadRequest(BaseModel):
    actor_id: str
    actor_role: str
    session_id: str | None = None


def _emit_and_process(event: Event) -> None:
    telemetry_service.emit(event)
    incident_service.register_event(event)

    alerts = detection_service.evaluate(event)
    if not alerts:
        return

    STORE.alerts.extend(alerts)
    for alert in alerts:
        incident = incident_service.register_alert(alert, source_event=event)
        for response in response_service.execute(alert):
            incident_service.register_response(incident, response)


def _request_id() -> str:
    return f"req-{uuid4()}"


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    correlation_id = request.headers.get("x-correlation-id") or f"corr-{uuid4()}"
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/identity/login")
def login(payload: LoginRequest, request: Request, x_source_ip: str = Header(default="127.0.0.1")) -> dict[str, str | bool | None]:
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
        source_ip=x_source_ip,
        user_agent="phase1-client",
        origin="api",
        status="success" if result.success else "failure",
        status_code="200" if result.success else "401",
        error_message=result.reason,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={"username": payload.username, "authentication_method": "password"},
    )
    _emit_and_process(event)

    return {
        "success": result.success,
        "actor_id": result.actor_id,
        "actor_role": result.actor_role,
        "session_id": result.session_id,
        "step_up_required": result.actor_id in STORE.step_up_required,
    }


@app.post("/documents/{document_id}/read")
def read_document(document_id: str, payload: ReadRequest, request: Request, x_source_ip: str = Header(default="127.0.0.1")) -> dict[str, str | bool]:
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
    _emit_and_process(event)

    return {"allowed": allowed, "document_id": document.document_id, "classification": document.classification}


@app.post("/scenarios/scn-auth-001")
def run_scenario_auth_001(request: Request) -> dict[str, object]:
    """Credential Abuse with Suspicious Success: 4 failures then success."""
    correlation_id = request.state.correlation_id

    for _ in range(4):
        identity_service.authenticate("alice", "wrong")
        failure = Event(
            event_type="authentication.login.failure",
            category="authentication",
            actor_id="user-alice",
            actor_type="user",
            actor_role="analyst",
            target_type="identity",
            target_id="alice",
            request_id=_request_id(),
            correlation_id=correlation_id,
            source_ip="203.0.113.10",
            user_agent="scenario-engine",
            origin="internal",
            status="failure",
            status_code="401",
            error_message="invalid_credentials",
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.LOW,
            payload={"username": "alice", "authentication_method": "password"},
        )
        _emit_and_process(failure)

    success_result = identity_service.authenticate("alice", "correct-horse")
    success_event = Event(
        event_type="authentication.login.success",
        category="authentication",
        actor_id=success_result.actor_id,
        actor_type="user",
        actor_role=success_result.actor_role,
        target_type="identity",
        target_id="alice",
        request_id=_request_id(),
        correlation_id=correlation_id,
        session_id=success_result.session_id,
        source_ip="203.0.113.10",
        user_agent="scenario-engine",
        origin="internal",
        status="success",
        status_code="200",
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={"username": "alice", "authentication_method": "password"},
    )
    _emit_and_process(success_event)

    incident = STORE.incidents_by_correlation.get(correlation_id)

    return {
        "scenario_id": "SCN-AUTH-001",
        "correlation_id": correlation_id,
        "events_total": len([e for e in STORE.events if e.correlation_id == correlation_id]),
        "alerts_total": len([a for a in STORE.alerts if a.correlation_id == correlation_id]),
        "responses_total": len([r for r in STORE.responses if r.correlation_id == correlation_id]),
        "incident_id": incident.incident_id if incident else None,
        "step_up_required": "user-alice" in STORE.step_up_required,
    }


@app.get("/incidents/{correlation_id}")
def get_incident(correlation_id: str) -> dict[str, object]:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    return {
        "incident_id": incident.incident_id,
        "status": incident.status,
        "severity": incident.severity,
        "confidence": incident.confidence,
        "detection_ids": incident.detection_ids,
        "response_ids": incident.response_ids,
        "containment_status": incident.containment_status,
        "event_ids": incident.event_ids,
        "timeline": [entry.__dict__ for entry in incident.timeline],
    }


@app.post("/admin/reset")
def admin_reset() -> dict[str, str]:
    STORE.reset()
    return {"status": "reset"}
