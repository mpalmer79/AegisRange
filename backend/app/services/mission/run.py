"""Mission data types.

Defines ``MissionRun``, ``CommandRecord``, the type aliases
(``Perspective``, ``Difficulty``, ``MissionStatus``), and the serialization
helpers that round-trip runs to and from SQLite. Also holds the
scenario-id ↔ engine-method maps.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

Perspective = Literal["red", "blue"]
Difficulty = Literal["recruit", "analyst", "operator"]
MissionStatus = Literal["active", "complete", "failed", "aborted", "timed_out"]

SCENARIO_LABEL: dict[str, str] = {
    "scn-tutorial-000": "SCN-TUTORIAL-000",
    "scn-auth-001": "SCN-AUTH-001",
    "scn-session-002": "SCN-SESSION-002",
    "scn-doc-003": "SCN-DOC-003",
    "scn-doc-004": "SCN-DOC-004",
    "scn-svc-005": "SCN-SVC-005",
    "scn-corr-006": "SCN-CORR-006",
    "scn-geo-007": "SCN-GEO-007",
    "scn-exfil-008": "SCN-EXFIL-008",
}


SUPPORTED_SCENARIOS: dict[str, str] = {
    "scn-tutorial-000": "run_tutorial_000",
    "scn-auth-001": "run_auth_001",
    "scn-session-002": "run_session_002",
    "scn-doc-003": "run_doc_003",
    "scn-doc-004": "run_doc_004",
    "scn-svc-005": "run_svc_005",
    "scn-corr-006": "run_corr_006",
    "scn-geo-007": "run_geo_007",
    "scn-exfil-008": "run_exfil_008",
}


@dataclass
class CommandRecord:
    ts: datetime
    raw: str
    verb_key: str  # e.g. "alerts list", "contain session", or "<parse-error>"
    kind: Literal["ok", "error"]
    lines: list[str] = field(default_factory=list)
    effects: dict[str, Any] = field(default_factory=dict)


@dataclass
class MissionRun:
    run_id: str
    scenario_id: str
    perspective: Perspective
    difficulty: Difficulty
    correlation_id: str
    created_at: datetime
    status: MissionStatus
    operated_by: str | None = None
    summary: dict[str, Any] | None = None
    command_history: list[CommandRecord] = field(default_factory=list)
    # Running total of XP adjustments (e.g. -10 for each hint on
    # analyst). Positive values are bonuses.
    xp_delta: int = 0
    # Per-run scratch pad for beat handlers — threaded through
    # successive red-team commands so `session reuse` / `doc read` /
    # `doc download` can read the session id minted by an earlier
    # `attempt login`. Persisted alongside the run so a worker restart
    # mid-attack doesn't lose the session.
    scratch_state: dict[str, Any] = field(default_factory=dict)
    # Phase 8: final XP awarded for this run. Populated by the
    # frontend (which knows about difficulty multipliers, daily-bonus
    # multipliers, achievement bonuses) via POST /missions/{run_id}/score
    # once the mission terminates. Drives the leaderboard endpoint.
    # ``None`` means "no score reported yet" — completed runs without
    # a score don't appear on the leaderboard.
    score: int | None = None
    # Wall-clock duration in seconds, also reported by the client when
    # it knows the run has terminated. Used for tie-breaking on the
    # leaderboard (lower duration wins).
    duration_seconds: int | None = None
    # Phase 9 co-op: the partner run_id if this run is paired with a
    # mirror-perspective run (red ↔ blue). Both runs share a
    # correlation_id so the detection pipeline sees one world; each
    # run has its own command history and score. Cross-stream
    # publishing (mission_service.submit_command) delivers each
    # player's beats to the partner's SSE feed in real time.
    coop_partner_run_id: str | None = None


def build_run_snapshot(run: "MissionRun", store) -> dict[str, Any]:
    """Build the legacy-compatible summary dict for a run against the
    given store. Shared between :class:`MissionScheduler` (for beat
    snapshots) and :class:`MissionService.submit_command` (so player
    beats carry the same shape) so both paths stay in lockstep."""
    scenario_label = SCENARIO_LABEL.get(run.scenario_id, run.scenario_id.upper())
    corr = run.correlation_id
    events_count = sum(1 for e in store.get_events() if e.correlation_id == corr)
    alerts_count = sum(1 for a in store.get_alerts() if a.correlation_id == corr)
    responses_count = sum(1 for r in store.get_responses() if r.correlation_id == corr)
    incident = store.get_incident(corr)
    return {
        "scenario_id": scenario_label,
        "correlation_id": corr,
        "events_total": events_count,
        "events_generated": events_count,
        "alerts_total": alerts_count,
        "alerts_generated": alerts_count,
        "responses_total": responses_count,
        "responses_generated": responses_count,
        "incident_id": incident.incident_id if incident else None,
        "step_up_required": store.is_step_up_required("user-alice"),
        "revoked_sessions": sorted(store.get_all_revoked_sessions()),
        "download_restricted_actors": sorted(store.get_all_download_restricted()),
        "disabled_services": sorted(store.get_all_disabled_services()),
        "quarantined_artifacts": sorted(store.get_all_quarantined_artifacts()),
        "policy_change_restricted_actors": sorted(
            store.get_all_policy_change_restricted()
        ),
        "operated_by": run.operated_by,
        "run_id": run.run_id,
        "commands_issued": [r.verb_key for r in run.command_history],
        "xp_delta": run.xp_delta,
    }


def mission_run_to_dict(run: MissionRun) -> dict[str, Any]:
    """Serialize a MissionRun to a JSON-safe dict."""
    return {
        "run_id": run.run_id,
        "scenario_id": run.scenario_id,
        "perspective": run.perspective,
        "difficulty": run.difficulty,
        "correlation_id": run.correlation_id,
        "created_at": run.created_at.isoformat(),
        "status": run.status,
        "operated_by": run.operated_by,
        "summary": run.summary,
        "xp_delta": run.xp_delta,
        "scratch_state": run.scratch_state,
        "score": run.score,
        "duration_seconds": run.duration_seconds,
        "coop_partner_run_id": run.coop_partner_run_id,
        "command_history": [
            {
                "ts": record.ts.isoformat(),
                "raw": record.raw,
                "verb_key": record.verb_key,
                "kind": record.kind,
                "lines": record.lines,
                "effects": record.effects,
            }
            for record in run.command_history
        ],
    }


def mission_run_from_dict(data: dict[str, Any]) -> MissionRun:
    """Hydrate a MissionRun from a persisted dict."""
    return MissionRun(
        run_id=data["run_id"],
        scenario_id=data["scenario_id"],
        perspective=data["perspective"],
        difficulty=data["difficulty"],
        correlation_id=data["correlation_id"],
        created_at=datetime.fromisoformat(data["created_at"]),
        status=data["status"],
        operated_by=data.get("operated_by"),
        summary=data.get("summary"),
        xp_delta=data.get("xp_delta", 0),
        scratch_state=data.get("scratch_state", {}) or {},
        score=data.get("score"),
        duration_seconds=data.get("duration_seconds"),
        coop_partner_run_id=data.get("coop_partner_run_id"),
        command_history=[
            CommandRecord(
                ts=datetime.fromisoformat(entry["ts"]),
                raw=entry["raw"],
                verb_key=entry["verb_key"],
                kind=entry["kind"],
                lines=list(entry.get("lines", [])),
                effects=dict(entry.get("effects", {})),
            )
            for entry in data.get("command_history", [])
        ],
    )
