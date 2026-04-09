"""API request/response schemas.

All Pydantic models used for FastAPI request bodies live here.
Route handlers import these instead of defining models inline.
"""
from __future__ import annotations

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class ReadRequest(BaseModel):
    """Simulation-context request body.

    ``actor_id`` and ``actor_role`` identify the **simulated threat actor**
    being emulated within a scenario.  They are NOT the authenticated
    platform user — that identity comes from the JWT bearer token and is
    recorded in every emitted event's ``payload.platform_user_id`` field.

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


class DownloadRequest(BaseModel):
    """Simulation-context request body — see ReadRequest docstring."""

    actor_id: str
    actor_role: str
    session_id: str | None = None


class IncidentStatusUpdate(BaseModel):
    status: str


class IncidentNote(BaseModel):
    author: str
    content: str


class ReportRequest(BaseModel):
    title: str = "AegisRange Exercise Report"
