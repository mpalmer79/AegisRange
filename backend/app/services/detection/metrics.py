"""Detection metrics collector (Phase 8).

Tracks per-rule trigger counts and per-technique coverage. A single
module-level singleton (``detection_metrics``) is shared by the
detection service and the analytics endpoints.
"""

from __future__ import annotations

from typing import Any

from .base import DetectionRule
from .rules import get_all_rules


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
