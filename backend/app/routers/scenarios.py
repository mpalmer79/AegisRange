"""Scenario execution routes.

Legacy shape preserved for existing clients. Internally each POST now
creates a ``MissionRun`` via the ``MissionService`` and the response is
augmented with ``run_id`` so clients can follow up with per-run reads
(e.g. ``GET /missions/{run_id}/incident``).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

from app.dependencies import mission_service
from app.schemas import ScenarioSummaryResponse
from app.services.auth_service import _auth_service, _extract_bearer_token

logger = logging.getLogger("aegisrange")
router = APIRouter(
    prefix="/scenarios",
    tags=["scenarios"],
)


def _resolve_operator(request: Request) -> str | None:
    """Attribute the run to an authenticated caller when a valid token is
    present, otherwise allow anonymous execution."""
    platform_user = getattr(request.state, "platform_user", None)
    if platform_user is not None:
        return platform_user.sub
    token, channel = _extract_bearer_token(request)
    if token is None:
        return None
    payload = _auth_service.verify_token(token)
    if payload is None:
        return None
    request.state.platform_user = payload
    request.state.auth_channel = channel
    return payload.sub


def _run_scenario(request: Request, scenario_id: str) -> dict:
    operated_by = _resolve_operator(request)
    logger.info(
        "Scenario execution started",
        extra={
            "scenario": scenario_id,
            "correlation_id": request.state.correlation_id,
            "operated_by": operated_by,
        },
    )
    run = mission_service.start(
        scenario_id=scenario_id,
        perspective="blue",
        difficulty="analyst",
        correlation_id=request.state.correlation_id,
        operated_by=operated_by,
    )
    return {**(run.summary or {}), "run_id": run.run_id}


@router.post("/scn-auth-001", response_model=ScenarioSummaryResponse)
def run_scenario_auth_001(request: Request) -> dict:
    """SCN-AUTH-001: Credential Abuse with Suspicious Success."""
    return _run_scenario(request, "scn-auth-001")


@router.post("/scn-session-002", response_model=ScenarioSummaryResponse)
def run_scenario_session_002(request: Request) -> dict:
    """SCN-SESSION-002: Session Token Reuse Attack."""
    return _run_scenario(request, "scn-session-002")


@router.post("/scn-doc-003", response_model=ScenarioSummaryResponse)
def run_scenario_doc_003(request: Request) -> dict:
    """SCN-DOC-003: Bulk Document Access."""
    return _run_scenario(request, "scn-doc-003")


@router.post("/scn-doc-004", response_model=ScenarioSummaryResponse)
def run_scenario_doc_004(request: Request) -> dict:
    """SCN-DOC-004: Read-To-Download Exfiltration Pattern."""
    return _run_scenario(request, "scn-doc-004")


@router.post("/scn-svc-005", response_model=ScenarioSummaryResponse)
def run_scenario_svc_005(request: Request) -> dict:
    """SCN-SVC-005: Unauthorized Service Access."""
    return _run_scenario(request, "scn-svc-005")


@router.post("/scn-corr-006", response_model=ScenarioSummaryResponse)
def run_scenario_corr_006(request: Request) -> dict:
    """SCN-CORR-006: Multi-Signal Compromise Sequence."""
    return _run_scenario(request, "scn-corr-006")
