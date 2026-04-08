from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Query, Request
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

app = FastAPI(title="AegisRange Phase 1 API", version="0.2.0")

# --- Service wiring ---
telemetry_service = TelemetryService(STORE)
detection_service = DetectionService(telemetry_service)
identity_service = IdentityService(STORE)
document_service = DocumentService(store=STORE)
response_service = ResponseOrchestrator(STORE)
incident_service = IncidentService(STORE)

pipeline = EventPipelineService(
    telemetry=telemetry_service,
    detection=detection_service,
    response=response_service,
    incidents=incident_service,
    store=STORE,
)

scenario_engine = ScenarioEngine(
    identity=identity_service,
    documents=document_service,
    pipeline=pipeline,
    store=STORE,
)


# --- Request / Response models ---

class LoginRequest(BaseModel):
    username: str
    password: str


class ReadRequest(BaseModel):
    actor_id: str
    actor_role: str
    session_id: str | None = None


class DownloadRequest(BaseModel):
    actor_id: str
    actor_role: str
    session_id: str | None = None


class IncidentStatusUpdate(BaseModel):
    status: str


# --- Helpers ---

def _request_id() -> str:
    return f"req-{uuid4()}"


# --- Middleware ---

@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    correlation_id = request.headers.get("x-correlation-id") or f"corr-{uuid4()}"
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    return response


# --- Health ---

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# --- Identity ---

@app.post("/identity/login")
def login(payload: LoginRequest, request: Request, x_source_ip: str = Header(default="127.0.0.1")) -> dict:
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
    pipeline.process(event)

    return {
        "success": result.success,
        "actor_id": result.actor_id,
        "actor_role": result.actor_role,
        "session_id": result.session_id,
        "step_up_required": result.actor_id in STORE.step_up_required,
    }


@app.post("/identity/sessions/{session_id}/revoke")
def revoke_session(session_id: str, request: Request) -> dict:
    if session_id not in STORE.actor_sessions.values():
        raise HTTPException(status_code=404, detail="Session not found")
    STORE.revoked_sessions.add(session_id)
    actor_id = next((a for a, s in STORE.actor_sessions.items() if s == session_id), None)

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
            source_ip="127.0.0.1",
            user_agent="admin",
            origin="api",
            status="success",
            status_code="200",
            severity=Severity.MEDIUM,
            confidence=Confidence.HIGH,
            payload={"session_id": session_id, "session_state": "revoked"},
        )
        pipeline.process(event)

    return {"status": "revoked", "session_id": session_id}


# --- Documents ---

@app.post("/documents/{document_id}/read")
def read_document(document_id: str, payload: ReadRequest, request: Request, x_source_ip: str = Header(default="127.0.0.1")) -> dict:
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


@app.post("/documents/{document_id}/download")
def download_document(document_id: str, payload: DownloadRequest, request: Request, x_source_ip: str = Header(default="127.0.0.1")) -> dict:
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


# --- Scenarios ---

@app.post("/scenarios/scn-auth-001")
def run_scenario_auth_001(request: Request) -> dict:
    """SCN-AUTH-001: Credential Abuse with Suspicious Success."""
    return scenario_engine.run_auth_001(request.state.correlation_id)


@app.post("/scenarios/scn-session-002")
def run_scenario_session_002(request: Request) -> dict:
    """SCN-SESSION-002: Session Token Reuse Attack."""
    return scenario_engine.run_session_002(request.state.correlation_id)


@app.post("/scenarios/scn-doc-003")
def run_scenario_doc_003(request: Request) -> dict:
    """SCN-DOC-003: Bulk Document Access."""
    return scenario_engine.run_doc_003(request.state.correlation_id)


@app.post("/scenarios/scn-doc-004")
def run_scenario_doc_004(request: Request) -> dict:
    """SCN-DOC-004: Read-To-Download Exfiltration Pattern."""
    return scenario_engine.run_doc_004(request.state.correlation_id)


# --- Events ---

@app.get("/events")
def list_events(
    actor_id: str | None = Query(default=None),
    correlation_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    since_minutes: int | None = Query(default=None),
) -> list[dict]:
    event_types = {event_type} if event_type else None
    events = telemetry_service.lookup_events(
        actor_id=actor_id,
        correlation_id=correlation_id,
        event_types=event_types,
        since_minutes=since_minutes,
    )
    return [_event_to_dict(e) for e in events]


