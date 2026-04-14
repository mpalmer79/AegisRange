"""Security audit logging for AegisRange.

Provides a structured, immutable audit trail for security-relevant
events.  All entries are timestamped, categorized, and include a
correlation ID for traceability.

The audit log uses a dedicated logger (``aegisrange.audit``) so it
can be routed to a separate sink (file, SIEM) independently of
application logs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger("aegisrange.audit")


class AuditCategory(str, Enum):
    AUTH = "auth"
    ACCESS = "access"
    MUTATION = "mutation"
    ADMIN = "admin"
    RATE_LIMIT = "rate_limit"
    DETECTION = "detection"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log(
    category: AuditCategory,
    action: str,
    *,
    outcome: str = "success",
    actor: str | None = None,
    target: str | None = None,
    correlation_id: str | None = None,
    client_ip: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Write a structured audit log entry.

    All fields are included as structured ``extra`` data so JSON
    log formatters preserve them as searchable fields.
    """
    extra: dict[str, Any] = {
        "audit": True,
        "audit_category": category.value,
        "audit_action": action,
        "audit_outcome": outcome,
        "audit_timestamp": _now_iso(),
    }
    if actor:
        extra["audit_actor"] = actor
    if target:
        extra["audit_target"] = target
    if correlation_id:
        extra["audit_correlation_id"] = correlation_id
    if client_ip:
        extra["audit_client_ip"] = client_ip
    if details:
        extra["audit_details"] = details

    logger.info(
        "AUDIT: %s.%s outcome=%s actor=%s",
        category.value,
        action,
        outcome,
        actor or "-",
        extra=extra,
    )


# ---------------------------------------------------------------------------
# Convenience functions for common audit events
# ---------------------------------------------------------------------------


def log_login_attempt(
    username: str,
    success: bool,
    client_ip: str | None = None,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.AUTH,
        "login_attempt",
        outcome="success" if success else "failure",
        actor=username,
        client_ip=client_ip,
        correlation_id=correlation_id,
    )


def log_logout(
    username: str | None = None,
    jti: str | None = None,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.AUTH,
        "logout",
        actor=username,
        details={"jti": jti} if jti else None,
        correlation_id=correlation_id,
    )


def log_token_rejected(
    reason: str,
    client_ip: str | None = None,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.AUTH,
        "token_rejected",
        outcome="failure",
        client_ip=client_ip,
        correlation_id=correlation_id,
        details={"reason": reason},
    )


def log_role_access(
    username: str,
    role: str,
    endpoint: str,
    granted: bool,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.ACCESS,
        "role_check",
        outcome="granted" if granted else "denied",
        actor=username,
        target=endpoint,
        correlation_id=correlation_id,
        details={"role": role},
    )


def log_incident_mutation(
    correlation_id: str,
    action: str,
    actor: str,
    details: dict[str, Any] | None = None,
) -> None:
    _log(
        AuditCategory.MUTATION,
        action,
        actor=actor,
        target=correlation_id,
        correlation_id=correlation_id,
        details=details,
    )


def log_scenario_execution(
    scenario_id: str,
    actor: str,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.MUTATION,
        "scenario_execution",
        actor=actor,
        target=scenario_id,
        correlation_id=correlation_id,
    )


def log_admin_action(
    action: str,
    actor: str,
    correlation_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    _log(
        AuditCategory.ADMIN,
        action,
        actor=actor,
        correlation_id=correlation_id,
        details=details,
    )


def log_rate_limit_exceeded(
    client_ip: str,
    path: str,
    tier: str,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.RATE_LIMIT,
        "limit_exceeded",
        outcome="blocked",
        client_ip=client_ip,
        target=path,
        correlation_id=correlation_id,
        details={"tier": tier},
    )


def log_account_lockout(
    username: str,
    remaining_seconds: int,
    client_ip: str | None = None,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.AUTH,
        "account_lockout",
        outcome="blocked",
        actor=username,
        client_ip=client_ip,
        correlation_id=correlation_id,
        details={"remaining_seconds": remaining_seconds},
    )


def log_csrf_failure(
    path: str,
    method: str,
    client_ip: str | None = None,
    correlation_id: str | None = None,
) -> None:
    _log(
        AuditCategory.AUTH,
        "csrf_validation_failed",
        outcome="blocked",
        client_ip=client_ip,
        target=path,
        correlation_id=correlation_id,
        details={"method": method},
    )


def log_detection_rule_change(
    rule_id: str,
    action: str,
    actor: str,
    details: dict[str, Any] | None = None,
) -> None:
    _log(
        AuditCategory.DETECTION,
        action,
        actor=actor,
        target=rule_id,
        details=details,
    )


def log_detection_triggered(
    rule_id: str,
    rule_version: str,
    actor_id: str,
    correlation_id: str,
    severity: str,
) -> None:
    _log(
        AuditCategory.DETECTION,
        "rule_triggered",
        actor=actor_id,
        target=rule_id,
        correlation_id=correlation_id,
        details={"rule_version": rule_version, "severity": severity},
    )
