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
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.services.scenario_service import ScenarioEngine
from app.store import STORE

app = FastAPI(title="AegisRange Phase 2 API", version="0.2.0")

telemetry_service = TelemetryService(STORE)
detection_service = DetectionService(telemetry_service)
identity_service = IdentityService(STORE)
document_service = DocumentService()
response_service = ResponseOrchestrator(STORE)
incident_service = IncidentService(STORE)
pipeline_service = EventPipelineService(
    telemetry=telemetry_service,
    detection=detection_service,
    response=response_service,
    incidents=incident_service,
    store=STORE,
)
scenario_engine = ScenarioEngine(
    identity=identity_service,
    documents=document_service,
    pipeline=pipeline_service,
    store=STORE,
)


class LoginRequest(BaseModel):
    username: str
    password: str


class ReadRequest(BaseModel):
    actor_id: str
    actor_role: str
    session_id: str | None = None


class AuthorizationCheckRequest(BaseModel):
    actor_id: str
    actor_role: str
    session_id: str
    route: str


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
        user_agent="phase2-client",
        origin="api",
        status="success" if result.success else "failure",
        status_code="200" if result.success else "401",
        error_message=result.reason,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={"username": payload.username, "authentication_method": "password"},
    )
    pipeline_service.process(event)

    return {
        "success": result.success,
        "actor_id": result.actor_id,
        "actor_role": result.actor_role,
        "session_id": result.session_id,
        "step_up_required": result.actor_id in STORE.step_up_required,
        "rate_limited": result.actor_id in STORE.rate_limited_actors,
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
        user_agent="phase2-client",
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
    pipeline_service.process(event)

    return {
        "allowed": allowed,
        "document_id": document.document_id,
        "classification": document.classification,
        "download_restricted": payload.actor_id in STORE.download_restricted_actors,
    }


@app.post("/session/authorize")
def session_authorize(
    payload: AuthorizationCheckRequest,
    request: Request,
    x_source_ip: str = Header(default="127.0.0.1"),
) -> dict[str, str | bool]:
    blocked = payload.session_id in STORE.revoked_sessions

    event = Event(
        event_type="authorization.check.failure" if blocked else "authorization.check.success",
        category="session",
        actor_id=payload.actor_id,
        actor_type="user",
        actor_role=payload.actor_role,
        target_type="session",
        target_id=payload.session_id,
        request_id=_request_id(),
        correlation_id=request.state.correlation_id,
        session_id=payload.session_id,
        source_ip=x_source_ip,
        user_agent="phase2-client",
        origin="api",
        status="failure" if blocked else "success",
        status_code="403" if blocked else "200",
        error_message="session_revoked" if blocked else None,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={"route": payload.route, "session_id": payload.session_id},
    )
    pipeline_service.process(event)

    return {"authorized": not blocked, "session_id": payload.session_id}


@app.post("/scenarios/scn-auth-001")
def run_scenario_auth_001(request: Request) -> dict[str, object]:
    return scenario_engine.run_auth_001(request.state.correlation_id)


@app.post("/scenarios/scn-session-002")
def run_scenario_session_002(request: Request) -> dict[str, object]:
    return scenario_engine.run_session_002(request.state.correlation_id)


@app.post("/scenarios/scn-doc-003")
def run_scenario_doc_003(request: Request) -> dict[str, object]:
    return scenario_engine.run_doc_003(request.state.correlation_id)


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


@app.get("/telemetry/events")
def get_events(correlation_id: str | None = None) -> dict[str, object]:
    events = telemetry_service.lookup_events(correlation_id=correlation_id)
    return {
        "total": len(events),
        "events": [
            {
                "event_id": event.event_id,
                "event_type": event.event_type,
                "category": event.category,
                "actor_id": event.actor_id,
                "correlation_id": event.correlation_id,
                "status": event.status,
            }
            for event in events
        ],
    }


@app.post("/admin/reset")
def admin_reset() -> dict[str, str]:
    STORE.reset()
    return {"status": "reset"}
