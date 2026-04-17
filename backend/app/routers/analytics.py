"""Analytics routes (risk profiles, rule effectiveness, scenario history,
MTTD/MTTR, actor risk trajectories, alert disposition, coverage)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import analytics_service, require_role, risk_service
from app.schemas import RiskProfileResponse, RuleEffectivenessResponse
from app.serializers import risk_profile_to_dict
from app.store import STORE

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    responses={401: {"description": "Missing or invalid token"}},
)


@router.get(
    "/risk-profiles",
    response_model=list[RiskProfileResponse],
    dependencies=[Depends(require_role("analyst"))],
)
def get_risk_profiles() -> list[dict]:
    profiles = risk_service.get_all_profiles()
    return [risk_profile_to_dict(p) for p in profiles]


@router.get(
    "/risk-profiles/{actor_id}",
    response_model=RiskProfileResponse,
    dependencies=[Depends(require_role("analyst"))],
)
def get_risk_profile(actor_id: str) -> dict:
    profile = risk_service.get_profile(actor_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Risk profile not found")
    return risk_profile_to_dict(profile)


@router.get(
    "/rule-effectiveness",
    response_model=list[RuleEffectivenessResponse],
    dependencies=[Depends(require_role("analyst"))],
)
def get_rule_effectiveness() -> list[dict]:
    rule_counts: dict[str, dict] = {}
    for alert in STORE.get_alerts():
        if alert.rule_id not in rule_counts:
            rule_counts[alert.rule_id] = {
                "rule_id": alert.rule_id,
                "rule_name": alert.rule_name,
                "trigger_count": 0,
                "severity": alert.severity.value,
                "actors_affected": set(),
            }
        rule_counts[alert.rule_id]["trigger_count"] += 1
        rule_counts[alert.rule_id]["actors_affected"].add(alert.actor_id)

    return [
        {**v, "actors_affected": len(v["actors_affected"])}
        for v in sorted(
            rule_counts.values(), key=lambda x: x["trigger_count"], reverse=True
        )
    ]


@router.get("/scenario-history", dependencies=[Depends(require_role("analyst"))])
def get_scenario_history() -> list[dict]:
    return STORE.get_scenario_history_entries()


# ---------------------------------------------------------------------------
# 0.10.0 additions — MTTD/MTTR, risk trajectories, disposition, coverage
# ---------------------------------------------------------------------------


@router.get(
    "/mttd-mttr",
    dependencies=[Depends(require_role("analyst"))],
)
def get_mttd_mttr() -> dict:
    """Platform-wide mean time to detect / respond / close, plus a
    per-incident breakdown. Aggregates only include correlations where
    both ends of the interval are present so in-flight investigations
    don't skew the mean."""
    return analytics_service.mttd_mttr_summary()


@router.get(
    "/risk-trajectory/{actor_id}",
    dependencies=[Depends(require_role("analyst"))],
)
def get_risk_trajectory(
    actor_id: str,
    since: str | None = Query(
        None,
        description=(
            "Optional ISO-8601 timestamp. When set, only history entries "
            "at or after this time are returned."
        ),
    ),
) -> dict:
    """Time-series of risk-score changes for an actor."""
    since_dt: datetime | None = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid 'since' timestamp: {exc}",
            ) from exc
    return analytics_service.risk_trajectory(actor_id, since=since_dt)


@router.get(
    "/alert-disposition",
    dependencies=[Depends(require_role("analyst"))],
)
def get_alert_disposition() -> dict:
    """Alerts-by-severity and incidents-by-status breakdown with a
    stale-investigation watchlist."""
    return analytics_service.alert_disposition_summary()


@router.get(
    "/coverage",
    dependencies=[Depends(require_role("analyst"))],
)
def get_coverage() -> dict:
    """Per-rule last-fired timestamp and a list of rules that have
    never fired against the current data."""
    return analytics_service.coverage_summary()
