from __future__ import annotations

from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MitreTactic:
    id: str
    name: str
    description: str
    url: str


@dataclass(frozen=True)
class MitreTechnique:
    id: str
    name: str
    description: str
    tactic_ids: list[str]
    url: str
    sub_techniques: list[MitreTechnique] = field(default_factory=list)


@dataclass(frozen=True)
class TTPMapping:
    rule_id: str
    technique_ids: list[str]
    tactic_ids: list[str]
    kill_chain_phases: list[str]


@dataclass(frozen=True)
class CoverageEntry:
    tactic_id: str
    technique_id: str
    rule_ids: list[str]
    scenario_ids: list[str]
    covered: bool


# ---------------------------------------------------------------------------
# ATT&CK knowledge-base constants (relevant subset)
# ---------------------------------------------------------------------------

_TACTICS: list[dict] = [
    {
        "id": "TA0001",
        "name": "Initial Access",
        "description": "The adversary is trying to get into your network.",
        "url": "https://attack.mitre.org/tactics/TA0001/",
    },
    {
        "id": "TA0003",
        "name": "Persistence",
        "description": "The adversary is trying to maintain their foothold.",
        "url": "https://attack.mitre.org/tactics/TA0003/",
    },
    {
        "id": "TA0004",
        "name": "Privilege Escalation",
        "description": "The adversary is trying to gain higher-level permissions.",
        "url": "https://attack.mitre.org/tactics/TA0004/",
    },
    {
        "id": "TA0005",
        "name": "Defense Evasion",
        "description": "The adversary is trying to avoid being detected.",
        "url": "https://attack.mitre.org/tactics/TA0005/",
    },
    {
        "id": "TA0006",
        "name": "Credential Access",
        "description": "The adversary is trying to steal account names and passwords.",
        "url": "https://attack.mitre.org/tactics/TA0006/",
    },
    {
        "id": "TA0008",
        "name": "Lateral Movement",
        "description": "The adversary is trying to move through your environment.",
        "url": "https://attack.mitre.org/tactics/TA0008/",
    },
    {
        "id": "TA0009",
        "name": "Collection",
        "description": "The adversary is trying to gather data of interest to their goal.",
        "url": "https://attack.mitre.org/tactics/TA0009/",
    },
    {
        "id": "TA0010",
        "name": "Exfiltration",
        "description": "The adversary is trying to steal data.",
        "url": "https://attack.mitre.org/tactics/TA0010/",
    },
]

