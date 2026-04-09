from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from uuid import uuid4

from app.models import Incident, utc_now
from app.store import InMemoryStore


CREDENTIAL_TYPES = {"credential_abuse", "credential_compromise"}
DATA_TYPES = {"data_exfiltration"}
SESSION_TYPES = {"session_hijack"}

CAMPAIGN_TYPE_NAMES = {
    "credential_campaign": "Credential Abuse Campaign",
    "exfiltration_campaign": "Data Exfiltration Campaign",
    "session_campaign": "Session Hijack Campaign",
    "multi_vector_campaign": "Multi-Vector Campaign",
}

TEMPORAL_WINDOW = timedelta(minutes=60)


@dataclass
class Campaign:
    campaign_id: str
    campaign_name: str
    campaign_type: str
    incident_correlation_ids: list[str] = field(default_factory=list)
    shared_actors: list[str] = field(default_factory=list)
    shared_ttps: list[str] = field(default_factory=list)
    severity: str = "medium"
    confidence: str = "medium"
    first_seen: datetime = field(default_factory=utc_now)
    last_seen: datetime = field(default_factory=utc_now)
    summary: str = ""


class CampaignDetectionService:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self._campaigns: dict[str, Campaign] = {}

    def detect_campaigns(self) -> list[Campaign]:
        """Scan all incidents and group them into campaigns."""
        incidents = list(self.store.incidents_by_correlation.values())
        if len(incidents) < 2:
            return []

        campaign_groups: list[set[str]] = []

        # 1. Shared actors: group incidents by primary_actor_id
        actor_to_correlations: defaultdict[str, list[str]] = defaultdict(list)
        for incident in incidents:
            actor_to_correlations[incident.primary_actor_id].append(
                incident.correlation_id
            )
        for actor_id, correlation_ids in actor_to_correlations.items():
            if len(correlation_ids) >= 2:
                campaign_groups.append(set(correlation_ids))

        # 2. Shared TTPs: group incidents with overlapping detection_ids
        for i in range(len(incidents)):
            for j in range(i + 1, len(incidents)):
                rules_i = set(incidents[i].detection_ids)
                rules_j = set(incidents[j].detection_ids)
                if rules_i & rules_j:
                    campaign_groups.append(
                        {incidents[i].correlation_id, incidents[j].correlation_id}
                    )

        # 3. Temporal proximity: incidents within the time window
        for i in range(len(incidents)):
            for j in range(i + 1, len(incidents)):
                if (
                    abs(incidents[i].created_at - incidents[j].created_at)
                    <= TEMPORAL_WINDOW
                ):
                    campaign_groups.append(
                        {incidents[i].correlation_id, incidents[j].correlation_id}
                    )

        # Merge overlapping groups
        merged = self._merge_groups(campaign_groups)

        # Build campaigns
        self._campaigns.clear()
        correlation_to_incident: dict[str, Incident] = {
            inc.correlation_id: inc for inc in incidents
        }

        campaigns: list[Campaign] = []
        for group in merged:
            if len(group) < 2:
                continue

            group_incidents = [
                correlation_to_incident[cid]
                for cid in group
                if cid in correlation_to_incident
            ]
            if len(group_incidents) < 2:
                continue

            # Determine shared actors
            actor_counts: defaultdict[str, int] = defaultdict(int)
            for inc in group_incidents:
                actor_counts[inc.primary_actor_id] += 1
            shared_actors = sorted(
                actor for actor, count in actor_counts.items() if count >= 2
            )

            # Determine shared TTPs (rule_ids that appear in multiple incidents)
            rule_counts: defaultdict[str, int] = defaultdict(int)
            for inc in group_incidents:
                for rule_id in set(inc.detection_ids):
                    rule_counts[rule_id] += 1
            shared_ttps = sorted(
                rule for rule, count in rule_counts.items() if count >= 2
            )

            # Classify campaign type
            incident_types = {inc.incident_type for inc in group_incidents}
            campaign_type = self._classify_campaign(incident_types)
            campaign_name = CAMPAIGN_TYPE_NAMES.get(campaign_type, "Unknown Campaign")

            # Determine severity (take the highest across incidents)
            severity_order = ["informational", "low", "medium", "high", "critical"]
            max_severity = "medium"
            for inc in group_incidents:
                if severity_order.index(inc.severity.value) > severity_order.index(
                    max_severity
                ):
                    max_severity = inc.severity.value

            # Determine confidence
            confidence_order = ["low", "medium", "high"]
            max_confidence = "medium"
            for inc in group_incidents:
                if confidence_order.index(
                    inc.confidence.value
                ) > confidence_order.index(max_confidence):
                    max_confidence = inc.confidence.value

            # Determine time bounds
            timestamps = [inc.created_at for inc in group_incidents]
            first_seen = min(timestamps)
            last_seen = max(timestamps)

            # Build summary
            correlation_ids = sorted(group)
            summary = (
                f"{campaign_name} involving {len(group_incidents)} incidents"
                f" across {len(set(inc.primary_actor_id for inc in group_incidents))} actor(s)."
            )

            campaign = Campaign(
                campaign_id=str(uuid4()),
                campaign_name=campaign_name,
                campaign_type=campaign_type,
                incident_correlation_ids=correlation_ids,
                shared_actors=shared_actors,
                shared_ttps=shared_ttps,
                severity=max_severity,
                confidence=max_confidence,
                first_seen=first_seen,
                last_seen=last_seen,
                summary=summary,
            )
            campaigns.append(campaign)
            self._campaigns[campaign.campaign_id] = campaign

        return campaigns

    def get_campaign(self, campaign_id: str) -> Campaign | None:
        return self._campaigns.get(campaign_id)

    def get_campaigns_for_actor(self, actor_id: str) -> list[Campaign]:
        results: list[Campaign] = []
        for campaign in self._campaigns.values():
            # Check if the actor is involved in any of the campaign's incidents
            for correlation_id in campaign.incident_correlation_ids:
                incident = self.store.incidents_by_correlation.get(correlation_id)
                if incident is not None and incident.primary_actor_id == actor_id:
                    results.append(campaign)
                    break
        return results

    def to_dict(self, campaign: Campaign) -> dict:
        """Serialize a Campaign to a dict."""
        return {
            "campaign_id": campaign.campaign_id,
            "campaign_name": campaign.campaign_name,
            "campaign_type": campaign.campaign_type,
            "incident_correlation_ids": campaign.incident_correlation_ids,
            "shared_actors": campaign.shared_actors,
            "shared_ttps": campaign.shared_ttps,
            "severity": campaign.severity,
            "confidence": campaign.confidence,
            "first_seen": campaign.first_seen.isoformat(),
            "last_seen": campaign.last_seen.isoformat(),
            "summary": campaign.summary,
        }

    @staticmethod
    def _classify_campaign(incident_types: set[str]) -> str:
        if incident_types and incident_types <= CREDENTIAL_TYPES:
            return "credential_campaign"
        if incident_types and incident_types <= DATA_TYPES:
            return "exfiltration_campaign"
        if incident_types and incident_types <= SESSION_TYPES:
            return "session_campaign"
        return "multi_vector_campaign"

    @staticmethod
    def _merge_groups(groups: list[set[str]]) -> list[set[str]]:
        """Merge overlapping sets using union-find style merging."""
        if not groups:
            return []

        merged: list[set[str]] = []
        for group in groups:
            new_merged: list[set[str]] = []
            current = set(group)
            for existing in merged:
                if current & existing:
                    current |= existing
                else:
                    new_merged.append(existing)
            new_merged.append(current)
            merged = new_merged

        return merged
