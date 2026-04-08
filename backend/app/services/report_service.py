from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from app.models import Severity
from app.services.killchain_service import RULE_TO_STAGE, STAGE_DISPLAY_NAMES
from app.store import InMemoryStore

ALL_DETECTION_RULES: dict[str, str] = {
    "DET-AUTH-001": "Repeated Authentication Failure Burst",
    "DET-AUTH-002": "Suspicious Success After Failure Sequence",
    "DET-SESSION-003": "Token Reuse From Conflicting Origins",
    "DET-DOC-004": "Restricted Document Access Outside Role Scope",
    "DET-DOC-005": "Abnormal Bulk Document Access",
    "DET-DOC-006": "Read-To-Download Staging Pattern",
    "DET-SVC-007": "Unauthorized Service Identity Route Access",
    "DET-ART-008": "Artifact Validation Failure Pattern",
    "DET-POL-009": "Privileged Policy Change With Elevated Risk Context",
    "DET-CORR-010": "Multi-Signal Compromise Sequence",
}

MITRE_RULE_MAPPING: dict[str, dict[str, str]] = {
    "DET-AUTH-001": {"tactic": "Credential Access", "technique": "T1110 - Brute Force"},
    "DET-AUTH-002": {"tactic": "Initial Access", "technique": "T1078 - Valid Accounts"},
    "DET-SESSION-003": {"tactic": "Lateral Movement", "technique": "T1550 - Use Alternate Authentication Material"},
    "DET-DOC-004": {"tactic": "Collection", "technique": "T1213 - Data from Information Repositories"},
    "DET-DOC-005": {"tactic": "Collection", "technique": "T1119 - Automated Collection"},
    "DET-DOC-006": {"tactic": "Exfiltration", "technique": "T1041 - Exfiltration Over C2 Channel"},
    "DET-SVC-007": {"tactic": "Privilege Escalation", "technique": "T1068 - Exploitation for Privilege Escalation"},
    "DET-ART-008": {"tactic": "Defense Evasion", "technique": "T1036 - Masquerading"},
    "DET-POL-009": {"tactic": "Persistence", "technique": "T1098 - Account Manipulation"},
    "DET-CORR-010": {"tactic": "Impact", "technique": "T1486 - Data Encrypted for Impact"},
}

CONTAINMENT_ACTION_TYPES: set[str] = {
    "session_revocation",
    "download_restriction",
    "download_block",
    "service_disabled",
    "artifact_quarantine",
    "policy_change_restricted",
    "multi_signal_containment",
    "step_up_authentication",
    "rate_limit",
    "access_denied",
}


@dataclass
class ExerciseReport:
    report_id: str
    title: str
    generated_at: datetime
    exercise_window: dict
    summary: dict
    scenario_results: list[dict]
    detection_coverage: dict
    response_effectiveness: dict
    risk_summary: dict
    recommendations: list[str]
    mitre_coverage: dict


