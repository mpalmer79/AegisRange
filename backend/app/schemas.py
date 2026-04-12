"""API request/response schemas.

All Pydantic models used for FastAPI request/response bodies live here.
Route handlers import these instead of defining models inline.
"""

from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic paginated envelope
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------------------
# Event response models
# ---------------------------------------------------------------------------


class EventResponse(BaseModel):
    event_id: str
    event_type: str
    category: str
    timestamp: str
    actor_id: str
    actor_type: str
    actor_role: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    request_id: str
    correlation_id: str
    session_id: str | None = None
    source_ip: str
    user_agent: str | None = None
    origin: str
    status: str
    status_code: str | None = None
    error_message: str | None = None
    severity: str
    confidence: str
    risk_score: float | None = None
    payload: dict[str, Any] = {}


class EventsExportResponse(BaseModel):
    export_timestamp: str
    total_events: int
    events: list[EventResponse]


# ---------------------------------------------------------------------------
# Alert response models
# ---------------------------------------------------------------------------


class AlertResponse(BaseModel):
    alert_id: str
    rule_id: str
    rule_name: str
    severity: str
    confidence: str
    actor_id: str
    correlation_id: str
    contributing_event_ids: list[str]
    summary: str
    payload: dict[str, Any] = {}
    created_at: str


# ---------------------------------------------------------------------------
# Incident response models
# ---------------------------------------------------------------------------


class TimelineEntryResponse(BaseModel):
    timestamp: str
    entry_type: str
    entry_id: str
    summary: str


class AffectedResources(BaseModel):
    documents: list[str] = []
    sessions: list[str] = []
    services: list[str] = []
    actors: list[str] = []


class IncidentNoteResponse(BaseModel):
    note_id: str
    author: str
    content: str
    created_at: str


class IncidentResponse(BaseModel):
    incident_id: str
    incident_type: str
    status: str
    primary_actor_id: str
    actor_type: str
    actor_role: str
    correlation_id: str
    severity: str
    confidence: str
    risk_score: float
    detection_ids: list[str]
    detection_summary: list[str] | str
    response_ids: list[str]
    containment_status: str
    event_ids: list[str]
    affected_documents: list[str]
    affected_sessions: list[str]
    affected_services: list[str]
    affected_resources: AffectedResources
    timeline: list[TimelineEntryResponse]
    created_at: str
    updated_at: str
    notes: list[dict[str, Any]] = []
    closed_at: str | None = None


# ---------------------------------------------------------------------------
# Scenario response model
# ---------------------------------------------------------------------------


class ScenarioSummaryResponse(BaseModel):
    scenario_id: str
    correlation_id: str
    events_total: int
    events_generated: int
    alerts_total: int
    alerts_generated: int
    responses_total: int
    responses_generated: int
    incident_id: str | None = None
    step_up_required: bool
    revoked_sessions: list[str]
    download_restricted_actors: list[str]
    disabled_services: list[str]
    quarantined_artifacts: list[str]
    policy_change_restricted_actors: list[str]
    operated_by: str | None = None


# ---------------------------------------------------------------------------
# Analytics response models
# ---------------------------------------------------------------------------


class RiskProfileResponse(BaseModel):
    actor_id: str
    current_score: float
    peak_score: float
    contributing_rules: list[str]
    score_history: list[dict[str, Any]]
    last_updated: str


class RuleEffectivenessResponse(BaseModel):
    rule_id: str
    rule_name: str
    trigger_count: int
    severity: str
    actors_affected: int


# ---------------------------------------------------------------------------
# Kill chain response models
# ---------------------------------------------------------------------------


class KillChainStageResponse(BaseModel):
    name: str
    display_name: str
    description: str
    order: int
    detected: bool
    detection_rule_ids: list[str]
    first_seen: str | None = None


class KillChainAnalysisResponse(BaseModel):
    incident_id: str
    correlation_id: str
    actor_id: str
    stages: list[KillChainStageResponse]
    progression_percentage: float
    highest_stage: str
    first_activity: str | None = None
    last_activity: str | None = None


# ---------------------------------------------------------------------------
# Campaign response model
# ---------------------------------------------------------------------------


class CampaignResponse(BaseModel):
    campaign_id: str
    campaign_name: str
    campaign_type: str
    incident_correlation_ids: list[str]
    shared_actors: list[str]
    shared_ttps: list[str]
    severity: str
    confidence: str
    first_seen: str
    last_seen: str
    summary: str


