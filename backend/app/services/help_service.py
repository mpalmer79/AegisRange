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
