"""Help + hint content for the mission console.

Three surfaces share this service:
- ``help`` in-console (inline text).
- ``help <verb>`` for per-verb usage.
- The frontend Ops Manual overlay, which ``GET``s the same content
  via ``/missions/{run_id}/help?topic=...``.

Hints are contextual: we inspect the commands the player has issued so
far and return the next step of the scenario playbook. Hint XP cost
depends on difficulty (Recruit 0 / Analyst 10 / Operator 25).
"""

from __future__ import annotations

from typing import Literal

from app.services.command_grammar import (
    Perspective,
    VerbSpec,
    find_verb,
    verbs_for,
)

Difficulty = Literal["recruit", "analyst", "operator"]


HINT_COST_BY_DIFFICULTY: dict[str, int] = {
    "recruit": 0,
    "analyst": 10,
    "operator": 25,
}


# Per (scenario_id, perspective) playbook: ordered list of hint steps.
# Each step has a predicate (predicate_fn) that decides whether the
# step has already been satisfied; the first unsatisfied step is the
# one surfaced by ``next_hint``. For Phase 3a we ship the scn-auth-001
# Blue playbook. Other scenarios fall back to a generic message.
_PLAYBOOKS: dict[tuple[str, str], list[dict]] = {
    # -----------------------------------------------------------------
    # scn-tutorial-000 — first-run training. Hand-holding intent: each
    # step names the verb and what it teaches.
    # -----------------------------------------------------------------
    ("scn-tutorial-000", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "Welcome. Type `alerts list` and press Enter. This queries",
                "the simulated SIEM for any alerts the detection pipeline",
                "has produced for this run.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("events tail") for v in issued
            ),
            "lines": [
                "Now type `events tail` to see the raw events. The tutorial",
                "scenario emits one failed login so you can confirm the",
                "console is working end-to-end.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(v == "status" for v in issued),
            "lines": [
                "Type `status` to see your mission state at a glance —",
                "events captured, alerts, command count, run id.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain session") for v in issued
            ),
            "lines": [
                "Last step: practice the containment verb. Type",
                "`contain session --user user-alice --action revoke`.",
                "That's the same shape you'll use in real scenarios. Done!",
            ],
        },
    ],
    ("scn-auth-001", "red"): [
        {
            "satisfied_when": lambda issued: any(v == "recon users" for v in issued),
            "lines": [
                "Start with `recon users` to see who's targetable.",
                "No event fires — it's free intel, use it liberally.",
            ],
        },
        {
            "satisfied_when": lambda issued: (
                sum(1 for v in issued if v == "attempt login") >= 1
            ),
            "lines": [
                "Run `attempt login --user alice --from 203.0.113.10` to",
                "fire your first authentication event. Omit --password to",
                "guarantee a 401 — exactly what you want to seed the",
                "brute-force counter.",
            ],
        },
        {
            "satisfied_when": lambda issued: (
                sum(1 for v in issued if v == "attempt login") >= 5
            ),
            "lines": [
                "You need ~5 attempts from the same IP before DET-AUTH-001",
                "trips. Keep running `attempt login --user alice --from",
                "203.0.113.10` (no --password) until the counter pops.",
            ],
        },
        {
            # After 6+ attempts the counter has tripped and the auto-
            # response has fired — the attacker has effectively won
            # the scenario. Surface the final hint before that.
            "satisfied_when": lambda issued: (
                sum(1 for v in issued if v == "attempt login") >= 6
            ),
            "lines": [
                "Finish with a successful login — pass the real password:",
                "`attempt login --user alice --from 203.0.113.10",
                "--password Correct_Horse_42!`. DET-AUTH-002 flags the",
                "suspicious-origin success and the defender's auto-response",
                "will containment-trip your own session. That's what satisfies",
                "the 'Force a defensive response' objective.",
            ],
        },
    ],
    ("scn-auth-001", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "Start by running `alerts list` to see what the SIEM has caught.",
                "Each adversary login attempt should produce a DET-AUTH-001 alert;",
                "the successful login adds a DET-AUTH-002 alert once it lands.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts show") or v.startswith("events tail")
                for v in issued
            ),
            "lines": [
                "Pick one of the alert IDs and run `alerts show <id>` to confirm",
                "the attacker pattern — rapid failures followed by a success from",
                "a suspicious IP.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v == "correlate" or v.startswith("correlate ") for v in issued
            ),
            "lines": [
                "Run `correlate` to confirm the alerts belong to one incident.",
                "(The pipeline may have auto-correlated — that's fine, the verb",
                "registers your analyst decision.)",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain session") for v in issued
            ),
            "lines": [
                "Containment objective: kill the attacker's access.",
                "Run `contain session --user user-alice --action revoke` to",
                "end any active sessions, or `--action stepup` to force a",
                "step-up challenge on the next request. Either one completes",
                "the mission.",
            ],
        },
    ],
    # -----------------------------------------------------------------
    # scn-session-002 (Session Hijacking)
    # -----------------------------------------------------------------
    ("scn-session-002", "red"): [
        {
            "satisfied_when": lambda issued: any(v == "attempt login" for v in issued),
            "lines": [
                "Sign in as bob to mint a session token:",
                "`attempt login --user bob --from 198.51.100.10",
                "--password Hunter2_Strong_99!`",
            ],
        },
        {
            "satisfied_when": lambda issued: any(v == "session reuse" for v in issued),
            "lines": [
                "Replay bob's session from a different IP:",
                "`session reuse --from 203.0.113.55`",
                "That trips DET-SESSION-003 and the defender auto-response.",
            ],
        },
    ],
    ("scn-session-002", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "Run `alerts list` — you should see a DET-SESSION-003 alert for",
                "anomalous session origin.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("events tail") or v.startswith("alerts show")
                for v in issued
            ),
            "lines": [
                "Inspect: `events tail --user user-bob` reveals two",
                "authorization.check.success events from mismatched IPs —",
                "classic session-token reuse.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain session") for v in issued
            ),
            "lines": [
                "Kill the hijacked session:",
                "`contain session --user user-bob --action revoke`",
            ],
        },
    ],
    # -----------------------------------------------------------------
    # scn-doc-003 (Bulk Document Access)
    # -----------------------------------------------------------------
    ("scn-doc-003", "red"): [
        {
            "satisfied_when": lambda issued: any(v == "attempt login" for v in issued),
            "lines": [
                "Start with a valid bob session:",
                "`attempt login --user bob --from 198.51.100.10",
                "--password Hunter2_Strong_99!`",
            ],
        },
        {
            "satisfied_when": lambda issued: any(v == "doc read" for v in issued),
            "lines": [
                "Fire a burst of reads to trip the bulk-access detector:",
                "`doc read --id doc-002 --burst 20`",
            ],
        },
    ],
    ("scn-doc-003", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "`alerts list` should surface DET-DOC-005 for bulk document",
                "access.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("events tail") for v in issued
            ),
            "lines": [
                "Confirm: `events tail --user user-bob --last 10` shows many",
                "consecutive document.read events on the same doc.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain session") or v.startswith("contain document")
                for v in issued
            ),
            "lines": [
                "Contain either the actor or the document:",
                "`contain session --user user-bob --action revoke` OR",
                "`contain document --id doc-002 --action restrict --actor user-bob`",
            ],
        },
    ],
    # -----------------------------------------------------------------
    # scn-doc-004 (Bulk Document Exfiltration)
    # -----------------------------------------------------------------
    ("scn-doc-004", "red"): [
        {
            "satisfied_when": lambda issued: any(v == "attempt login" for v in issued),
            "lines": [
                "Authenticate first:",
                "`attempt login --user bob --from 198.51.100.10",
                "--password Hunter2_Strong_99!`",
            ],
        },
        {
            "satisfied_when": lambda issued: (
                sum(1 for v in issued if v == "doc read") >= 2
            ),
            "lines": [
                "Read a handful of restricted docs to stage the exfil:",
                "`doc read --id doc-001` / `doc read --id doc-002` /",
                "`doc read --id doc-003`",
            ],
        },
        {
            "satisfied_when": lambda issued: any(v == "doc download" for v in issued),
            "lines": [
                "Now download them to trip DET-DOC-006:",
                "`doc download --id doc-001`, `doc download --id doc-002`,",
                "`doc download --id doc-003`",
            ],
        },
    ],
    ("scn-doc-004", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "`alerts list` should light up DET-DOC-006 for a",
                "read-then-download exfil pattern.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain document") or v.startswith("contain session")
                for v in issued
            ),
            "lines": [
                "Quarantine the exfiltrated artifact and restrict the actor:",
                "`contain document --id doc-002 --action quarantine` AND/OR",
                "`contain session --user user-bob --action revoke`",
            ],
        },
    ],
    # -----------------------------------------------------------------
    # scn-svc-005 (Service Account Abuse)
    # -----------------------------------------------------------------
    ("scn-svc-005", "red"): [
        {
            "satisfied_when": lambda issued: (
                sum(1 for v in issued if v == "svc call") >= 1
            ),
            "lines": [
                "Service accounts don't need an interactive session. Fire",
                "privileged calls:",
                "`svc call --service svc-data-processor --op /admin/config`",
            ],
        },
        {
            "satisfied_when": lambda issued: (
                sum(1 for v in issued if v == "svc call") >= 3
            ),
            "lines": [
                "Hit a few more routes to trip DET-SVC-007:",
                "`/admin/secrets`, `/admin/users`, `/admin/audit`.",
            ],
        },
    ],
    ("scn-svc-005", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "Run `alerts list` — DET-SVC-007 fires on abnormal service",
                "account activity.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain service") for v in issued
            ),
            "lines": [
                "Disable the misbehaving service:",
                "`contain service --id svc-data-processor --action disable`",
            ],
        },
    ],
    # -----------------------------------------------------------------
    # scn-corr-006 (Multi-Stage)
    # -----------------------------------------------------------------
    ("scn-corr-006", "red"): [
        {
            "satisfied_when": lambda issued: any(v == "attempt login" for v in issued),
            "lines": [
                "Start with credential spraying:",
                "`attempt login --user alice --from 203.0.113.10` (repeat 5×",
                "no --password, then land success with --password",
                "Correct_Horse_42!).",
            ],
        },
        {
            "satisfied_when": lambda issued: any(v == "doc read" for v in issued),
            "lines": [
                "Chain into doc access: `doc read --id doc-001 --burst 10`",
                "and `doc read --id doc-002 --burst 10`.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(v == "doc download" for v in issued),
            "lines": [
                "Finish with exfil: `doc download --id doc-001`,",
                "`doc download --id doc-002`, `doc download --id doc-003`.",
            ],
        },
    ],
    ("scn-corr-006", "blue"): [
        {
            "satisfied_when": lambda issued: any(
                v.startswith("alerts list") for v in issued
            ),
            "lines": [
                "Multi-stage: you'll see DET-AUTH-001, DET-AUTH-002,",
                "DET-DOC-005, DET-DOC-006 all land. Start with `alerts list`.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v == "correlate" or v.startswith("correlate ") for v in issued
            ),
            "lines": [
                "Correlate the chain: `correlate` to confirm the analyst",
                "read of the linked incident.",
            ],
        },
        {
            "satisfied_when": lambda issued: any(
                v.startswith("contain ") for v in issued
            ),
            "lines": [
                "Full-spectrum response: revoke sessions, quarantine",
                "documents, restrict the actor. Any `contain ...` verb",
                "satisfies the objective.",
            ],
        },
    ],
}


