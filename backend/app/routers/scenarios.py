"""Scenario execution routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request

from app.dependencies import require_role, scenario_engine

logger = logging.getLogger("aegisrange")
router = APIRouter(prefix="/scenarios", tags=["scenarios"])


def _run_scenario(request: Request, scenario_id: str, run_fn):
    platform_user = getattr(request.state, "platform_user", None)
    operated_by = platform_user.sub if platform_user else None
    logger.info(
        "Scenario execution started",
        extra={
            "scenario": scenario_id,
            "correlation_id": request.state.correlation_id,
            "operated_by": operated_by,
        },
    )
    return run_fn(request.state.correlation_id, operated_by=operated_by)


@router.post("/scn-auth-001", dependencies=[Depends(require_role("red_team"))])
def run_scenario_auth_001(request: Request) -> dict:
    """SCN-AUTH-001: Credential Abuse with Suspicious Success."""
    return _run_scenario(request, "scn-auth-001", scenario_engine.run_auth_001)


@router.post("/scn-session-002", dependencies=[Depends(require_role("red_team"))])
def run_scenario_session_002(request: Request) -> dict:
    """SCN-SESSION-002: Session Token Reuse Attack."""
    return _run_scenario(request, "scn-session-002", scenario_engine.run_session_002)


@router.post("/scn-doc-003", dependencies=[Depends(require_role("red_team"))])
def run_scenario_doc_003(request: Request) -> dict:
    """SCN-DOC-003: Bulk Document Access."""
    return _run_scenario(request, "scn-doc-003", scenario_engine.run_doc_003)


@router.post("/scn-doc-004", dependencies=[Depends(require_role("red_team"))])
def run_scenario_doc_004(request: Request) -> dict:
    """SCN-DOC-004: Read-To-Download Exfiltration Pattern."""
    return _run_scenario(request, "scn-doc-004", scenario_engine.run_doc_004)


@router.post("/scn-svc-005", dependencies=[Depends(require_role("red_team"))])
def run_scenario_svc_005(request: Request) -> dict:
    """SCN-SVC-005: Unauthorized Service Access."""
    return _run_scenario(request, "scn-svc-005", scenario_engine.run_svc_005)


@router.post("/scn-corr-006", dependencies=[Depends(require_role("red_team"))])
def run_scenario_corr_006(request: Request) -> dict:
    """SCN-CORR-006: Multi-Signal Compromise Sequence."""
    return _run_scenario(request, "scn-corr-006", scenario_engine.run_corr_006)
