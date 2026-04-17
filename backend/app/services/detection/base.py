"""Core detection-rule types.

Defines the ``DetectionRule`` dataclass, the ``RuleContext`` passed to
evaluators, and the ``_build_alert`` helper that stamps explainability
metadata onto every alert produced by a rule.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable

from app.models import Alert, Confidence, Event, Severity

logger = logging.getLogger("aegisrange.detection")


@dataclass(frozen=True)
class DetectionRule:
    """A structured, versioned detection rule with MITRE alignment."""

    rule_id: str
    name: str
    description: str
    version: str
    severity: Severity
    confidence: Confidence
    enabled: bool

    # MITRE ATT&CK alignment (Phase 4)
    mitre_technique_ids: list[str]
    mitre_tactic_ids: list[str]

    # The evaluation function — takes (event, context) → Alert | None
    # Context provides access to telemetry lookups and store state.
    evaluate: Callable[[Event, "RuleContext"], Alert | None]

    # Whether this rule is critical (cannot be silently disabled)
    critical: bool = False


@dataclass
class RuleContext:
    """Execution context passed to detection rule evaluate functions.

    Provides access to telemetry lookups and store state without
    giving rules direct access to internal services.
    """

    lookup_events: Callable[..., list[Event]]
    is_step_up_required: Callable[[str], bool]
    is_download_restricted: Callable[[str], bool]
    # Identity context (Phase 6) — populated from the event
    actor_identity_type: str | None = None
    actor_role: str | None = None
    actor_scopes: list[str] = field(default_factory=list)
    platform_user: str | None = None


def _build_alert(
    rule: DetectionRule,
    event: Event,
    contributing_event_ids: list[str],
    summary: str,
    payload: dict[str, Any],
) -> Alert:
    """Build an alert with full explainability metadata.

    Every alert includes ``matched_conditions`` in the payload so
    investigators can answer "why did this fire?".
    """
    enriched_payload = {
        **payload,
        "rule_version": rule.version,
        "mitre_technique_ids": rule.mitre_technique_ids,
        "mitre_tactic_ids": rule.mitre_tactic_ids,
        "matched_conditions": {
            "rule_id": rule.rule_id,
            "rule_version": rule.version,
            "trigger_event_id": event.event_id,
            "trigger_event_type": event.event_type,
            "source_ip": event.source_ip,
            **payload,
        },
    }
    # Include identity context if available (Phase 6)
    if event.actor_role:
        enriched_payload["identity_context"] = {
            "actor_id": event.actor_id,
            "actor_type": event.actor_type,
            "actor_role": event.actor_role,
        }

    return Alert(
        rule_id=rule.rule_id,
        rule_name=rule.name,
        severity=rule.severity,
        confidence=rule.confidence,
        actor_id=event.actor_id,
        correlation_id=event.correlation_id,
        contributing_event_ids=contributing_event_ids,
        summary=summary,
        payload=enriched_payload,
    )
