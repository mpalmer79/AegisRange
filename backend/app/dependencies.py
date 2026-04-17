"""Service wiring and shared dependencies.

All service instances are created here so that both ``main.py`` and
individual router modules can import them without circular dependencies.
"""

from __future__ import annotations

from app.services.auth_service import (  # noqa: F401
    _auth_service,
    require_identity_type,
    require_role,
    require_scope,
)
from app.services.campaign_service import CampaignDetectionService
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.killchain_service import KillChainService
from app.services.mitre_service import MitreAttackService
from app.services.pipeline_service import EventPipelineService
from app.services.report_service import ReportService
from app.services.response_service import ResponseOrchestrator
from app.services.risk_service import RiskScoringService
from app.services.scenario_service import ScenarioEngine
from app.services.mission_service import MissionService, MissionStore
from app.services.mission_scheduler import MissionScheduler
from app.services.mission_stream import MissionStreamHub
from app.services.stream_service import StreamService
from app.store import STORE

# --- Service instances ---

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

mission_store = MissionStore()
mission_stream_hub = MissionStreamHub()
mission_scheduler = MissionScheduler(
    scenario_engine=scenario_engine,
    mission_store=mission_store,
    stream_hub=mission_stream_hub,
)
mission_service = MissionService(
    scenario_engine=scenario_engine,
    incident_store=STORE,
    mission_store=mission_store,
    scheduler=mission_scheduler,
)

mitre_service = MitreAttackService()
killchain_service = KillChainService(STORE)
campaign_detection_service = CampaignDetectionService(STORE)
auth_service = _auth_service
report_service = ReportService(STORE)
stream_service = StreamService(STORE)
