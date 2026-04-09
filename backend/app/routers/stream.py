"""Real-time event streaming routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.dependencies import require_role, stream_service

router = APIRouter(tags=["stream"])


@router.get("/stream/events", dependencies=[Depends(require_role("viewer"))])
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