# Techniques are keyed by their ID.  Sub-techniques reference the parent via
# their dotted ID notation (e.g. T1110.001 is a sub-technique of T1110).
_TECHNIQUES: list[dict] = [
    # --- TA0001 Initial Access ---
    {
        "id": "T1078",
        "name": "Valid Accounts",
        "description": "Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.",
        "tactic_ids": ["TA0001", "TA0003", "TA0004", "TA0005"],
        "url": "https://attack.mitre.org/techniques/T1078/",
        "sub_techniques": [
            {
                "id": "T1078.001",
                "name": "Default Accounts",
                "description": "Adversaries may obtain and abuse credentials of default accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.",
                "tactic_ids": ["TA0001", "TA0003", "TA0004", "TA0005"],
                "url": "https://attack.mitre.org/techniques/T1078/001/",
            },
            {
                "id": "T1078.003",
                "name": "Local Accounts",
                "description": "Adversaries may obtain and abuse credentials of a local account as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.",
                "tactic_ids": ["TA0001", "TA0003", "TA0004", "TA0005"],
                "url": "https://attack.mitre.org/techniques/T1078/003/",
            },
        ],
    },
    {
        "id": "T1195",
        "name": "Supply Chain Compromise",
        "description": "Adversaries may manipulate products or product delivery mechanisms prior to receipt by a final consumer for the purpose of data or system compromise.",
        "tactic_ids": ["TA0001"],
        "url": "https://attack.mitre.org/techniques/T1195/",
        "sub_techniques": [],
    },
    {
        "id": "T1566",
        "name": "Phishing",
        "description": "Adversaries may send phishing messages to gain access to victim systems.",
        "tactic_ids": ["TA0001"],
        "url": "https://attack.mitre.org/techniques/T1566/",
        "sub_techniques": [],
    },
    # --- TA0003 Persistence ---
    {
        "id": "T1098",
        "name": "Account Manipulation",
        "description": "Adversaries may manipulate accounts to maintain access to victim systems.",
        "tactic_ids": ["TA0003"],
        "url": "https://attack.mitre.org/techniques/T1098/",
        "sub_techniques": [],
    },
    {
        "id": "T1136",
        "name": "Create Account",
        "description": "Adversaries may create an account to maintain access to victim systems.",
        "tactic_ids": ["TA0003"],
        "url": "https://attack.mitre.org/techniques/T1136/",
        "sub_techniques": [],
    },
    # --- TA0004 Privilege Escalation ---
    {
        "id": "T1548",
        "name": "Abuse Elevation Control Mechanism",
        "description": "Adversaries may circumvent mechanisms designed to control elevated privileges to gain higher-level permissions.",
        "tactic_ids": ["TA0004", "TA0005"],
        "url": "https://attack.mitre.org/techniques/T1548/",
        "sub_techniques": [],
    },
    # --- TA0005 Defense Evasion ---
    {
        "id": "T1070",
        "name": "Indicator Removal",
        "description": "Adversaries may delete or modify artifacts generated within systems to remove evidence of their presence.",
        "tactic_ids": ["TA0005"],
        "url": "https://attack.mitre.org/techniques/T1070/",
        "sub_techniques": [],
    },
    {
        "id": "T1036",
        "name": "Masquerading",
        "description": "Adversaries may attempt to manipulate features of their artifacts to make them appear legitimate or benign to users and security tools.",
        "tactic_ids": ["TA0005"],
        "url": "https://attack.mitre.org/techniques/T1036/",
        "sub_techniques": [],
    },
    # --- TA0006 Credential Access ---
    {
        "id": "T1110",
        "name": "Brute Force",
        "description": "Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.",
        "tactic_ids": ["TA0006"],
        "url": "https://attack.mitre.org/techniques/T1110/",
        "sub_techniques": [
            {
                "id": "T1110.001",
                "name": "Password Guessing",
                "description": "Adversaries may guess passwords to attempt access to accounts when passwords are unknown or when password hashes are obtained.",
                "tactic_ids": ["TA0006"],
                "url": "https://attack.mitre.org/techniques/T1110/001/",
            },
            {
                "id": "T1110.003",
                "name": "Password Spraying",
                "description": "Adversaries may use a single or small list of commonly used passwords against many different accounts to attempt to acquire valid account credentials.",
                "tactic_ids": ["TA0006"],
                "url": "https://attack.mitre.org/techniques/T1110/003/",
            },
        ],
    },
    {
        "id": "T1556",
        "name": "Modify Authentication Process",
        "description": "Adversaries may modify authentication mechanisms and processes to access user credentials or enable otherwise unwarranted access to accounts.",
        "tactic_ids": ["TA0006", "TA0005"],
        "url": "https://attack.mitre.org/techniques/T1556/",
        "sub_techniques": [],
    },
    # --- TA0008 Lateral Movement ---
    {
        "id": "T1563",
        "name": "Remote Service Session Hijacking",
        "description": "Adversaries may take control of preexisting sessions with remote services to move laterally in an environment.",
        "tactic_ids": ["TA0008"],
        "url": "https://attack.mitre.org/techniques/T1563/",
        "sub_techniques": [],
    },
    {
        "id": "T1021",
        "name": "Remote Services",
        "description": "Adversaries may use Valid Accounts to log into a service specifically designed to accept remote connections.",
        "tactic_ids": ["TA0008"],
        "url": "https://attack.mitre.org/techniques/T1021/",
        "sub_techniques": [],
    },
    {
        "id": "T1550",
        "name": "Use Alternate Authentication Material",
        "description": "Adversaries may use alternate authentication material, such as password hashes, Kerberos tickets, and application access tokens, in order to move laterally.",
        "tactic_ids": ["TA0008"],
        "url": "https://attack.mitre.org/techniques/T1550/",
        "sub_techniques": [],
    },
    # --- TA0009 Collection ---
    {
        "id": "T1530",
        "name": "Data from Cloud Storage Object",
        "description": "Adversaries may access data from improperly secured cloud storage objects.",
        "tactic_ids": ["TA0009"],
        "url": "https://attack.mitre.org/techniques/T1530/",
        "sub_techniques": [],
    },
    {
        "id": "T1119",
        "name": "Automated Collection",
        "description": "Once established within a system or network, an adversary may use automated techniques for collecting internal data.",
        "tactic_ids": ["TA0009"],
        "url": "https://attack.mitre.org/techniques/T1119/",
        "sub_techniques": [],
    },
    {
        "id": "T1213",
        "name": "Data from Information Repositories",
        "description": "Adversaries may leverage information repositories to mine valuable information.",
        "tactic_ids": ["TA0009"],
        "url": "https://attack.mitre.org/techniques/T1213/",
        "sub_techniques": [],
    },
    # --- TA0010 Exfiltration ---
    {
        "id": "T1048",
        "name": "Exfiltration Over Alternative Protocol",
        "description": "Adversaries may steal data by exfiltrating it over a different protocol than that of the existing command and control channel.",
        "tactic_ids": ["TA0010"],
        "url": "https://attack.mitre.org/techniques/T1048/",
        "sub_techniques": [],
    },
    {
        "id": "T1041",
        "name": "Exfiltration Over C2 Channel",
        "description": "Adversaries may steal data by exfiltrating it over an existing command and control channel.",
        "tactic_ids": ["TA0010"],
        "url": "https://attack.mitre.org/techniques/T1041/",
        "sub_techniques": [],
    },
    {
        "id": "T1567",
        "name": "Exfiltration Over Web Service",
        "description": "Adversaries may use an existing, legitimate external Web service to exfiltrate data rather than their primary command and control channel.",
        "tactic_ids": ["TA0010"],
        "url": "https://attack.mitre.org/techniques/T1567/",
        "sub_techniques": [],
    },
]

