from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.store import InMemoryStore


KILL_CHAIN_STAGES = [
    "reconnaissance",
    "weaponization",
    "delivery",
    "exploitation",
    "installation",
    "command_and_control",
    "actions_on_objectives",
]

STAGE_DISPLAY_NAMES = {
    "reconnaissance": "Reconnaissance",
    "weaponization": "Weaponization",
    "delivery": "Delivery",
    "exploitation": "Exploitation",
    "installation": "Installation",
    "command_and_control": "Command and Control",
    "actions_on_objectives": "Actions on Objectives",
}

STAGE_DESCRIPTIONS = {
    "reconnaissance": "Attacker identifies and selects targets.",
    "weaponization": "Attacker creates a deliverable payload.",
    "delivery": "Attacker transmits the weapon to the target environment.",
    "exploitation": "Attacker exploits a vulnerability to gain access.",
    "installation": "Attacker installs persistent access mechanisms.",
    "command_and_control": "Attacker establishes a command channel for remote control.",
    "actions_on_objectives": "Attacker achieves their intended goals.",
}

RULE_TO_STAGE: dict[str, str] = {
    "DET-AUTH-001": "delivery",
    "DET-AUTH-002": "exploitation",
    "DET-SESSION-003": "command_and_control",
    "DET-DOC-004": "actions_on_objectives",
    "DET-DOC-005": "actions_on_objectives",
    "DET-DOC-006": "actions_on_objectives",
    "DET-SVC-007": "exploitation",
    "DET-ART-008": "delivery",
    "DET-POL-009": "installation",
    "DET-CORR-010": "actions_on_objectives",
}


@dataclass
class KillChainStage:
    name: str
    display_name: str
    description: str
    order: int
    detected: bool = False
    detection_rule_ids: list[str] = field(default_factory=list)
    first_seen: datetime | None = None


@dataclass
class KillChainAnalysis:
    incident_id: str
    correlation_id: str
    actor_id: str
    stages: list[KillChainStage] = field(default_factory=list)
    progression_percentage: float = 0.0
    highest_stage: str = "reconnaissance"
    first_activity: datetime | None = None
    last_activity: datetime | None = None


class KillChainService:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def analyze_incident(self, correlation_id: str) -> KillChainAnalysis | None:
        """Analyze an incident's kill chain progression by looking at its detection_ids and mapping them to stages."""
        incident = self.store.incidents_by_correlation.get(correlation_id)
        if incident is None:
            return None

        # Build fresh stages list
        stages: list[KillChainStage] = []
        for order, stage_name in enumerate(KILL_CHAIN_STAGES):
            stages.append(
                KillChainStage(
                    name=stage_name,
                    display_name=STAGE_DISPLAY_NAMES[stage_name],
                    description=STAGE_DESCRIPTIONS[stage_name],
                    order=order,
                )
            )

        stage_by_name: dict[str, KillChainStage] = {s.name: s for s in stages}

        # Map each detection rule to a kill chain stage
        for rule_id in incident.detection_ids:
            stage_name = RULE_TO_STAGE.get(rule_id)
            if stage_name is None:
                continue
            stage = stage_by_name[stage_name]
            if rule_id not in stage.detection_rule_ids:
                stage.detection_rule_ids.append(rule_id)
            if not stage.detected:
                stage.detected = True

        # Determine first_seen per stage from the incident timeline
        for entry in incident.timeline:
            if entry.entry_type != "detection":
                continue
            # Timeline summary is formatted as "RULE-ID: summary text"
            for rule_id, stage_name in RULE_TO_STAGE.items():
                if entry.summary.startswith(rule_id):
                    stage = stage_by_name[stage_name]
                    if stage.first_seen is None or entry.timestamp < stage.first_seen:
                        stage.first_seen = entry.timestamp
                    break

        # Calculate progression
        detected_stages = [s for s in stages if s.detected]
        detected_count = len(detected_stages)
        total_count = len(stages)
        progression_percentage = round((detected_count / total_count) * 100, 1) if total_count > 0 else 0.0

        # Determine highest stage (latest in the kill chain that was detected)
        highest_stage = KILL_CHAIN_STAGES[0]
        for stage in stages:
            if stage.detected:
                highest_stage = stage.name

        # Determine first and last activity timestamps across all detected stages
        first_activity: datetime | None = None
        last_activity: datetime | None = None
        for stage in detected_stages:
            if stage.first_seen is not None:
                if first_activity is None or stage.first_seen < first_activity:
                    first_activity = stage.first_seen
                if last_activity is None or stage.first_seen > last_activity:
                    last_activity = stage.first_seen

        return KillChainAnalysis(
            incident_id=incident.incident_id,
            correlation_id=correlation_id,
            actor_id=incident.primary_actor_id,
            stages=stages,
            progression_percentage=progression_percentage,
            highest_stage=highest_stage,
            first_activity=first_activity,
            last_activity=last_activity,
        )

    def analyze_all_incidents(self) -> list[KillChainAnalysis]:
        """Kill chain analysis for all incidents."""
        analyses: list[KillChainAnalysis] = []
        for correlation_id in self.store.incidents_by_correlation:
            analysis = self.analyze_incident(correlation_id)
            if analysis is not None:
                analyses.append(analysis)
        return analyses

    def get_stage_mapping(self, rule_id: str) -> str:
        """Get kill chain stage for a detection rule."""
        return RULE_TO_STAGE.get(rule_id, "unknown")

    def to_dict(self, analysis: KillChainAnalysis) -> dict:
        """Serialize a KillChainAnalysis to a dict."""
        return {
            "incident_id": analysis.incident_id,
            "correlation_id": analysis.correlation_id,
            "actor_id": analysis.actor_id,
            "stages": [
                {
                    "name": stage.name,
                    "display_name": stage.display_name,
                    "description": stage.description,
                    "order": stage.order,
                    "detected": stage.detected,
                    "detection_rule_ids": stage.detection_rule_ids,
                    "first_seen": stage.first_seen.isoformat() if stage.first_seen else None,
                }
                for stage in analysis.stages
            ],
            "progression_percentage": analysis.progression_percentage,
            "highest_stage": analysis.highest_stage,
            "first_activity": analysis.first_activity.isoformat() if analysis.first_activity else None,
            "last_activity": analysis.last_activity.isoformat() if analysis.last_activity else None,
        }