class HelpService:
    def overview(self, perspective: Perspective) -> list[str]:
        lines = ["Available verbs:"]
        for v in verbs_for(perspective):
            lines.append(f"  {v.key:<22}  {v.effective_summary()}")
        lines.append("")
        lines.append("Type `help <verb>` for detailed usage.")
        lines.append("Type `hint` for a contextual next step.")
        lines.append("Press F1 (or the Help button) for the full Ops Manual.")
        return lines

    def verb_help(self, verb_token: str, perspective: Perspective) -> list[str] | None:
        # Accept both "alerts" (verb only) and "alerts list" (with sub).
        parts = verb_token.strip().split()
        if not parts:
            return None
        name = parts[0].lower()
        sub = parts[1].lower() if len(parts) > 1 else None
        spec: VerbSpec | None = find_verb(name, sub, perspective)
        if spec is None and sub is None:
            # Show all variants of this verb.
            matches = [v for v in verbs_for(perspective) if v.name == name]
            if not matches:
                return None
            lines: list[str] = []
            for m in matches:
                lines.extend(self._format_verb(m))
                lines.append("")
            return lines[:-1]  # trim trailing blank
        if spec is None:
            return None
        return self._format_verb(spec)

    def next_hint(
        self,
        *,
        scenario_id: str,
        perspective: str,
        difficulty: str,
        commands_issued: list[str],
    ) -> tuple[list[str], int]:
        playbook = _PLAYBOOKS.get((scenario_id, perspective))
        cost = HINT_COST_BY_DIFFICULTY.get(difficulty, 0)
        if playbook is None:
            return (
                [
                    "No playbook for this scenario yet — keep exploring.",
                    "Run `help` to see what you can type.",
                ],
                0,
            )
        for step in playbook:
            if not step["satisfied_when"](commands_issued):
                return (list(step["lines"]), cost)
        return (
            [
                "All objectives look satisfied from your command history!",
                "Run `status` to double-check.",
            ],
            0,
        )

    def _format_verb(self, spec: VerbSpec) -> list[str]:
        lines = [
            f"Usage: {spec.usage or spec.key}",
            "",
            spec.description or spec.effective_summary() or "(no description)",
        ]
        if spec.flags:
            lines.append("")
            lines.append("Flags:")
            for f in spec.flags:
                required = " (required)" if f.required else ""
                ch = f" choices: {', '.join(f.choices)}" if f.choices else ""
                lines.append(f"  --{f.name:<12} {f.type}{required}{ch}")
                if f.description:
                    lines.append(f"      {f.description}")
        return lines