# Kill-chain phase labels corresponding to each tactic.
_TACTIC_TO_KILL_CHAIN: dict[str, str] = {
    "TA0001": "initial-access",
    "TA0003": "persistence",
    "TA0004": "privilege-escalation",
    "TA0005": "defense-evasion",
    "TA0006": "credential-access",
    "TA0008": "lateral-movement",
    "TA0009": "collection",
    "TA0010": "exfiltration",
}

# Detection rule -> technique/tactic mappings.
_RULE_MAPPINGS: list[dict] = [
    {
        "rule_id": "DET-AUTH-001",
        "technique_ids": ["T1110"],
        "tactic_ids": ["TA0006"],
    },
    {
        "rule_id": "DET-AUTH-002",
        "technique_ids": ["T1110.001", "T1078"],
        "tactic_ids": ["TA0006", "TA0001"],
    },
    {
        "rule_id": "DET-SESSION-003",
        "technique_ids": ["T1563"],
        "tactic_ids": ["TA0008"],
    },
    {
        "rule_id": "DET-DOC-004",
        "technique_ids": ["T1078"],
        "tactic_ids": ["TA0005"],
    },
    {
        "rule_id": "DET-DOC-005",
        "technique_ids": ["T1530"],
        "tactic_ids": ["TA0009"],
    },
    {
        "rule_id": "DET-DOC-006",
        "technique_ids": ["T1048"],
        "tactic_ids": ["TA0010"],
    },
    {
        "rule_id": "DET-SVC-007",
        "technique_ids": ["T1078.001"],
        "tactic_ids": ["TA0003", "TA0004"],
    },
    {
        "rule_id": "DET-ART-008",
        "technique_ids": ["T1195"],
        "tactic_ids": ["TA0001"],
    },
    {
        "rule_id": "DET-POL-009",
        "technique_ids": ["T1098"],
        "tactic_ids": ["TA0003"],
    },
    {
        "rule_id": "DET-CORR-010",
        "technique_ids": ["T1110", "T1078", "T1530", "T1048"],
        "tactic_ids": ["TA0006", "TA0001", "TA0009", "TA0010"],
    },
]

