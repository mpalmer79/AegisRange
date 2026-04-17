"""Mission runtime routes.

Phase 1 surface: a mission is created via ``POST /missions`` and its
generated incident can be fetched anonymously via
``GET /missions/{run_id}/incident``. Later phases will add command
dispatch, SSE streaming, and per-run world snapshots.

The capability model is ``run_id`` — a UUID that is returned to the
client on creation. No auth or role is required: anyone holding the
``run_id`` may read that run.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.dependencies import mission_service
from app.schemas import (
    IncidentResponse,
    MissionSnapshot,
    ScenarioSummaryResponse,
    StartMissionRequest,
)
from app.serializers import incident_to_dict
from app.services.auth_service import _auth_service, _extract_bearer_token
from app.services.mission_service import MissionRun
from app.store import STORE

logger = logging.getLogger("aegisrange")
router = APIRouter(prefix="/missions", tags=["missions"])


def _resolve_operator(request: Request) -> str | None:
    """Best-effort identity resolution. Missions are anonymous-friendly;
    if a valid token is present we still attribute the run."""
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


def _snapshot(run: MissionRun) -> dict:
    summary = None
    if run.summary is not None:
        summary = ScenarioSummaryResponse(
            **{**run.summary, "run_id": run.run_id}
        ).model_dump()
    return {
        "run_id": run.run_id,
        "scenario_id": run.scenario_id,
        "perspective": run.perspective,
        "difficulty": run.difficulty,
        "correlation_id": run.correlation_id,
        "status": run.status,
        "created_at": run.created_at.isoformat(),
        "operated_by": run.operated_by,
        "summary": summary,
    }


@router.post("", response_model=MissionSnapshot)
def start_mission(payload: StartMissionRequest, request: Request) -> dict:
    if not mission_service.is_supported(payload.scenario_id):
        raise HTTPException(
            status_code=404,
            detail=f"Unknown scenario '{payload.scenario_id}'",
        )
    correlation_id = request.state.correlation_id
    operated_by = _resolve_operator(request)
    logger.info(
        "Mission started",
        extra={
            "scenario": payload.scenario_id,
            "perspective": payload.perspective,
            "difficulty": payload.difficulty,
            "correlation_id": correlation_id,
            "operated_by": operated_by,
        },
    )
    run = mission_service.start(
        scenario_id=payload.scenario_id,
        perspective=payload.perspective,
        difficulty=payload.difficulty,
        correlation_id=correlation_id,
        operated_by=operated_by,
    )
    return _snapshot(run)


@router.get("/{run_id}", response_model=MissionSnapshot)
def get_mission(run_id: str) -> dict:
    run = mission_service.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return _snapshot(run)


@router.get("/{run_id}/incident", response_model=IncidentResponse)
def get_mission_incident(run_id: str) -> dict:
    run, incident = mission_service.get_incident(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    if incident is None:
        raise HTTPException(
            status_code=404, detail="No incident yet for this mission"
        )
    notes = STORE.get_incident_notes_for(incident.correlation_id)
    return incident_to_dict(incident, notes=notes)