# ---------------------------------------------------------------------------
# MITRE response models
# ---------------------------------------------------------------------------


class MitreMappingResponse(BaseModel):
    rule_id: str
    technique_ids: list[str]
    tactic_ids: list[str]
    kill_chain_phases: list[str]


class MitreCoverageResponse(BaseModel):
    tactic_id: str
    technique_id: str
    technique_name: str
    rule_ids: list[str]
    scenario_ids: list[str]
    covered: bool


class MitreTacticCoverageResponse(BaseModel):
    tactic_id: str
    tactic_name: str
    covered_techniques: int
    total_techniques: int
    percentage: float


class MitreTechniqueResponse(BaseModel):
    id: str
    name: str
    description: str
    tactic_ids: list[str]
    url: str


# ---------------------------------------------------------------------------
# Metrics response model
# ---------------------------------------------------------------------------


class MetricsResponse(BaseModel):
    total_events: int
    total_alerts: int
    total_responses: int
    total_incidents: int
    active_containments: int
    events_by_category: dict[str, int]
    alerts_by_severity: dict[str, int]
    incidents_by_status: dict[str, int]


# ---------------------------------------------------------------------------
# Health response model
# ---------------------------------------------------------------------------


class HealthStatsResponse(BaseModel):
    events: int
    alerts: int
    incidents: int
    responses: int


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    stats: HealthStatsResponse
    containment: dict[str, int]
    persistence: bool


# ---------------------------------------------------------------------------
# Auth response models
# ---------------------------------------------------------------------------


class AuthLoginResponse(BaseModel):
    username: str
    role: str
    expires_at: str | None = None


class AuthLogoutResponse(BaseModel):
    status: str


class AuthMeResponse(BaseModel):
    username: str
    role: str
    display_name: str


class AuthUserResponse(BaseModel):
    user_id: str
    username: str
    role: str
    display_name: str
    created_at: str


# ---------------------------------------------------------------------------
# Identity response models
# ---------------------------------------------------------------------------


class IdentityLoginResponse(BaseModel):
    success: bool
    actor_id: str
    actor_role: str
    session_id: str | None = None
    step_up_required: bool


class SessionRevokeResponse(BaseModel):
    status: str
    session_id: str


# ---------------------------------------------------------------------------
# Document response model
# ---------------------------------------------------------------------------


class DocumentActionResponse(BaseModel):
    allowed: bool
    document_id: str
    classification: str


# ---------------------------------------------------------------------------
# Admin response model
# ---------------------------------------------------------------------------


class AdminResetResponse(BaseModel):
    status: str
    reset_by: str


# ---------------------------------------------------------------------------
# Request schemas (existing)
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class SimulationLoginRequest(LoginRequest):
    """Extended login request for simulation identity endpoints.

    ``simulated_source_ip`` is optional simulation metadata describing
    the fictional source IP of the emulated threat actor.  It is recorded
    in the event payload but is NOT used as the event's ``source_ip``
    (that is always derived from the real TCP connection).
    """

    simulated_source_ip: str = "127.0.0.1"


class ReadRequest(BaseModel):
    """Simulation-context request body.

    ``actor_id`` and ``actor_role`` identify the **simulated threat actor**
    being emulated within a scenario.  They are NOT the authenticated
    platform user — that identity comes from the JWT bearer token and is
    recorded in every emitted event's ``payload.platform_user_id`` field.

    ``simulated_source_ip`` is optional simulation metadata describing
    the fictional source IP of the emulated threat actor.  It is recorded
    in the event payload but is NOT used as the event's ``source_ip``
    (that is always derived from the real TCP connection).

    The backend treats these fields as untrusted simulation metadata:
    they drive scenario logic (e.g. which documents the actor can access)
    but do NOT affect platform-level authorization, which is enforced
    exclusively via ``require_role()``.

    See ARCHITECTURE.md §8 (Identity Model) for the full trust boundary
    description.
    """

    actor_id: str
    actor_role: str
    session_id: str | None = None
    simulated_source_ip: str = "127.0.0.1"


class DownloadRequest(BaseModel):
    """Simulation-context request body — see ReadRequest docstring."""

    actor_id: str
    actor_role: str
    session_id: str | None = None
    simulated_source_ip: str = "127.0.0.1"


class IncidentStatusUpdate(BaseModel):
    status: Literal["investigating", "contained", "resolved", "closed"]


class IncidentNote(BaseModel):
    author: str
    content: str


class ReportRequest(BaseModel):
    title: str = "AegisRange Exercise Report"