# Scenario -> technique chains.
_SCENARIO_TECHNIQUES: dict[str, list[str]] = {
    "SCN-AUTH-001": ["T1110", "T1078"],
    "SCN-SESSION-002": ["T1563"],
    "SCN-DOC-003": ["T1530"],
    "SCN-DOC-004": ["T1530", "T1048"],
    "SCN-SVC-005": ["T1078.001"],
    "SCN-CORR-006": ["T1110", "T1078", "T1530", "T1048"],
}


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class MitreAttackService:
    """Maps AegisRange detection rules and adversary scenarios to the MITRE
    ATT&CK framework.  Maintains a hardcoded knowledge-base subset relevant
    to the platform's detection surface and exposes query helpers consumed
    by API routes and the scenario engine."""

    def __init__(self) -> None:
        # Hydrate tactic lookup.
        self._tactics: dict[str, MitreTactic] = {}
        for entry in _TACTICS:
            self._tactics[entry["id"]] = MitreTactic(
                id=entry["id"],
                name=entry["name"],
                description=entry["description"],
                url=entry["url"],
            )

        # Hydrate technique lookup (including sub-techniques promoted to
        # top-level entries so they are individually addressable).
        self._techniques: dict[str, MitreTechnique] = {}
        for entry in _TECHNIQUES:
            subs = [
                MitreTechnique(
                    id=s["id"],
                    name=s["name"],
                    description=s["description"],
                    tactic_ids=list(s["tactic_ids"]),
                    url=s["url"],
                    sub_techniques=[],
                )
                for s in entry.get("sub_techniques", [])
            ]
            technique = MitreTechnique(
                id=entry["id"],
                name=entry["name"],
                description=entry["description"],
                tactic_ids=list(entry["tactic_ids"]),
                url=entry["url"],
                sub_techniques=subs,
            )
            self._techniques[technique.id] = technique
            for sub in subs:
                self._techniques[sub.id] = sub

        # Build TTPMapping objects for every detection rule.
        self._rule_mappings: dict[str, TTPMapping] = {}
        for mapping in _RULE_MAPPINGS:
            tactic_ids = list(mapping["tactic_ids"])
            phases = sorted(
                {
                    _TACTIC_TO_KILL_CHAIN[tid]
                    for tid in tactic_ids
                    if tid in _TACTIC_TO_KILL_CHAIN
                }
            )
            self._rule_mappings[mapping["rule_id"]] = TTPMapping(
                rule_id=mapping["rule_id"],
                technique_ids=list(mapping["technique_ids"]),
                tactic_ids=tactic_ids,
                kill_chain_phases=phases,
            )

        # Build reverse indexes: technique -> rules, technique -> scenarios.
        self._technique_to_rules: dict[str, list[str]] = {}
        for rule_id, ttp in self._rule_mappings.items():
            for tid in ttp.technique_ids:
                self._technique_to_rules.setdefault(tid, []).append(rule_id)

        self._technique_to_scenarios: dict[str, list[str]] = {}
        for scenario_id, tech_ids in _SCENARIO_TECHNIQUES.items():
            for tid in tech_ids:
                self._technique_to_scenarios.setdefault(tid, []).append(scenario_id)

        # Pre-compute tactic -> technique membership from the knowledge base.
        self._tactic_technique_map: dict[str, list[str]] = {}
        for tech in self._techniques.values():
            for tactic_id in tech.tactic_ids:
                self._tactic_technique_map.setdefault(tactic_id, [])
                if tech.id not in self._tactic_technique_map[tactic_id]:
                    self._tactic_technique_map[tactic_id].append(tech.id)

    # ------------------------------------------------------------------
    # Public query interface
    # ------------------------------------------------------------------

    def get_mapping(self, rule_id: str) -> TTPMapping | None:
        """Return the TTP mapping for a single detection rule, or *None*
        if the rule is not mapped."""
        return self._rule_mappings.get(rule_id)

    def get_all_mappings(self) -> list[TTPMapping]:
        """Return every rule-to-TTP mapping in rule-id order."""
        return sorted(self._rule_mappings.values(), key=lambda m: m.rule_id)

    def get_coverage_matrix(self) -> list[CoverageEntry]:
        """Build the full ATT&CK coverage matrix.

        For every (tactic, technique) pair in the knowledge base, reports
        which detection rules and scenarios cover that technique and whether
        it is currently covered (at least one rule *or* scenario)."""
        matrix: list[CoverageEntry] = []
        for tactic_id in sorted(self._tactic_technique_map):
            for tech_id in sorted(self._tactic_technique_map[tactic_id]):
                rule_ids = sorted(self._technique_to_rules.get(tech_id, []))
                scenario_ids = sorted(self._technique_to_scenarios.get(tech_id, []))
                covered = bool(rule_ids or scenario_ids)
                matrix.append(
                    CoverageEntry(
                        tactic_id=tactic_id,
                        technique_id=tech_id,
                        rule_ids=rule_ids,
                        scenario_ids=scenario_ids,
                        covered=covered,
                    )
                )
        return matrix

    def get_scenario_ttps(self, scenario_id: str) -> list[MitreTechnique]:
        """Return the ordered list of ATT&CK techniques exercised by a
        scenario.  Returns an empty list for unknown scenario IDs."""
        tech_ids = _SCENARIO_TECHNIQUES.get(scenario_id, [])
        results: list[MitreTechnique] = []
        for tid in tech_ids:
            technique = self._techniques.get(tid)
            if technique is not None:
                results.append(technique)
        return results

    def get_tactic_coverage(self) -> dict[str, dict]:
        """Per-tactic coverage statistics.

        Returns a dict keyed by tactic ID containing:
        - *name*: human-readable tactic name
        - *covered_techniques*: count of techniques with at least one rule
        - *total_techniques*: count of techniques in the knowledge base for
          this tactic
        - *percentage*: integer coverage percentage (0-100)
        """
        stats: dict[str, dict] = {}
        for tactic_id, tech_ids in sorted(self._tactic_technique_map.items()):
            total = len(tech_ids)
            covered = sum(1 for tid in tech_ids if tid in self._technique_to_rules)
            tactic = self._tactics.get(tactic_id)
            tactic_name = tactic.name if tactic else tactic_id
            stats[tactic_id] = {
                "name": tactic_name,
                "covered_techniques": covered,
                "total_techniques": total,
                "percentage": int((covered / total) * 100) if total else 0,
            }
        return stats

    def get_technique_details(self, technique_id: str) -> MitreTechnique | None:
        """Look up a single technique (or sub-technique) by its ATT&CK ID."""
        return self._techniques.get(technique_id)

    def enrich_alert(self, alert_dict: dict) -> dict:
        """Add MITRE ATT&CK context to a serialised alert dictionary.

        If the alert's *rule_id* has a known TTP mapping the following keys
        are added (or overwritten):

        - *mitre_tactics*: list of ``{"id": ..., "name": ...}`` dicts
        - *mitre_techniques*: list of ``{"id": ..., "name": ...}`` dicts
        - *kill_chain_phases*: list of kill-chain phase strings

        The original dict is returned (mutated in-place) for convenience."""
        rule_id = alert_dict.get("rule_id")
        if rule_id is None:
            return alert_dict

        mapping = self._rule_mappings.get(rule_id)
        if mapping is None:
            alert_dict["mitre_tactics"] = []
            alert_dict["mitre_techniques"] = []
            alert_dict["kill_chain_phases"] = []
            return alert_dict

        tactic_entries: list[dict[str, str]] = []
        for tid in mapping.tactic_ids:
            tactic = self._tactics.get(tid)
            if tactic is not None:
                tactic_entries.append({"id": tactic.id, "name": tactic.name})

        technique_entries: list[dict[str, str]] = []
        for tid in mapping.technique_ids:
            technique = self._techniques.get(tid)
            if technique is not None:
                technique_entries.append({"id": technique.id, "name": technique.name})

        alert_dict["mitre_tactics"] = tactic_entries
        alert_dict["mitre_techniques"] = technique_entries
        alert_dict["kill_chain_phases"] = list(mapping.kill_chain_phases)
        return alert_dict
