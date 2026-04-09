"""Analytics routes (risk profiles, rule effectiveness, scenario history)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import require_role, risk_service
from app.serializers import risk_profile_to_dict
from app.store import STORE

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/risk-profiles", dependencies=[Depends(require_role("analyst"))])
def get_risk_profiles() -> list[dict]:
    profiles = risk_service.get_all_profiles()
    return [risk_profile_to_dict(p) for p in profiles]


@router.get(
    "/risk-profiles/{actor_id}", dependencies=[Depends(require_role("analyst"))]
)
def get_risk_profile(actor_id: str) -> dict:
    profile = risk_service.get_profile(actor_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Risk profile not found")
    return risk_profile_to_dict(profile)


@router.get("/rule-effectiveness", dependencies=[Depends(require_role("analyst"))])
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
