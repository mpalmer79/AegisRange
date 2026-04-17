"""MissionService — orchestration layer for mission lifecycle and commands."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.models import utc_now

from .run import (
    SUPPORTED_SCENARIOS,
    CommandRecord,
    Difficulty,
    MissionRun,
    Perspective,
    build_run_snapshot,
)


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

    # -- co-op (Phase 9) -----------------------------------------------------

    def start_coop(
        self,
        *,
        scenario_id: str,
        difficulty: Difficulty,
        correlation_id: str,
        operated_by_red: str | None = None,
        operated_by_blue: str | None = None,
    ) -> tuple[MissionRun, MissionRun]:
        """Create a paired red+blue run sharing one correlation_id.

        Neither side runs the scripted adversary — the Red player IS
        the adversary. Both runs start ``active`` and stay that way
        until explicit terminal events (completion, abort). The
        scheduler is NOT invoked for either run; cross-stream
        publishing in :meth:`submit_command` carries Red's beats to
        Blue's SSE feed and vice versa.

        Returns ``(red_run, blue_run)``.
        """
        if scenario_id not in SUPPORTED_SCENARIOS:
            raise ValueError(f"Unsupported scenario: {scenario_id}")

        red = MissionRun(
            run_id=f"run-{uuid4()}",
            scenario_id=scenario_id,
            perspective="red",
            difficulty=difficulty,
            correlation_id=correlation_id,
            created_at=utc_now(),
            status="active",
            operated_by=operated_by_red,
            summary=None,
        )
        blue = MissionRun(
            run_id=f"run-{uuid4()}",
            scenario_id=scenario_id,
            perspective="blue",
            difficulty=difficulty,
            correlation_id=correlation_id,
            created_at=utc_now(),
            status="active",
            operated_by=operated_by_blue,
            summary=None,
        )
        # Link each side to its partner so submit_command knows where
        # to cross-publish player beats.
        red.coop_partner_run_id = blue.run_id
        blue.coop_partner_run_id = red.run_id

        # Seed snapshots (world is empty at start).
        red.summary = build_run_snapshot(red, self.incident_store)
        blue.summary = build_run_snapshot(blue, self.incident_store)

        # Order matters for get_by_correlation (last writer wins), but
        # that reverse lookup isn't used anywhere load-bearing. Put
        # red first so it's stable across restarts.
        self.missions.put(red)
        self.missions.put(blue)
        return red, blue

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

            # Phase 9 co-op: mirror the beat to the partner's stream
            # so red's `attempt login` beats arrive live on blue's
            # timeline (and vice versa). The partner sees the beat
            # with a snapshot scoped to THEIR run — each player's
            # commands_issued / xp_delta stay separate.
            if run.coop_partner_run_id is not None:
                partner = self.missions.get(run.coop_partner_run_id)
                if partner is not None:
                    partner_event = dict(stream_event)
                    partner_event["snapshot"] = build_run_snapshot(
                        partner, self.incident_store
                    )
                    await self.stream_hub.publish(partner.run_id, partner_event)

        return run, {
            "kind": result.kind,
            "lines": result.lines,
            "effects": result.effects,
            "verb_key": verb_key,
        }

    # -- score reporting (Phase 8) ------------------------------------------

    def report_score(
        self, run_id: str, *, score: int, duration_seconds: int | None = None
    ) -> MissionRun | None:
        """Record the final XP score for a terminated run. Returns the
        updated run, or ``None`` if the run is unknown."""
        run = self.missions.get(run_id)
        if run is None:
            return None
        run.score = int(score)
        if duration_seconds is not None:
            run.duration_seconds = int(duration_seconds)
        self.missions.put(run)
        return run

    def leaderboard(
        self,
        *,
        scenario_id: str | None = None,
        perspective: str | None = None,
        difficulty: str | None = None,
        limit: int = 10,
    ) -> list[MissionRun]:
        """Top scoring runs, filtered by any of scenario / perspective /
        difficulty. Sort by score descending; tie-break by smaller
        duration. Only completed runs that have actually reported a
        score appear."""
        runs = [r for r in self.missions.all() if r.score is not None]
        if scenario_id is not None:
            runs = [r for r in runs if r.scenario_id == scenario_id]
        if perspective is not None:
            runs = [r for r in runs if r.perspective == perspective]
        if difficulty is not None:
            runs = [r for r in runs if r.difficulty == difficulty]

        def sort_key(r: MissionRun) -> tuple[int, int]:
            # Negative score so higher scores sort first.
            duration = r.duration_seconds if r.duration_seconds is not None else 10**9
            return (-(r.score or 0), duration)

        runs.sort(key=sort_key)
        return runs[: max(0, limit)]

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