# --- Alerts ---

@app.get("/alerts")
def list_alerts(
    actor_id: str | None = Query(default=None),
    correlation_id: str | None = Query(default=None),
    rule_id: str | None = Query(default=None),
) -> list[dict]:
    alerts = STORE.alerts
    if actor_id:
        alerts = [a for a in alerts if a.actor_id == actor_id]
    if correlation_id:
        alerts = [a for a in alerts if a.correlation_id == correlation_id]
    if rule_id:
        alerts = [a for a in alerts if a.rule_id == rule_id]
    return [_alert_to_dict(a) for a in alerts]


# --- Incidents ---

@app.get("/incidents")
def list_incidents() -> list[dict]:
    return [_incident_to_dict(inc) for inc in STORE.incidents_by_correlation.values()]


@app.get("/incidents/{correlation_id}")
def get_incident(correlation_id: str) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _incident_to_dict(incident)


@app.patch("/incidents/{correlation_id}/status")
def update_incident_status(correlation_id: str, payload: IncidentStatusUpdate) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    valid_transitions = {
        "open": {"investigating", "contained", "resolved"},
        "investigating": {"contained", "resolved"},
        "contained": {"resolved"},
        "resolved": {"closed"},
    }
    allowed = valid_transitions.get(incident.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{incident.status}' to '{payload.status}'. Allowed: {sorted(allowed)}",
        )

    old_status = incident.status
    incident.status = payload.status
    if payload.status == "closed":
        incident.closed_at = datetime.utcnow()
    if payload.status == "contained":
        incident.containment_status = "full"

    incident.add_timeline_entry(
        entry_type="state_transition",
        reference_id=incident.incident_id,
        summary=f"Status changed from {old_status} to {payload.status}.",
    )

    return _incident_to_dict(incident)


# --- Admin ---

@app.post("/admin/reset")
def admin_reset() -> dict[str, str]:
    STORE.reset()
    return {"status": "reset"}


# --- Serialization helpers ---

def _event_to_dict(event: Event) -> dict:
    return {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "category": event.category,
        "timestamp": event.timestamp.isoformat(),
        "actor_id": event.actor_id,
        "actor_type": event.actor_type,
        "actor_role": event.actor_role,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "request_id": event.request_id,
        "correlation_id": event.correlation_id,
        "session_id": event.session_id,
        "source_ip": event.source_ip,
        "user_agent": event.user_agent,
        "origin": event.origin,
        "status": event.status,
        "status_code": event.status_code,
        "error_message": event.error_message,
        "severity": event.severity.value,
        "confidence": event.confidence.value,
        "risk_score": event.risk_score,
        "payload": event.payload,
    }


def _alert_to_dict(alert) -> dict:
    return {
        "alert_id": alert.alert_id,
        "rule_id": alert.rule_id,
        "rule_name": alert.rule_name,
        "severity": alert.severity.value,
        "confidence": alert.confidence.value,
        "actor_id": alert.actor_id,
        "correlation_id": alert.correlation_id,
        "contributing_event_ids": alert.contributing_event_ids,
        "summary": alert.summary,
        "payload": alert.payload,
        "created_at": alert.created_at.isoformat(),
    }


def _incident_to_dict(incident) -> dict:
    return {
        "incident_id": incident.incident_id,
        "incident_type": incident.incident_type,
        "status": incident.status,
        "primary_actor_id": incident.primary_actor_id,
        "actor_type": incident.actor_type,
        "actor_role": incident.actor_role,
        "correlation_id": incident.correlation_id,
        "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
        "confidence": incident.confidence.value if hasattr(incident.confidence, "value") else incident.confidence,
        "risk_score": incident.risk_score,
        "detection_ids": incident.detection_ids,
        "detection_summary": incident.detection_summary,
        "response_ids": incident.response_ids,
        "containment_status": incident.containment_status,
        "event_ids": incident.event_ids,
        "affected_documents": incident.affected_documents,
        "affected_sessions": incident.affected_sessions,
        "affected_services": incident.affected_services,
        "timeline": [
            {
                "timestamp": entry.timestamp.isoformat(),
                "entry_type": entry.entry_type,
                "reference_id": entry.reference_id,
                "summary": entry.summary,
            }
            for entry in incident.timeline
        ],
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "closed_at": incident.closed_at.isoformat() if incident.closed_at else None,
    }
