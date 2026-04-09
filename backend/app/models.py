from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4


def utc_now() -> datetime:
    """Return the current time as a timezone-aware UTC datetime.

    Replaces the deprecated ``datetime.utcnow()`` throughout the codebase.
    """
    return datetime.now(timezone.utc)


class Severity(str, Enum):
    INFORMATIONAL = "informational"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Confidence(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class Event:
    event_type: str
    category: str
    actor_id: str
    actor_type: str
    request_id: str
    correlation_id: str
    status: str
    source_ip: str
    origin: str
    payload: dict[str, Any]
    actor_role: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    session_id: str | None = None
    user_agent: str | None = None
    status_code: str | None = None
    error_message: str | None = None
    severity: Severity = Severity.INFORMATIONAL
    confidence: Confidence = Confidence.LOW
    risk_score: int | None = None
    event_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=utc_now)
    ingestion_timestamp: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class Alert:
    rule_id: str
    rule_name: str
    severity: Severity
    confidence: Confidence
    actor_id: str
    correlation_id: str
    contributing_event_ids: list[str]
    summary: str
    payload: dict[str, Any]
    alert_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class ResponseAction:
    playbook_id: str
    action_type: str
    actor_id: str
    correlation_id: str
    reason: str
    related_alert_id: str
    payload: dict[str, Any]
    response_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class TimelineEntry:
    timestamp: datetime
    entry_type: str
    reference_id: str
    summary: str


@dataclass
class Incident:
    incident_type: str
    primary_actor_id: str
    actor_type: str
    correlation_id: str
    severity: Severity
    confidence: Confidence
    status: str = "open"
    actor_role: str | None = None
    risk_score: int | None = None
    detection_ids: list[str] = field(default_factory=list)
    detection_summary: list[str] = field(default_factory=list)
    response_ids: list[str] = field(default_factory=list)
    containment_status: str = "none"
    event_ids: list[str] = field(default_factory=list)
    timeline: list[TimelineEntry] = field(default_factory=list)
    affected_documents: list[str] = field(default_factory=list)
    affected_sessions: list[str] = field(default_factory=list)
    affected_services: list[str] = field(default_factory=list)
    incident_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    closed_at: datetime | None = None

    def add_timeline_entry(self, entry_type: str, reference_id: str, summary: str) -> None:
        now = utc_now()
        self.timeline.append(
            TimelineEntry(timestamp=now, entry_type=entry_type, reference_id=reference_id, summary=summary)
        )
        self.updated_at = now