class ReportService:
    """Generates comprehensive exercise reports for purple team exercises."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def generate_report(self, title: str = "AegisRange Exercise Report") -> ExerciseReport:
        """Generate a comprehensive report by analyzing all data in the store."""
        now = datetime.utcnow()

        # Determine exercise window from event timestamps
        exercise_window = self._calculate_exercise_window()

        # Gather scenario results
        scenario_results = self._build_scenario_results()

        # Calculate detection coverage
        detection_coverage = self._calculate_detection_coverage()

        # Calculate response effectiveness
        response_effectiveness = self._calculate_response_effectiveness()

        # Calculate risk summary
        risk_summary = self._calculate_risk_summary()

        # Generate recommendations
        recommendations = self._generate_recommendations(detection_coverage, response_effectiveness)

        # Calculate MITRE coverage
        mitre_coverage = self._calculate_mitre_coverage()

        # Build summary
        summary = {
            "total_events": len(self.store.events),
            "total_alerts": len(self.store.alerts),
            "total_incidents": len(self.store.incidents_by_correlation),
            "total_responses": len(self.store.responses),
            "scenarios_executed": len(self.store.scenario_history),
        }

        return ExerciseReport(
            report_id=str(uuid4()),
            title=title,
            generated_at=now,
            exercise_window=exercise_window,
            summary=summary,
            scenario_results=scenario_results,
            detection_coverage=detection_coverage,
            response_effectiveness=response_effectiveness,
            risk_summary=risk_summary,
            recommendations=recommendations,
            mitre_coverage=mitre_coverage,
        )

    def to_dict(self, report: ExerciseReport) -> dict:
        """Full serialization of an ExerciseReport to a dict."""
        return {
            "report_id": report.report_id,
            "title": report.title,
            "generated_at": report.generated_at.isoformat(),
            "exercise_window": report.exercise_window,
            "summary": report.summary,
            "scenario_results": report.scenario_results,
            "detection_coverage": report.detection_coverage,
            "response_effectiveness": report.response_effectiveness,
            "risk_summary": report.risk_summary,
            "recommendations": report.recommendations,
            "mitre_coverage": report.mitre_coverage,
        }

    def _calculate_exercise_window(self) -> dict:
        """Determine the exercise time window from event timestamps."""
        if not self.store.events:
            now = datetime.utcnow()
            return {"start": now.isoformat(), "end": now.isoformat()}

        timestamps = [e.timestamp for e in self.store.events]
        return {
            "start": min(timestamps).isoformat(),
            "end": max(timestamps).isoformat(),
        }

    def _build_scenario_results(self) -> list[dict]:
        """Build per-scenario results from scenario history and store data."""
        results: list[dict] = []

        for entry in self.store.scenario_history:
            scenario_id = entry.get("scenario_id", "unknown")
            correlation_id = entry.get("correlation_id", "")

            # Count events for this scenario
            scenario_events = [
                e for e in self.store.events if e.correlation_id == correlation_id
            ]
            events_generated = len(scenario_events)

            # Count alerts for this scenario
            scenario_alerts = [
                a for a in self.store.alerts if a.correlation_id == correlation_id
            ]
            alerts_triggered = len(scenario_alerts)

            # Count responses for this scenario
            scenario_responses = [
                r for r in self.store.responses if r.correlation_id == correlation_id
            ]
            responses_executed = len(scenario_responses)

            # Collect detection rules fired
            detection_rules_fired = sorted({a.rule_id for a in scenario_alerts})

            # Determine kill chain stages reached
            kill_chain_stages_reached: list[str] = []
            seen_stages: set[str] = set()
            for rule_id in detection_rules_fired:
                stage_key = RULE_TO_STAGE.get(rule_id)
                if stage_key and stage_key not in seen_stages:
                    seen_stages.add(stage_key)
                    kill_chain_stages_reached.append(
                        STAGE_DISPLAY_NAMES.get(stage_key, stage_key)
                    )

            results.append({
                "scenario_id": scenario_id,
                "correlation_id": correlation_id,
                "events_generated": events_generated,
                "alerts_triggered": alerts_triggered,
                "responses_executed": responses_executed,
                "detection_rules_fired": detection_rules_fired,
                "kill_chain_stages_reached": kill_chain_stages_reached,
            })

        return results

    def _calculate_detection_coverage(self) -> dict:
        """Count which of the 10 detection rules actually fired."""
        rule_trigger_counts: dict[str, int] = {}
        for alert in self.store.alerts:
            rule_trigger_counts[alert.rule_id] = (
                rule_trigger_counts.get(alert.rule_id, 0) + 1
            )

        rules_list: list[dict] = []
        for rule_id, rule_name in ALL_DETECTION_RULES.items():
            rules_list.append({
                "rule_id": rule_id,
                "rule_name": rule_name,
                "trigger_count": rule_trigger_counts.get(rule_id, 0),
            })

        rules_triggered = sum(1 for r in rules_list if r["trigger_count"] > 0)

        return {
            "rules_total": 10,
            "rules_triggered": rules_triggered,
            "rules_list": rules_list,
        }

    def _calculate_response_effectiveness(self) -> dict:
        """Analyze response actions for effectiveness metrics."""
        total_responses = len(self.store.responses)

        containment_actions = sum(
            1 for r in self.store.responses
            if r.action_type in CONTAINMENT_ACTION_TYPES
        )

        unique_playbooks = len({r.playbook_id for r in self.store.responses})

        return {
            "total_responses": total_responses,
            "containment_actions": containment_actions,
            "unique_playbooks": unique_playbooks,
        }

    def _calculate_risk_summary(self) -> dict:
        """Summarize risk profiles across all actors."""
        profiles = self.store.risk_profiles

        if not profiles:
            return {
                "actors_assessed": 0,
                "highest_risk_actor": None,
                "average_risk_score": 0.0,
            }

        actors_assessed = len(profiles)
        scores = [(actor_id, p.current_score) for actor_id, p in profiles.items()]
        highest_risk_actor = max(scores, key=lambda x: x[1])[0] if scores else None
        average_risk_score = round(
            sum(s for _, s in scores) / len(scores), 2
        ) if scores else 0.0

        return {
            "actors_assessed": actors_assessed,
            "highest_risk_actor": highest_risk_actor,
            "average_risk_score": average_risk_score,
        }

    def _generate_recommendations(
        self,
        detection_coverage: dict,
        response_effectiveness: dict,
    ) -> list[str]:
        """Generate actionable recommendations based on gaps."""
        recommendations: list[str] = []

        # Check for detection rules that never fired
        for rule in detection_coverage.get("rules_list", []):
            if rule["trigger_count"] == 0:
                recommendations.append(
                    f"Detection gap: {rule['rule_name']} ({rule['rule_id']}) was never triggered. "
                    f"Consider adding scenarios that exercise this rule."
                )

        # Check for lack of high/critical incidents
        has_high_severity = any(
            inc.severity in (Severity.HIGH, Severity.CRITICAL)
            for inc in self.store.incidents_by_correlation.values()
        )
        if not has_high_severity:
            recommendations.append(
                "No high-severity incidents detected. Consider running adversary "
                "scenarios with elevated attack sophistication."
            )

        # Check containment rate
        total_responses = response_effectiveness.get("total_responses", 0)
        containment_actions = response_effectiveness.get("containment_actions", 0)
        if total_responses > 0:
            containment_rate = containment_actions / total_responses
            if containment_rate < 0.5:
                recommendations.append(
                    "Response coverage is limited. Review playbook configurations "
                    "for broader containment."
                )
        elif total_responses == 0 and len(self.store.alerts) > 0:
            recommendations.append(
                "Response coverage is limited. Review playbook configurations "
                "for broader containment."
            )

        # Check risk scores
        all_zero = all(
            p.current_score == 0
            for p in self.store.risk_profiles.values()
        )
        if not self.store.risk_profiles or all_zero:
            recommendations.append(
                "Risk scoring shows no elevated actors. Verify risk scoring "
                "integration with the detection pipeline."
            )

        # Always include ATT&CK coverage recommendation
        recommendations.append(
            "Review ATT&CK coverage matrix for gaps in adversary technique detection."
        )

        return recommendations

    def _calculate_mitre_coverage(self) -> dict:
        """Calculate MITRE ATT&CK coverage based on triggered detection rules."""
        triggered_rules: set[str] = {a.rule_id for a in self.store.alerts}

        tactics_covered: set[str] = set()
        techniques_covered: set[str] = set()

        for rule_id in triggered_rules:
            mapping = MITRE_RULE_MAPPING.get(rule_id)
            if mapping:
                tactics_covered.add(mapping["tactic"])
                techniques_covered.add(mapping["technique"])

        total_tactics = len({m["tactic"] for m in MITRE_RULE_MAPPING.values()})
        total_techniques = len({m["technique"] for m in MITRE_RULE_MAPPING.values()})

        coverage_percentage = round(
            (len(techniques_covered) / total_techniques) * 100, 1
        ) if total_techniques > 0 else 0.0

        return {
            "tactics_covered": sorted(tactics_covered),
            "techniques_covered": sorted(techniques_covered),
            "coverage_percentage": coverage_percentage,
        }
