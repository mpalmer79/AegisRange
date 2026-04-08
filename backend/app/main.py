from __future__ import annotations

import logging
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.logging_config import setup_logging
from app.models import Confidence, Event, Severity
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.services.risk_service import RiskScoringService
from app.services.scenario_service import ScenarioEngine
from app.services.mitre_service import MitreAttackService
from app.services.killchain_service import KillChainService
from app.services.campaign_service import CampaignDetectionService
from app.services.auth_service import AuthService, require_role
from app.services.report_service import ReportService
from app.services.stream_service import StreamService
from app.store import STORE

setup_logging(settings.LOG_LEVEL, settings.LOG_FORMAT)
logger = logging.getLogger("aegisrange")

app = FastAPI(title="AegisRange API", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Service wiring ---
telemetry_service = TelemetryService(STORE)
detection_service = DetectionService(telemetry_service)
identity_service = IdentityService(STORE)
document_service = DocumentService(store=STORE)
response_service = ResponseOrchestrator(STORE)
incident_service = IncidentService(STORE)
risk_service = RiskScoringService(STORE)

pipeline = EventPipelineService(
    telemetry=telemetry_service,
    detection=detection_service,
    response=response_service,
    incidents=incident_service,
    risk=risk_service,
    store=STORE,
)

scenario_engine = ScenarioEngine(
    identity=identity_service,
    documents=document_service,
    pipeline=pipeline,
    store=STORE,
)

mitre_service = MitreAttackService()
killchain_service = KillChainService(STORE)
campaign_detection_service = CampaignDetectionService(STORE)
auth_service = AuthService()
report_service = ReportService(STORE)
stream_service = StreamService(STORE)


@app.on_event("startup")
def on_startup():
    if settings.APP_ENV != "test":
        STORE.enable_persistence()
        logger.info("SQLite persistence enabled", extra={"env": settings.APP_ENV})
    logger.info("AegisRange API started", extra={"env": settings.APP_ENV})


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


class IncidentNote(BaseModel):
    author: str
    content: str


class PlatformLoginRequest(BaseModel):
    username: str
    password: str


class ReportRequest(BaseModel):
    title: str = "AegisRange Exercise Report"


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
    # Auto-save to SQLite after mutating requests
    if request.method in ("POST", "PATCH", "DELETE") and response.status_code < 400:
        STORE.save()
    return response


# --- Health ---

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# --- Metrics ---

@app.get("/metrics", dependencies=[Depends(require_role("viewer"))])
def get_metrics() -> dict:
    # Aggregate events by category
    events_by_category: dict[str, int] = {}
    for e in STORE.events:
        events_by_category[e.category] = events_by_category.get(e.category, 0) + 1

    # Aggregate alerts by severity
    alerts_by_severity: dict[str, int] = {}
    for a in STORE.alerts:
        sev = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        alerts_by_severity[sev] = alerts_by_severity.get(sev, 0) + 1

    # Aggregate incidents by status
    incidents_by_status: dict[str, int] = {}
    for inc in STORE.incidents_by_correlation.values():
        incidents_by_status[inc.status] = incidents_by_status.get(inc.status, 0) + 1

    active_containments = (
        len(STORE.step_up_required)
        + len(STORE.revoked_sessions)
        + len(STORE.download_restricted_actors)
        + len(STORE.disabled_services)
        + len(STORE.quarantined_artifacts)
    )

    return {
        "total_events": len(STORE.events),
        "total_alerts": len(STORE.alerts),
        "total_responses": len(STORE.responses),
        "total_incidents": len(STORE.incidents_by_correlation),
        "active_containments": active_containments,
        "events_by_category": events_by_category,
        "alerts_by_severity": alerts_by_severity,
        "incidents_by_status": incidents_by_status,
    }


# --- Identity ---

@app.post("/identity/login", dependencies=[Depends(require_role("viewer"))])
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


@app.post("/identity/sessions/{session_id}/revoke", dependencies=[Depends(require_role("analyst"))])
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

@app.post("/documents/{document_id}/read", dependencies=[Depends(require_role("viewer"))])
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


@app.post("/documents/{document_id}/download", dependencies=[Depends(require_role("viewer"))])
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

@app.post("/scenarios/scn-auth-001", dependencies=[Depends(require_role("red_team"))])
def run_scenario_auth_001(request: Request) -> dict:
    """SCN-AUTH-001: Credential Abuse with Suspicious Success."""
    logger.info("Scenario execution started", extra={"scenario": "scn-auth-001", "correlation_id": request.state.correlation_id})
    return scenario_engine.run_auth_001(request.state.correlation_id)


@app.post("/scenarios/scn-session-002", dependencies=[Depends(require_role("red_team"))])
def run_scenario_session_002(request: Request) -> dict:
    """SCN-SESSION-002: Session Token Reuse Attack."""
    logger.info("Scenario execution started", extra={"scenario": "scn-session-002", "correlation_id": request.state.correlation_id})
    return scenario_engine.run_session_002(request.state.correlation_id)


@app.post("/scenarios/scn-doc-003", dependencies=[Depends(require_role("red_team"))])
def run_scenario_doc_003(request: Request) -> dict:
    """SCN-DOC-003: Bulk Document Access."""
    logger.info("Scenario execution started", extra={"scenario": "scn-doc-003", "correlation_id": request.state.correlation_id})
    return scenario_engine.run_doc_003(request.state.correlation_id)


@app.post("/scenarios/scn-doc-004", dependencies=[Depends(require_role("red_team"))])
def run_scenario_doc_004(request: Request) -> dict:
    """SCN-DOC-004: Read-To-Download Exfiltration Pattern."""
    logger.info("Scenario execution started", extra={"scenario": "scn-doc-004", "correlation_id": request.state.correlation_id})
    return scenario_engine.run_doc_004(request.state.correlation_id)


@app.post("/scenarios/scn-svc-005", dependencies=[Depends(require_role("red_team"))])
def run_scenario_svc_005(request: Request) -> dict:
    """SCN-SVC-005: Unauthorized Service Access."""
    logger.info("Scenario execution started", extra={"scenario": "scn-svc-005", "correlation_id": request.state.correlation_id})
    return scenario_engine.run_svc_005(request.state.correlation_id)


@app.post("/scenarios/scn-corr-006", dependencies=[Depends(require_role("red_team"))])
def run_scenario_corr_006(request: Request) -> dict:
    """SCN-CORR-006: Multi-Signal Compromise Sequence."""
    logger.info("Scenario execution started", extra={"scenario": "scn-corr-006", "correlation_id": request.state.correlation_id})
    return scenario_engine.run_corr_006(request.state.correlation_id)


# --- Events ---

@app.get("/events", dependencies=[Depends(require_role("viewer"))])
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

@app.get("/alerts", dependencies=[Depends(require_role("viewer"))])
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

@app.get("/incidents", dependencies=[Depends(require_role("viewer"))])
def list_incidents() -> list[dict]:
    return [_incident_to_dict(inc) for inc in STORE.incidents_by_correlation.values()]


@app.get("/incidents/{correlation_id}", dependencies=[Depends(require_role("viewer"))])
def get_incident(correlation_id: str) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _incident_to_dict(incident)


@app.patch("/incidents/{correlation_id}/status", dependencies=[Depends(require_role("analyst"))])
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
    logger.info("Incident status update", extra={"correlation_id": correlation_id, "from": old_status, "to": payload.status})
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


# --- Analytics ---

@app.get("/analytics/risk-profiles", dependencies=[Depends(require_role("analyst"))])
def get_risk_profiles() -> list[dict]:
    profiles = risk_service.get_all_profiles()
    return [
        {
            "actor_id": p.actor_id,
            "current_score": p.current_score,
            "peak_score": p.peak_score,
            "contributing_rules": p.contributing_rules,
            "score_history": p.score_history,
            "last_updated": p.last_updated.isoformat(),
        }
        for p in profiles
    ]


@app.get("/analytics/risk-profiles/{actor_id}", dependencies=[Depends(require_role("analyst"))])
def get_risk_profile(actor_id: str) -> dict:
    profile = risk_service.get_profile(actor_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Risk profile not found")
    return {
        "actor_id": profile.actor_id,
        "current_score": profile.current_score,
        "peak_score": profile.peak_score,
        "contributing_rules": profile.contributing_rules,
        "score_history": profile.score_history,
        "last_updated": profile.last_updated.isoformat(),
    }


@app.get("/analytics/rule-effectiveness", dependencies=[Depends(require_role("analyst"))])
def get_rule_effectiveness() -> list[dict]:
    rule_counts: dict[str, dict] = {}
    for alert in STORE.alerts:
        if alert.rule_id not in rule_counts:
            rule_counts[alert.rule_id] = {
                "rule_id": alert.rule_id,
                "rule_name": alert.rule_name,
                "trigger_count": 0,
                "severity": alert.severity.value,
                "actors_affected": set(),
            }
        rule_counts[alert.rule_id]["trigger_count"] += 1
        rule_counts[alert.rule_id]["actors_affected"].add(alert.actor_id)

    return [
        {**v, "actors_affected": len(v["actors_affected"])}
        for v in sorted(rule_counts.values(), key=lambda x: x["trigger_count"], reverse=True)
    ]


@app.get("/analytics/scenario-history", dependencies=[Depends(require_role("analyst"))])
def get_scenario_history() -> list[dict]:
    return STORE.scenario_history


# --- Incident Notes ---

@app.post("/incidents/{correlation_id}/notes", dependencies=[Depends(require_role("analyst"))])
def add_incident_note(correlation_id: str, note: IncidentNote) -> dict:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    entry = {
        "note_id": f"note-{uuid4()}",
        "author": note.author,
        "content": note.content,
        "created_at": datetime.utcnow().isoformat(),
    }
    STORE.incident_notes[correlation_id].append(entry)
    incident.add_timeline_entry(
        entry_type="analyst_note",
        reference_id=entry["note_id"],
        summary=f"Note by {note.author}: {note.content[:80]}",
    )
    return entry


@app.get("/incidents/{correlation_id}/notes", dependencies=[Depends(require_role("viewer"))])
def get_incident_notes(correlation_id: str) -> list[dict]:
    incident = STORE.incidents_by_correlation.get(correlation_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return STORE.incident_notes.get(correlation_id, [])


# --- Events Export ---

@app.get("/events/export", dependencies=[Depends(require_role("viewer"))])
def export_events(
    correlation_id: str | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    since_minutes: int | None = Query(default=None),
) -> dict:
    events = telemetry_service.lookup_events(
        actor_id=actor_id,
        correlation_id=correlation_id,
        since_minutes=since_minutes,
    )
    return {
        "export_timestamp": datetime.utcnow().isoformat(),
        "total_events": len(events),
        "events": [_event_to_dict(e) for e in events],
    }


# --- Admin ---

@app.post("/admin/reset", dependencies=[Depends(require_role("admin"))])
def admin_reset() -> dict[str, str]:
    STORE.reset()
    return {"status": "reset"}


# --- MITRE ATT&CK ---

@app.get("/mitre/mappings", dependencies=[Depends(require_role("viewer"))])
def get_mitre_mappings() -> list[dict]:
    mappings = mitre_service.get_all_mappings()
    return [
        {
            "rule_id": m.rule_id,
            "technique_ids": m.technique_ids,
            "tactic_ids": m.tactic_ids,
            "kill_chain_phases": m.kill_chain_phases,
        }
        for m in mappings
    ]


@app.get("/mitre/mappings/{rule_id}", dependencies=[Depends(require_role("viewer"))])
def get_mitre_mapping(rule_id: str) -> dict:
    mapping = mitre_service.get_mapping(rule_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {
        "rule_id": mapping.rule_id,
        "technique_ids": mapping.technique_ids,
        "tactic_ids": mapping.tactic_ids,
        "kill_chain_phases": mapping.kill_chain_phases,
    }


@app.get("/mitre/coverage", dependencies=[Depends(require_role("viewer"))])
def get_mitre_coverage() -> list[dict]:
    entries = mitre_service.get_coverage_matrix()
    return [
        {
            "tactic_id": e.tactic_id,
            "technique_id": e.technique_id,
            "technique_name": next(
                (t.name for t in mitre_service._techniques.values() if t.id == e.technique_id),
                e.technique_id,
            ),
            "rule_ids": e.rule_ids,
            "scenario_ids": e.scenario_ids,
            "covered": e.covered,
        }
        for e in entries
    ]


@app.get("/mitre/tactics/coverage", dependencies=[Depends(require_role("viewer"))])
def get_mitre_tactic_coverage() -> list[dict]:
    coverage = mitre_service.get_tactic_coverage()
    return [
        {
            "tactic_id": tactic_id,
            "tactic_name": data["name"],
            "covered_techniques": data["covered_techniques"],
            "total_techniques": data["total_techniques"],
            "percentage": data["percentage"],
        }
        for tactic_id, data in coverage.items()
    ]


@app.get("/mitre/scenarios/{scenario_id}/ttps", dependencies=[Depends(require_role("viewer"))])
def get_mitre_scenario_ttps(scenario_id: str) -> list[dict]:
    techniques = mitre_service.get_scenario_ttps(scenario_id)
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "tactic_ids": t.tactic_ids,
            "url": t.url,
        }
        for t in techniques
    ]


# --- Kill Chain ---

@app.get("/killchain", dependencies=[Depends(require_role("viewer"))])
def get_all_killchain_analyses() -> list[dict]:
    analyses = killchain_service.analyze_all_incidents()
    return [killchain_service.to_dict(a) for a in analyses]


@app.get("/killchain/{correlation_id}", dependencies=[Depends(require_role("viewer"))])
def get_killchain_analysis(correlation_id: str) -> dict:
    analysis = killchain_service.analyze_incident(correlation_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return killchain_service.to_dict(analysis)


# --- Campaigns ---

@app.get("/campaigns", dependencies=[Depends(require_role("viewer"))])
def get_campaigns() -> list[dict]:
    campaigns = campaign_detection_service.detect_campaigns()
    return [campaign_detection_service.to_dict(c) for c in campaigns]


@app.get("/campaigns/{campaign_id}", dependencies=[Depends(require_role("viewer"))])
def get_campaign(campaign_id: str) -> dict:
    campaign = campaign_detection_service.get_campaign(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign_detection_service.to_dict(campaign)


# --- Platform Auth ---

@app.post("/auth/login")
def platform_login(payload: PlatformLoginRequest) -> dict:
    success, token = auth_service.authenticate(payload.username, payload.password)
    if not success or token is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = auth_service.get_user(payload.username)
    return {
        "token": token,
        "username": payload.username,
        "role": user.role if user else "unknown",
        "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
    }


@app.get("/auth/users", dependencies=[Depends(require_role("admin"))])
def list_platform_users() -> list[dict]:
    users = auth_service.list_users()
    return [
        {
            "user_id": u.user_id,
            "username": u.username,
            "role": u.role,
            "display_name": u.display_name,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


# --- Exercise Reports ---

@app.post("/reports/generate", dependencies=[Depends(require_role("analyst"))])
def generate_exercise_report(payload: ReportRequest | None = None) -> dict:
    title = payload.title if payload else "AegisRange Exercise Report"
    report = report_service.generate_report(title)
    return report_service.to_dict(report)


# --- Real-Time Streaming ---

@app.get("/stream/events", dependencies=[Depends(require_role("viewer"))])
async def stream_events() -> StreamingResponse:
    queue = stream_service.subscribe()
    return StreamingResponse(
        stream_service.event_generator(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    ts = alert.created_at.isoformat()
    return {
        "alert_id": alert.alert_id,
        "rule_id": alert.rule_id,
        "rule_name": alert.rule_name,
        "severity": alert.severity.value,
        "confidence": alert.confidence.value,
        "actor_id": alert.actor_id,
        "correlation_id": alert.correlation_id,
        "contributing_event_ids": alert.contributing_event_ids,
        "event_ids": alert.contributing_event_ids,
        "summary": alert.summary,
        "payload": alert.payload,
        "details": alert.payload,
        "created_at": ts,
        "timestamp": ts,
    }


def _incident_to_dict(incident) -> dict:
    return {
        "incident_id": incident.incident_id,
        "incident_type": incident.incident_type,
        "status": incident.status,
        "primary_actor_id": incident.primary_actor_id,
        "primary_actor": incident.primary_actor_id,
        "actor_type": incident.actor_type,
        "actor_role": incident.actor_role,
        "correlation_id": incident.correlation_id,
        "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
        "confidence": incident.confidence.value if hasattr(incident.confidence, "value") else incident.confidence,
        "risk_score": incident.risk_score,
        "detection_ids": incident.detection_ids,
        "detection_summary": incident.detection_summary,
        "detection_summaries": incident.detection_summary,
        "response_ids": incident.response_ids,
        "containment_status": incident.containment_status,
        "event_ids": incident.event_ids,
        "affected_documents": incident.affected_documents,
        "affected_sessions": incident.affected_sessions,
        "affected_services": incident.affected_services,
        "affected_resources": {
            "documents": incident.affected_documents,
            "sessions": incident.affected_sessions,
            "services": incident.affected_services,
            "actors": [incident.primary_actor_id] if incident.primary_actor_id else [],
        },
        "timeline": [
            {
                "timestamp": entry.timestamp.isoformat(),
                "entry_type": entry.entry_type,
                "reference_id": entry.reference_id,
                "entry_id": entry.reference_id,
                "summary": entry.summary,
            }
            for entry in incident.timeline
        ],
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "notes": [n for n in STORE.incident_notes.get(incident.correlation_id, [])],
        "closed_at": incident.closed_at.isoformat() if incident.closed_at else None,
    }
