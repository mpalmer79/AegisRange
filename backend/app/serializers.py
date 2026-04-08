"""API serialization layer.

Single-owner module for converting domain models to API response dicts.
Route handlers import these functions instead of building dicts inline.
"""
from __future__ import annotations

from app.models import Alert, Event, Incident


def event_to_dict(event: Event) -> dict:
    return {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "category": event.category,
        "timestamp": event.timestamp.isoformat(),
        "actor_id": event.actor_id,
        "actor_type": event.actor_type,
        "actor_role": event.actor_role,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "request_id": event.request_id,
        "correlation_id": event.correlation_id,
        "session_id": event.session_id,
        "source_ip": event.source_ip,
        "user_agent": event.user_agent,
        "origin": event.origin,
        "status": event.status,
        "status_code": event.status_code,
        "error_message": event.error_message,
        "severity": event.severity.value,
        "confidence": event.confidence.value,
        "risk_score": event.risk_score,
        "payload": event.payload,
    }


def alert_to_dict(alert: Alert) -> dict:
    return {
        "alert_id": alert.alert_id,
        "rule_id": alert.rule_id,
        "rule_name": alert.rule_name,
        "severity": alert.severity.value,
        "confidence": alert.confidence.value,
        "actor_id": alert.actor_id,
        "correlation_id": alert.correlation_id,
        "contributing_event_ids": alert.contributing_event_ids,
        "summary": alert.summary,
        "payload": alert.payload,
        "created_at": alert.created_at.isoformat(),
    }


def timeline_entry_to_dict(entry) -> dict:
    return {
        "timestamp": entry.timestamp.isoformat(),
        "entry_type": entry.entry_type,
        "entry_id": entry.reference_id,
        "summary": entry.summary,
    }


def incident_to_dict(incident: Incident, notes: list[dict] | None = None) -> dict:
    return {
        "incident_id": incident.incident_id,
        "incident_type": incident.incident_type,
        "status": incident.status,
        "primary_actor_id": incident.primary_actor_id,
        "actor_type": incident.actor_type,
        "actor_role": incident.actor_role,
        "correlation_id": incident.correlation_id,
        "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
        "confidence": incident.confidence.value if hasattr(incident.confidence, "value") else incident.confidence,
        "risk_score": incident.risk_score,
        "detection_ids": incident.detection_ids,
        "detection_summary": incident.detection_summary,
        "response_ids": incident.response_ids,
        "containment_status": incident.containment_status,
        "event_ids": incident.event_ids,
        "affected_documents": incident.affected_documents,
        "affected_sessions": incident.affected_sessions,
        "affected_services": incident.affected_services,
        "affected_resources": {
            "documents": incident.affected_documents,
            "sessions": incident.affected_sessions,
            "services": incident.affected_services,
            "actors": [incident.primary_actor_id] if incident.primary_actor_id else [],
        },
        "timeline": [timeline_entry_to_dict(e) for e in incident.timeline],
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "notes": list(notes) if notes else [],
        "closed_at": incident.closed_at.isoformat() if incident.closed_at else None,
    }


def risk_profile_to_dict(profile) -> dict:
    return {
        "actor_id": profile.actor_id,
        "current_score": profile.current_score,
        "peak_score": profile.peak_score,
        "contributing_rules": profile.contributing_rules,
        "score_history": profile.score_history,
        "last_updated": profile.last_updated.isoformat(),
    }


def auth_user_to_dict(user) -> dict:
    return {
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "display_name": user.display_name,
        "created_at": user.created_at.isoformat(),
    }


def mitre_mapping_to_dict(mapping) -> dict:
    return {
        "rule_id": mapping.rule_id,
        "technique_ids": mapping.technique_ids,
        "tactic_ids": mapping.tactic_ids,
        "kill_chain_phases": mapping.kill_chain_phases,
    }


def mitre_technique_to_dict(technique) -> dict:
    return {
        "id": technique.id,
        "name": technique.name,
        "description": technique.description,
        "tactic_ids": technique.tactic_ids,
        "url": technique.url,
    }
