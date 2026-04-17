"""API request/response schemas.

All Pydantic models used for FastAPI request/response bodies live here.
Route handlers import these instead of defining models inline.
"""

from __future__ import annotations

import re
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field, field_validator

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
    run_id: str | None = None
    # Phase 3: commands the player has issued so far (verb keys only,
    # not raw strings; used by objective checks and the Ops Manual).
    commands_issued: list[str] = []
    xp_delta: int = 0


# ---------------------------------------------------------------------------
# Mission (Phase 1 scaffolding)
# ---------------------------------------------------------------------------


Perspective = Literal["red", "blue"]
Difficulty = Literal["recruit", "analyst", "operator"]
MissionStatusLiteral = Literal["active", "complete", "failed", "aborted", "timed_out"]


MissionExecutionMode = Literal["async", "sync"]


class StartMissionRequest(BaseModel):
    scenario_id: str
    perspective: Perspective = "blue"
    difficulty: Difficulty = "analyst"
    # ``async`` (default) queues the mission for timed adversary
    # playback via the MissionScheduler and returns immediately with
    # ``status='active'``. ``sync`` runs the scenario inline and
    # returns with ``status='complete'`` — used by integration tests
    # and admin scripts that need an immediate snapshot.
    mode: MissionExecutionMode = "async"


class MissionSnapshot(BaseModel):
    run_id: str
    scenario_id: str
    perspective: Perspective
    difficulty: Difficulty
    correlation_id: str
    status: MissionStatusLiteral
    created_at: str
    operated_by: str | None = None
    summary: ScenarioSummaryResponse | None = None
    commands_issued: list[str] = []
    xp_delta: int = 0
    coop_partner_run_id: str | None = None


class SubmitCommandRequest(BaseModel):
    command: str


class SubmitCommandResponse(BaseModel):
    kind: Literal["ok", "error"]
    lines: list[str]
    effects: dict[str, Any] = {}
    verb_key: str
    commands_issued: list[str]
    xp_delta: int


class MissionHelpResponse(BaseModel):
    overview: list[str]
    verb_help: dict[str, list[str]] = {}


# -- Phase 8: scores, leaderboard, replay ----------------------------------


class ReportScoreRequest(BaseModel):
    score: int
    duration_seconds: int | None = None


class LeaderboardEntry(BaseModel):
    run_id: str
    scenario_id: str
    perspective: Perspective
    difficulty: Difficulty
    status: MissionStatusLiteral
    score: int
    duration_seconds: int | None = None
    operated_by: str | None = None
    created_at: str


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]


class ReplayCommand(BaseModel):
    ts: str
    raw: str
    verb_key: str
    kind: Literal["ok", "error"]
    lines: list[str]
    effects: dict[str, Any] = {}


class ReplayResponse(BaseModel):
    run_id: str
    scenario_id: str
    perspective: Perspective
    difficulty: Difficulty
    status: MissionStatusLiteral
    created_at: str
    score: int | None = None
    duration_seconds: int | None = None
    summary: ScenarioSummaryResponse | None = None
    commands: list[ReplayCommand]


# -- Phase 9: co-op ---------------------------------------------------------


class StartCoopRequest(BaseModel):
    scenario_id: str
    difficulty: Difficulty = "analyst"


class CoopPair(BaseModel):
    correlation_id: str
    red: MissionSnapshot
    blue: MissionSnapshot


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


class HealthSubsystemsResponse(BaseModel):
    """Per-subsystem reachability snapshot — 0.10.0 addition.

    ``status`` is ``"ok"`` when the subsystem is reachable and
    functioning, ``"disabled"`` when the subsystem is intentionally
    not in use for this deployment, or ``"degraded"`` when something
    is wrong. Callers (load balancer readiness probes, Railway
    deploy-gate checks) should parse this block before deciding
    whether the instance can take traffic.
    """

    persistence_sqlite: dict[str, object]
    auth_cache: dict[str, object]
    jwt_secret_configured: bool


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    stats: HealthStatsResponse
    containment: dict[str, int]
    persistence: bool
    # 0.10.0 additions — optional so existing HealthResponse consumers
    # that were written against 0.9.x don't break on the new fields.
    subsystems: HealthSubsystemsResponse | None = None
    uptime_seconds: float | None = None
    version: str | None = None


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
    # Numeric role level from backend ROLES (0-100). Frontend can sort
    # users or gate UI without mirroring the role ladder.
    level: int
    # Scopes granted to the role (see ROLE_SCOPES).
    scopes: list[str]
    # Derived boolean-flag capabilities keyed on the role's level. Adding
    # a new capability on the backend flows to the frontend automatically.
    capabilities: list[str]


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


class _StrictInput(BaseModel):
    """Base class for request schemas that reject unknown fields."""

    model_config = {"extra": "forbid"}


class LoginRequest(_StrictInput):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """Enforce password complexity in production mode.

        Always enforces min_length=12 (via Field).  In production
        (``SKIP_PASSWORD_COMPLEXITY=False``), additionally requires
        uppercase, lowercase, digit, and special character.
        """
        from app.config import settings

        if settings.SKIP_PASSWORD_COMPLEXITY:
            return v

        violations: list[str] = []
        if not re.search(r"[A-Z]", v):
            violations.append("at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            violations.append("at least one lowercase letter")
        if not re.search(r"\d", v):
            violations.append("at least one digit")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>?]", v):
            violations.append("at least one special character")
        if violations:
            raise ValueError("Password must contain: " + ", ".join(violations))
        return v


class SimulationLoginRequest(LoginRequest):
    """Extended login request for simulation identity endpoints.

    ``simulated_source_ip`` is optional simulation metadata describing
    the fictional source IP of the emulated threat actor.  It is recorded
    in the event payload but is NOT used as the event's ``source_ip``
    (that is always derived from the real TCP connection).
    """

    simulated_source_ip: str = Field(default="127.0.0.1", max_length=45)


class ReadRequest(_StrictInput):
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

    actor_id: str = Field(..., min_length=1, max_length=128)
    actor_role: str = Field(..., min_length=1, max_length=64)
    session_id: str | None = Field(default=None, max_length=128)
    simulated_source_ip: str = Field(default="127.0.0.1", max_length=45)


class DownloadRequest(_StrictInput):
    """Simulation-context request body — see ReadRequest docstring."""

    actor_id: str = Field(..., min_length=1, max_length=128)
    actor_role: str = Field(..., min_length=1, max_length=64)
    session_id: str | None = Field(default=None, max_length=128)
    simulated_source_ip: str = Field(default="127.0.0.1", max_length=45)


class IncidentStatusUpdate(_StrictInput):
    status: Literal["investigating", "contained", "resolved", "closed"]


class IncidentNote(_StrictInput):
    author: str = Field(..., min_length=1, max_length=128)
    content: str = Field(..., min_length=1, max_length=10000)


class ReportRequest(_StrictInput):
    title: str = Field(
        default="AegisRange Exercise Report", min_length=1, max_length=256
    )


# ---------------------------------------------------------------------------
# Exercise report response model
# ---------------------------------------------------------------------------


class ExerciseReportResponse(BaseModel):
    report_id: str
    title: str
    generated_at: str
    exercise_window: dict[str, str]
    summary: dict[str, Any]
    scenario_results: list[dict[str, Any]]
    detection_coverage: dict[str, Any]
    response_effectiveness: dict[str, Any]
    risk_summary: dict[str, Any]
    recommendations: list[str]
    mitre_coverage: dict[str, Any]
