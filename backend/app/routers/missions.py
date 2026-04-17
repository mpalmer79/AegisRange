"""Mission runtime routes.

Phase 2 surface:

- ``POST /missions`` creates a mission in ``active`` status and hands
  it to the :class:`MissionScheduler` for timed adversary playback.
  Returns immediately with a ``run_id``.
- ``GET /missions/{run_id}`` returns the current snapshot.
- ``GET /missions/{run_id}/incident`` returns the generated incident
  (anonymous — the ``run_id`` is the capability).
- ``GET /missions/{run_id}/stream`` is a Server-Sent Events stream
  of world updates published by the scheduler.

No auth or role is required on ``/missions/*``. Holding the ``run_id``
(a UUID) is the capability.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.dependencies import (
    mission_help_service,
    mission_service,
    mission_stream_hub,
)
from app.schemas import (
    IncidentResponse,
    MissionHelpResponse,
    MissionSnapshot,
    ScenarioSummaryResponse,
    StartMissionRequest,
    SubmitCommandRequest,
    SubmitCommandResponse,
)
from app.services.command_grammar import verbs_for
from app.serializers import incident_to_dict
from app.services.auth_service import _auth_service, _extract_bearer_token
from app.services.mission_service import MissionRun
from app.services.mission_stream import MissionStreamHub
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
        "commands_issued": [r.verb_key for r in run.command_history],
        "xp_delta": run.xp_delta,
    }


@router.post("", response_model=MissionSnapshot)
async def start_mission(payload: StartMissionRequest, request: Request) -> dict:
    if not mission_service.is_supported(payload.scenario_id):
        raise HTTPException(
            status_code=404,
            detail=f"Unknown scenario '{payload.scenario_id}'",
        )
    correlation_id = request.state.correlation_id
    operated_by = _resolve_operator(request)
    logger.info(
        "Mission starting",
        extra={
            "scenario": payload.scenario_id,
            "perspective": payload.perspective,
            "difficulty": payload.difficulty,
            "mode": payload.mode,
            "correlation_id": correlation_id,
            "operated_by": operated_by,
        },
    )
    if payload.mode == "sync":
        run = mission_service.start_sync(
            scenario_id=payload.scenario_id,
            perspective=payload.perspective,
            difficulty=payload.difficulty,
            correlation_id=correlation_id,
            operated_by=operated_by,
        )
    else:
        run = mission_service.start_async(
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
        raise HTTPException(status_code=404, detail="No incident yet for this mission")
    notes = STORE.get_incident_notes_for(incident.correlation_id)
    return incident_to_dict(incident, notes=notes)


# ---------------------------------------------------------------------------
# SSE stream
# ---------------------------------------------------------------------------


async def _sse_event_stream(run_id: str, hub: MissionStreamHub) -> AsyncIterator[bytes]:
    """Yield SSE-formatted frames until the mission ends."""
    queue = await hub.subscribe(run_id)
    try:
        # Prelude: hint to clients that we're connected.
        yield b": connected\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
            except asyncio.TimeoutError:
                # Keepalive comment — no-op for the consumer, keeps
                # browser / proxy connections warm.
                yield b": keepalive\n\n"
                continue
            if event == MissionStreamHub.CLOSE_SENTINEL:
                break
            assert isinstance(event, dict)
            payload = json.dumps(event, default=str).encode("utf-8")
            yield b"event: " + event["type"].encode("utf-8") + b"\n"
            yield b"data: " + payload + b"\n\n"
    finally:
        await hub.unsubscribe(run_id, queue)


@router.get("/{run_id}/stream")
async def stream_mission(run_id: str) -> StreamingResponse:
    run = mission_service.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    # Re-use ``_sse_event_stream``; the hub replays any buffered events
    # (``mission_started`` + early beats) to new subscribers and, for
    # already-terminal runs, delivers the backlog then the close
    # sentinel without blocking.
    response = StreamingResponse(
        _sse_event_stream(run_id, mission_stream_hub),
        media_type="text/event-stream",
    )
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    return response


# ---------------------------------------------------------------------------
# Commands + help
# ---------------------------------------------------------------------------


@router.post(
    "/{run_id}/commands",
    response_model=SubmitCommandResponse,
)
async def submit_command(run_id: str, payload: SubmitCommandRequest) -> dict:
    run, response = await mission_service.submit_command(run_id, payload.command)
    if run is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {
        **response,
        "commands_issued": [r.verb_key for r in run.command_history],
        "xp_delta": run.xp_delta,
    }


@router.get("/{run_id}/help", response_model=MissionHelpResponse)
def mission_help(run_id: str, topic: str | None = None) -> dict:
    run = mission_service.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    overview = mission_help_service.overview(run.perspective)
    verb_help: dict[str, list[str]] = {}
    if topic:
        page = mission_help_service.verb_help(topic, run.perspective)
        if page is not None:
            verb_help[topic] = page
    else:
        # Pre-compute the per-verb pages so the Ops Manual overlay can
        # render without a second round-trip per verb.
        for v in verbs_for(run.perspective):
            page = mission_help_service.verb_help(v.key, run.perspective)
            if page is not None:
                verb_help[v.key] = page
    return {"overview": overview, "verb_help": verb_help}
