"""Detection rule evaluate functions and registry.

All ten built-in detection rules (DET-AUTH-001 through DET-CORR-010)
live here along with the module-level ``RULE_REGISTRY``. Rules are
registered at import time; the detection service iterates enabled
rules for each incoming event.
"""

from __future__ import annotations

from datetime import timedelta

from app.models import Alert, Confidence, Event, Severity

from .base import DetectionRule, RuleContext, _build_alert


# ---------------------------------------------------------------------------
# Rule evaluation functions
# ---------------------------------------------------------------------------


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
