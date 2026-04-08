from __future__ import annotations

from datetime import datetime
from dataclasses import dataclass, field

from app.models import Alert, Confidence, Severity
from app.store import InMemoryStore


@dataclass
class RiskProfile:
    actor_id: str
    current_score: int = 0
    peak_score: int = 0
    contributing_rules: list[str] = field(default_factory=list)
    score_history: list[dict] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.utcnow)


SEVERITY_WEIGHTS = {
    Severity.INFORMATIONAL: 0,
    Severity.LOW: 5,
    Severity.MEDIUM: 15,
    Severity.HIGH: 30,
    Severity.CRITICAL: 50,
}

CONFIDENCE_MULTIPLIERS = {
    Confidence.LOW: 0.5,
    Confidence.MEDIUM: 0.75,
    Confidence.HIGH: 1.0,
}


class RiskScoringService:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def update_risk(self, alert: Alert) -> RiskProfile:
        """Calculate and update actor risk based on a new alert."""
        profile = self.store.risk_profiles.get(alert.actor_id)
        if profile is None:
            profile = RiskProfile(actor_id=alert.actor_id)
            self.store.risk_profiles[alert.actor_id] = profile

        base_score = SEVERITY_WEIGHTS.get(alert.severity, 0)
        multiplier = CONFIDENCE_MULTIPLIERS.get(alert.confidence, 0.5)
        delta = int(base_score * multiplier)

        profile.current_score += delta
        if profile.current_score > profile.peak_score:
            profile.peak_score = profile.current_score
        if alert.rule_id not in profile.contributing_rules:
            profile.contributing_rules.append(alert.rule_id)
        profile.score_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "rule_id": alert.rule_id,
            "delta": delta,
            "new_score": profile.current_score,
        })
        profile.last_updated = datetime.utcnow()

        # Update incident risk_score if one exists
        for incident in self.store.incidents_by_correlation.values():
            if incident.primary_actor_id == alert.actor_id:
                incident.risk_score = profile.current_score

        return profile

    def get_profile(self, actor_id: str) -> RiskProfile | None:
        return self.store.risk_profiles.get(actor_id)

    def get_all_profiles(self) -> list[RiskProfile]:
        return sorted(
            self.store.risk_profiles.values(),
            key=lambda p: p.current_score,
            reverse=True,
        )
