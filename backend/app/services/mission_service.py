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

SUPPORTED_SCENARIOS: dict[str, str] = {
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
        runner_name = SUPPORTED_SCENARIOS.get(scenario_id)
        if runner_name is None:
            raise ValueError(f"Unsupported scenario: {scenario_id}")
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
                + ([f"Did you mean: {outcome.err.suggestion}?"] if outcome.err.suggestion else []),
            )
            run.command_history.append(record)
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
        # beats.
        if self.stream_hub is not None and result.stream_event is not None:
            await self.stream_hub.publish(run.run_id, result.stream_event)

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
