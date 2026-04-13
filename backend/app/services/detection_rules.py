"""Structured detection rule definitions for AegisRange.

Each rule is a declarative ``DetectionRule`` with:
  - identity, version, MITRE mapping
  - an ``evaluate`` callback that returns an Alert or None
  - explainability metadata (matched_conditions in payload)

Rules are registered in the global ``RULE_REGISTRY`` and can be
queried by ID.  The detection service iterates over enabled rules
for each incoming event.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import timedelta
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
    evaluate: Callable[[Event, RuleContext], Alert | None]

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


# ---------------------------------------------------------------------------
# Rule evaluation functions
# ---------------------------------------------------------------------------


def _eval_auth_failure_burst(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "authentication.login.failure":
        return None
    failures = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"authentication.login.failure"},
        since_minutes=2,
    )
    if len(failures) < 5:
        return None
    return None  # signal to caller to build alert with these params


def _eval_det_auth_001(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "authentication.login.failure":
        return None
    failures = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"authentication.login.failure"},
        since_minutes=2,
    )
    if len(failures) < 5:
        return None
    rule = RULE_REGISTRY["DET-AUTH-001"]
    return _build_alert(
        rule,
        event,
        [f.event_id for f in failures],
        f"Detected {len(failures)} authentication failures in 2 minutes.",
        {"failure_count": len(failures), "source_ip": event.source_ip},
    )


def _eval_det_auth_002(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "authentication.login.success":
        return None
    failures = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"authentication.login.failure"},
        since_minutes=5,
    )
    if len(failures) < 3:
        return None
    latest_failure = failures[-1]
    if event.timestamp < latest_failure.timestamp:
        return None
    time_delta = event.timestamp - latest_failure.timestamp
    if time_delta > timedelta(minutes=5):
        return None
    rule = RULE_REGISTRY["DET-AUTH-002"]
    return _build_alert(
        rule,
        event,
        [*[f.event_id for f in failures], event.event_id],
        "Successful authentication followed repeated failures within 5 minutes.",
        {
            "failure_count": len(failures),
            "success_event_id": event.event_id,
            "time_delta_seconds": int(time_delta.total_seconds()),
        },
    )


def _eval_det_session_003(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type not in (
        "authorization.check.success",
        "authorization.check.failure",
    ):
        return None
    if not event.session_id:
        return None
    session_events = ctx.lookup_events(
        event_types={
            "session.token.issued",
            "authorization.check.success",
            "authorization.check.failure",
        },
        since_minutes=5,
    )
    same_session = [e for e in session_events if e.session_id == event.session_id]
    source_ips = {e.source_ip for e in same_session if e.source_ip}
    if len(source_ips) < 2:
        return None
    rule = RULE_REGISTRY["DET-SESSION-003"]
    return _build_alert(
        rule,
        event,
        [e.event_id for e in same_session],
        f"Session {event.session_id} used from {len(source_ips)} different IPs within 5 minutes.",
        {"session_id": event.session_id, "source_ip_list": sorted(source_ips)},
    )


def _eval_det_doc_004(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "document.read.failure":
        return None
    if event.error_message != "classification_mismatch":
        return None
    rule = RULE_REGISTRY["DET-DOC-004"]
    return _build_alert(
        rule,
        event,
        [event.event_id],
        f"Access attempt to document {event.target_id} denied due to classification mismatch.",
        {
            "document_id": event.target_id,
            "classification": event.payload.get("classification"),
            "actor_role": event.actor_role,
        },
    )


def _eval_det_doc_005(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "document.read.success":
        return None
    reads = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"document.read.success"},
        since_minutes=5,
    )
    if len(reads) < 20:
        return None
    rule = RULE_REGISTRY["DET-DOC-005"]
    return _build_alert(
        rule,
        event,
        [r.event_id for r in reads],
        f"Detected {len(reads)} document reads in 5 minutes.",
        {"document_count": len(reads)},
    )


def _eval_det_doc_006(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "document.download.success":
        return None
    reads = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"document.read.success"},
        since_minutes=10,
    )
    downloads = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"document.download.success"},
        since_minutes=10,
    )
    read_docs = {e.target_id for e in reads if e.target_id}
    download_docs = {e.target_id for e in downloads if e.target_id}
    overlap = read_docs & download_docs
    if len(reads) < 2 or len(downloads) < 2 or len(overlap) < 2:
        return None
    all_events = reads + downloads
    rule = RULE_REGISTRY["DET-DOC-006"]
    return _build_alert(
        rule,
        event,
        [e.event_id for e in all_events],
        f"Detected read-to-download staging: {len(overlap)} overlapping documents.",
        {
            "read_count": len(reads),
            "download_count": len(downloads),
            "overlapping_documents": sorted(overlap),
        },
    )


def _eval_det_svc_007(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "authorization.failure":
        return None
    if event.actor_type != "service":
        return None
    failures = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"authorization.failure"},
        since_minutes=2,
    )
    if len(failures) < 3:
        return None
    route_list = sorted({e.target_id for e in failures if e.target_id})
    rule = RULE_REGISTRY["DET-SVC-007"]
    return _build_alert(
        rule,
        event,
        [e.event_id for e in failures],
        f"Service {event.actor_id} made {len(failures)} unauthorized route attempts in 2 minutes.",
        {
            "service_id": event.actor_id,
            "route_list": route_list,
            "failure_count": len(failures),
        },
    )


def _eval_det_art_008(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "artifact.validation.failed":
        return None
    failures = ctx.lookup_events(
        actor_id=event.actor_id,
        event_types={"artifact.validation.failed"},
        since_minutes=10,
    )
    if len(failures) < 3:
        return None
    artifact_ids = sorted({e.target_id for e in failures if e.target_id})
    rule = RULE_REGISTRY["DET-ART-008"]
    return _build_alert(
        rule,
        event,
        [e.event_id for e in failures],
        f"Detected {len(failures)} artifact validation failures in 10 minutes.",
        {"artifact_ids": artifact_ids, "failure_count": len(failures)},
    )


def _eval_det_pol_009(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "policy.change.executed":
        return None
    has_elevated_risk = ctx.is_step_up_required(
        event.actor_id
    ) or ctx.is_download_restricted(event.actor_id)
    if not has_elevated_risk:
        return None
    risk_contexts = []
    if ctx.is_step_up_required(event.actor_id):
        risk_contexts.append("step_up_required")
    if ctx.is_download_restricted(event.actor_id):
        risk_contexts.append("download_restricted")
    actor_risk_context = ", ".join(risk_contexts)
    rule = RULE_REGISTRY["DET-POL-009"]
    return _build_alert(
        rule,
        event,
        [event.event_id],
        f"Policy change by {event.actor_id} while under elevated risk ({actor_risk_context}).",
        {"policy_id": event.target_id, "actor_risk_context": actor_risk_context},
    )


def _eval_det_corr_010(event: Event, ctx: RuleContext) -> Alert | None:
    if event.event_type != "detection.rule.triggered":
        return None
    detection_events = ctx.lookup_events(
        event_types={"detection.rule.triggered"},
        since_minutes=15,
    )
    related = [
        e
        for e in detection_events
        if e.correlation_id == event.correlation_id
        or e.payload.get("matched_conditions", {}).get("source_ip")
        == event.payload.get("matched_conditions", {}).get("source_ip")
    ]
    actor_related = [e for e in detection_events if e.actor_id == event.actor_id]
    seen_ids: set[str] = set()
    merged: list[Event] = []
    for e in related + actor_related:
        if e.event_id not in seen_ids:
            seen_ids.add(e.event_id)
            merged.append(e)
    distinct_rules = {
        e.payload.get("rule_id") for e in merged if e.payload.get("rule_id")
    }
    if len(distinct_rules) < 3:
        return None
    rule = RULE_REGISTRY["DET-CORR-010"]
    return _build_alert(
        rule,
        event,
        [e.event_id for e in merged],
        f"Correlated {len(distinct_rules)} distinct detections within 15 minutes.",
        {
            "detection_ids": sorted(distinct_rules),
            "actor_id": event.actor_id,
            "timeline_summary": (
                f"{len(merged)} detection events across {len(distinct_rules)} rules"
            ),
        },
    )


# ---------------------------------------------------------------------------
# Rule registry — all rules defined here with full metadata
# ---------------------------------------------------------------------------

RULE_REGISTRY: dict[str, DetectionRule] = {}


def _register(rule: DetectionRule) -> None:
    RULE_REGISTRY[rule.rule_id] = rule


_register(
    DetectionRule(
        rule_id="DET-AUTH-001",
        name="Repeated Authentication Failure Burst",
        description="Detects 5+ authentication failures from the same actor within 2 minutes.",
        version="1.0.0",
        severity=Severity.MEDIUM,
        confidence=Confidence.MEDIUM,
        enabled=True,
        mitre_technique_ids=["T1110"],
        mitre_tactic_ids=["TA0006"],
        evaluate=_eval_det_auth_001,
        critical=True,
    )
)

_register(
    DetectionRule(
        rule_id="DET-AUTH-002",
        name="Suspicious Success After Failure Sequence",
        description="Detects successful authentication following 3+ failures within 5 minutes.",
        version="1.0.0",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1110"],
        mitre_tactic_ids=["TA0006"],
        evaluate=_eval_det_auth_002,
        critical=True,
    )
)

_register(
    DetectionRule(
        rule_id="DET-SESSION-003",
        name="Token Reuse From Conflicting Origins",
        description="Detects a session token used from 2+ different IPs within 5 minutes.",
        version="1.0.0",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1563"],
        mitre_tactic_ids=["TA0008"],
        evaluate=_eval_det_session_003,
        critical=True,
    )
)

_register(
    DetectionRule(
        rule_id="DET-DOC-004",
        name="Restricted Document Access Outside Role Scope",
        description="Triggers on classification_mismatch errors during document access.",
        version="1.0.0",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1530"],
        mitre_tactic_ids=["TA0009"],
        evaluate=_eval_det_doc_004,
    )
)

_register(
    DetectionRule(
        rule_id="DET-DOC-005",
        name="Abnormal Bulk Document Access",
        description="Detects 20+ document reads from the same actor within 5 minutes.",
        version="1.0.0",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1119"],
        mitre_tactic_ids=["TA0009"],
        evaluate=_eval_det_doc_005,
    )
)

_register(
    DetectionRule(
        rule_id="DET-DOC-006",
        name="Read-To-Download Staging Pattern",
        description="Detects coordinated read-then-download activity on overlapping documents.",
        version="1.0.0",
        severity=Severity.CRITICAL,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1048"],
        mitre_tactic_ids=["TA0010"],
        evaluate=_eval_det_doc_006,
        critical=True,
    )
)

_register(
    DetectionRule(
        rule_id="DET-SVC-007",
        name="Unauthorized Service Identity Route Access",
        description="Detects 3+ authorization failures from a service actor within 2 minutes.",
        version="1.0.0",
        severity=Severity.HIGH,
        confidence=Confidence.MEDIUM,
        enabled=True,
        mitre_technique_ids=["T1078.004"],
        mitre_tactic_ids=["TA0004"],
        evaluate=_eval_det_svc_007,
    )
)

_register(
    DetectionRule(
        rule_id="DET-ART-008",
        name="Artifact Validation Failure Pattern",
        description="Detects 3+ artifact validation failures within 10 minutes.",
        version="1.0.0",
        severity=Severity.MEDIUM,
        confidence=Confidence.MEDIUM,
        enabled=True,
        mitre_technique_ids=["T1195"],
        mitre_tactic_ids=["TA0001"],
        evaluate=_eval_det_art_008,
    )
)

_register(
    DetectionRule(
        rule_id="DET-POL-009",
        name="Privileged Policy Change With Elevated Risk Context",
        description="Detects policy changes while actor is under elevated risk indicators.",
        version="1.0.0",
        severity=Severity.CRITICAL,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1098"],
        mitre_tactic_ids=["TA0003"],
        evaluate=_eval_det_pol_009,
        critical=True,
    )
)

_register(
    DetectionRule(
        rule_id="DET-CORR-010",
        name="Multi-Signal Compromise Sequence",
        description="Detects 3+ distinct detection rules triggered within 15 minutes.",
        version="1.0.0",
        severity=Severity.CRITICAL,
        confidence=Confidence.HIGH,
        enabled=True,
        mitre_technique_ids=["T1078"],
        mitre_tactic_ids=["TA0001", "TA0003", "TA0004", "TA0005"],
        evaluate=_eval_det_corr_010,
        critical=True,
    )
)


def get_rule(rule_id: str) -> DetectionRule | None:
    """Look up a rule by ID."""
    return RULE_REGISTRY.get(rule_id)


def get_enabled_rules() -> list[DetectionRule]:
    """Return all enabled rules in registry order."""
    return [r for r in RULE_REGISTRY.values() if r.enabled]


def get_all_rules() -> list[DetectionRule]:
    """Return all rules regardless of enabled status."""
    return list(RULE_REGISTRY.values())


# ---------------------------------------------------------------------------
# Detection metrics (Phase 8)
# ---------------------------------------------------------------------------


class DetectionMetrics:
    """In-memory detection metrics collector.

    Tracks per-rule trigger counts and per-technique coverage.
    """

    def __init__(self) -> None:
        self.triggers_by_rule: dict[str, int] = {}
        self.triggers_by_technique: dict[str, int] = {}
        self.total_evaluations: int = 0
        self.total_triggers: int = 0

    def record_evaluation(self) -> None:
        self.total_evaluations += 1

    def record_trigger(self, rule: DetectionRule) -> None:
        self.total_triggers += 1
        self.triggers_by_rule[rule.rule_id] = (
            self.triggers_by_rule.get(rule.rule_id, 0) + 1
        )
        for technique_id in rule.mitre_technique_ids:
            self.triggers_by_technique[technique_id] = (
                self.triggers_by_technique.get(technique_id, 0) + 1
            )

    def get_summary(self) -> dict[str, Any]:
        """Return a summary of detection metrics."""
        all_rules = get_all_rules()
        enabled_count = sum(1 for r in all_rules if r.enabled)
        all_techniques = set()
        for r in all_rules:
            all_techniques.update(r.mitre_technique_ids)
        triggered_techniques = set(self.triggers_by_technique.keys())
        return {
            "total_evaluations": self.total_evaluations,
            "total_triggers": self.total_triggers,
            "rules_total": len(all_rules),
            "rules_enabled": enabled_count,
            "triggers_by_rule": dict(self.triggers_by_rule),
            "triggers_by_technique": dict(self.triggers_by_technique),
            "technique_coverage": {
                "total": len(all_techniques),
                "triggered": len(triggered_techniques),
                "gaps": sorted(all_techniques - triggered_techniques),
            },
        }

    def reset(self) -> None:
        self.triggers_by_rule.clear()
        self.triggers_by_technique.clear()
        self.total_evaluations = 0
        self.total_triggers = 0


# Module-level singleton
detection_metrics = DetectionMetrics()
