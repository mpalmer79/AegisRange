"""Mission runtime service.

Phase 1 scaffolding for the interactive mission console. Today this module
is a thin adapter over the existing ``ScenarioEngine``: each "mission" maps
one-to-one to a legacy scenario run. Future phases will hang per-run world
state, adversary script stepping, and command dispatch off ``MissionRun``.

The capability model is intentionally simple: knowing a ``run_id`` (a
UUID) is the capability to read that run. This lets the frontend fetch
the generated incident anonymously via
``GET /missions/{run_id}/incident`` without the global ``/incidents``
role gate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from threading import RLock
from typing import Any, Literal
from uuid import uuid4

from app.models import utc_now

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
}


SUPPORTED_SCENARIOS: dict[str, str] = {
    "scn-tutorial-000": "run_tutorial_000",
    "scn-auth-001": "run_auth_001",
    "scn-session-002": "run_session_002",
    "scn-doc-003": "run_doc_003",
    "scn-doc-004": "run_doc_004",
    "scn-svc-005": "run_svc_005",
    "scn-corr-006": "run_corr_006",
}


@dataclass
class CommandRecord:
    ts: datetime
    raw: str
    verb_key: str  # e.g. "alerts list", "contain session", or "<parse-error>"
    kind: Literal["ok", "error"]
    lines: list[str] = field(default_factory=list)
    effects: dict[str, Any] = field(default_factory=dict)


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


class MissionStore:
    """In-process registry of mission runs keyed by ``run_id``."""

    def __init__(self) -> None:
        self._runs: dict[str, MissionRun] = {}
        self._by_correlation: dict[str, str] = {}
        self._lock = RLock()

    def put(self, run: MissionRun) -> None:
        with self._lock:
            self._runs[run.run_id] = run
            self._by_correlation[run.correlation_id] = run.run_id

    def get(self, run_id: str) -> MissionRun | None:
        with self._lock:
            return self._runs.get(run_id)

    def get_by_correlation(self, correlation_id: str) -> MissionRun | None:
        with self._lock:
            run_id = self._by_correlation.get(correlation_id)
            if run_id is None:
                return None
            return self._runs.get(run_id)

    def all(self) -> list[MissionRun]:
        with self._lock:
            return list(self._runs.values())

    def reset(self) -> None:
        with self._lock:
            self._runs.clear()
            self._by_correlation.clear()


class MissionService:
    """Orchestrates mission lifecycle.

    - :meth:`start_sync` runs the scenario synchronously and returns a
      :class:`MissionRun` already in ``complete`` status. Used by the
      legacy ``POST /scenarios/{id}`` route.
    - :meth:`start_async` creates a run in ``active`` status and hands
      it to the :class:`MissionScheduler` for timed playback. Used by
      ``POST /missions``.
    """

    def __init__(
        self,
        *,
        scenario_engine,
        incident_store,
        mission_store,
        scheduler=None,
        help_service=None,
        stream_hub=None,
    ) -> None:
        self.scenario_engine = scenario_engine
        self.incident_store = incident_store
        self.missions = mission_store
        self.scheduler = scheduler
        self.help_service = help_service
        self.stream_hub = stream_hub

    @staticmethod
    def is_supported(scenario_id: str) -> bool:
        return scenario_id in SUPPORTED_SCENARIOS

    # -- synchronous (legacy) ------------------------------------------------

    def start_sync(
        self,
        *,
        scenario_id: str,
        perspective: Perspective,
        difficulty: Difficulty,
        correlation_id: str,
        operated_by: str | None = None,
    ) -> MissionRun:
        if scenario_id not in SUPPORTED_SCENARIOS:
            raise ValueError(f"Unsupported scenario: {scenario_id}")

        # Red-team missions are player-driven — the adversary script is
        # NOT pre-run. The mission starts 'active' with an empty world;
        # the player's commands (`attempt login` etc.) will mutate it.
        if perspective == "red":
            run = MissionRun(
                run_id=f"run-{uuid4()}",
                scenario_id=scenario_id,
                perspective=perspective,
                difficulty=difficulty,
                correlation_id=correlation_id,
                created_at=utc_now(),
                status="active",
                operated_by=operated_by,
                summary=None,
            )
            run.summary = build_run_snapshot(run, self.incident_store)
            self.missions.put(run)
            return run

        runner_name = SUPPORTED_SCENARIOS[scenario_id]
        run_fn = getattr(self.scenario_engine, runner_name)
        summary = run_fn(correlation_id, operated_by=operated_by)

        run = MissionRun(
            run_id=f"run-{uuid4()}",
            scenario_id=scenario_id,
            perspective=perspective,
            difficulty=difficulty,
            correlation_id=correlation_id,
            created_at=utc_now(),
            status="complete",
            operated_by=operated_by,
            summary=summary,
        )
        self.missions.put(run)
        return run

    # Back-compat alias for Phase 1 callers.
    start = start_sync

    # -- asynchronous (streamed adversary) ----------------------------------

    def start_async(
        self,
        *,
        scenario_id: str,
        perspective: Perspective,
        difficulty: Difficulty,
        correlation_id: str,
        operated_by: str | None = None,
    ) -> MissionRun:
        if scenario_id not in SUPPORTED_SCENARIOS:
            raise ValueError(f"Unsupported scenario: {scenario_id}")
        if self.scheduler is None:
            raise RuntimeError(
                "MissionService was constructed without a scheduler; "
                "async missions are not available."
            )
        run = MissionRun(
            run_id=f"run-{uuid4()}",
            scenario_id=scenario_id,
            perspective=perspective,
            difficulty=difficulty,
            correlation_id=correlation_id,
            created_at=utc_now(),
            status="active",
            operated_by=operated_by,
            summary=None,
        )
        # For Red async runs we seed an initial empty-world snapshot so
        # callers that fetch the snapshot between commands always see a
        # coherent shape (no null summary). Blue async runs intentionally
        # leave summary=None until the scheduler publishes the first
        # beat — that's the contract Phase 2 tests assert.
        if perspective == "red":
            run.summary = build_run_snapshot(run, self.incident_store)
        self.missions.put(run)
        self.scheduler.schedule(run)
        return run

    # -- commands ------------------------------------------------------------

    async def submit_command(
        self, run_id: str, raw: str
    ) -> tuple[MissionRun | None, dict[str, Any]]:
        """Parse + dispatch a player command against a mission run.

        Returns ``(run, response_dict)`` where response_dict has the
        shape::

            {
              "kind": "ok" | "error",
              "lines": [...],
              "effects": {...},
              "verb_key": "...",
            }

        If the mission is unknown, ``(None, {})`` is returned (caller
        should 404).
        """
        # Lazy imports to keep module import order clean.
        from app.services.command_dispatcher import (
            DispatchContext,
            dispatch,
        )
        from app.services.command_parser import parse

        run = self.missions.get(run_id)
        if run is None:
            return None, {}
        if self.help_service is None:
            raise RuntimeError(
                "MissionService has no help_service wired; cannot dispatch commands."
            )

        outcome = parse(raw, perspective=run.perspective)
        if outcome.err is not None:
            record = CommandRecord(
                ts=utc_now(),
                raw=raw,
                verb_key="<parse-error>",
                kind="error",
                lines=[outcome.err.message]
                + (
                    [f"Did you mean: {outcome.err.suggestion}?"]
                    if outcome.err.suggestion
                    else []
                ),
            )
            run.command_history.append(record)
            # Operator difficulty penalises sloppy typing: −1 XP per
            # unknown-verb / unknown-subcommand parse failure. Easier
            # ranks let parse errors slide so players can explore.
            if run.difficulty == "operator" and outcome.err.kind in {
                "unknown_verb",
                "unknown_subcommand",
            }:
                run.xp_delta -= 1
            self.missions.put(run)
            return run, {
                "kind": "error",
                "lines": record.lines,
                "effects": {},
                "verb_key": record.verb_key,
            }

        assert outcome.ok is not None
        parsed = outcome.ok
        ctx = DispatchContext(
            run=run,
            scenario_engine=self.scenario_engine,
            store=self.incident_store,
            help_service=self.help_service,
        )
        result = dispatch(parsed, ctx)

        # Normalised verb key: subverb-flagged verbs use "verb sub"; plain
        # verbs use just the verb name.
        verb_key = parsed.verb.key
        record = CommandRecord(
            ts=utc_now(),
            raw=raw,
            verb_key=verb_key,
            kind=result.kind,
            lines=result.lines,
            effects=result.effects,
        )
        run.command_history.append(record)
        # Apply XP side effects.
        hint_cost = result.effects.get("hint_xp_cost")
        if isinstance(hint_cost, int):
            run.xp_delta -= hint_cost
        self.missions.put(run)

        # Surface the command on the SSE stream so observers (Ops
        # Manual, transcript, replays) see it in-order with adversary
        # beats. Inject the current world snapshot so the frontend's
        # objective checks update live on each player action — the
        # same contract the scheduler publishes on auto-beats.
        if self.stream_hub is not None and result.stream_event is not None:
            stream_event = dict(result.stream_event)
            if "snapshot" not in stream_event:
                stream_event["snapshot"] = build_run_snapshot(run, self.incident_store)
            await self.stream_hub.publish(run.run_id, stream_event)

        return run, {
            "kind": result.kind,
            "lines": result.lines,
            "effects": result.effects,
            "verb_key": verb_key,
        }

    # -- reads ---------------------------------------------------------------

    def get(self, run_id: str) -> MissionRun | None:
        return self.missions.get(run_id)

    def get_incident(self, run_id: str):
        """Return ``(run, incident)`` for the given run, or ``(None, None)``
        if the run is unknown. Incident may be ``None`` if the scenario
        did not generate one."""
        run = self.missions.get(run_id)
        if run is None:
            return None, None
        incident = self.incident_store.get_incident(run.correlation_id)
        return run, incident
