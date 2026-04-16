"""Scenario execution routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

from app.dependencies import scenario_engine
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


def _run_scenario(request: Request, scenario_id: str, run_fn):
    operated_by = _resolve_operator(request)
    logger.info(
        "Scenario execution started",
        extra={
            "scenario": scenario_id,
            "correlation_id": request.state.correlation_id,
            "operated_by": operated_by,
        },
    )
    return run_fn(request.state.correlation_id, operated_by=operated_by)


@router.post("/scn-auth-001", response_model=ScenarioSummaryResponse)
def run_scenario_auth_001(request: Request) -> dict:
    """SCN-AUTH-001: Credential Abuse with Suspicious Success."""
    return _run_scenario(request, "scn-auth-001", scenario_engine.run_auth_001)


@router.post("/scn-session-002", response_model=ScenarioSummaryResponse)
def run_scenario_session_002(request: Request) -> dict:
    """SCN-SESSION-002: Session Token Reuse Attack."""
    return _run_scenario(request, "scn-session-002", scenario_engine.run_session_002)


@router.post("/scn-doc-003", response_model=ScenarioSummaryResponse)
def run_scenario_doc_003(request: Request) -> dict:
    """SCN-DOC-003: Bulk Document Access."""
    return _run_scenario(request, "scn-doc-003", scenario_engine.run_doc_003)


@router.post("/scn-doc-004", response_model=ScenarioSummaryResponse)
def run_scenario_doc_004(request: Request) -> dict:
    """SCN-DOC-004: Read-To-Download Exfiltration Pattern."""
    return _run_scenario(request, "scn-doc-004", scenario_engine.run_doc_004)


@router.post("/scn-svc-005", response_model=ScenarioSummaryResponse)
def run_scenario_svc_005(request: Request) -> dict:
    """SCN-SVC-005: Unauthorized Service Access."""
    return _run_scenario(request, "scn-svc-005", scenario_engine.run_svc_005)


@router.post("/scn-corr-006", response_model=ScenarioSummaryResponse)
def run_scenario_corr_006(request: Request) -> dict:
    """SCN-CORR-006: Multi-Signal Compromise Sequence."""
    return _run_scenario(request, "scn-corr-006", scenario_engine.run_corr_006)
