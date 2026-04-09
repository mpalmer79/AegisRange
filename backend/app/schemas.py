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
    """Simulation-context request: actor_id and actor_role identify the
    *simulated threat actor* being emulated, not the authenticated platform
    user.  The platform user is identified via the JWT bearer token.
    This separation is by design — see ARCHITECTURE.md §8 (Identity Model)."""

    actor_id: str
    actor_role: str
    session_id: str | None = None


class DownloadRequest(BaseModel):
    """Simulation-context request: see ReadRequest docstring."""

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
