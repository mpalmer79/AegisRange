"""Async playback engine for adversary scripts.

The scheduler walks a script beat-by-beat, pauses for each beat's
difficulty-scaled delay, applies the beat (mutating the store via the
pipeline), and publishes a world snapshot on the mission's SSE channel.

A single ``MissionScheduler`` owns one :class:`asyncio.Task` per active
run. Tasks are self-cleaning: they publish ``mission_complete`` (or
``mission_failed``) and send the stream hub's close sentinel before
exiting.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.models import utc_now
from app.services.adversary_scripts import (
    DIFFICULTY_PACING,
    ScriptContext,
    apply_beat,
    build_script,
)
from app.services.mission_service import MissionRun, MissionStore, build_run_snapshot
from app.services.mission_stream import MissionStreamHub

logger = logging.getLogger("aegisrange.mission_scheduler")


class MissionScheduler:
    """Orchestrates async playback of adversary scripts.

    One task per active run. Safe to call ``schedule()`` multiple times
    for the same run (idempotent — subsequent calls are no-ops).
    """

    def __init__(
        self,
        *,
        scenario_engine,
        mission_store: MissionStore,
        stream_hub: MissionStreamHub,
    ) -> None:
        self.scenario_engine = scenario_engine
        self.mission_store = mission_store
        self.stream_hub = stream_hub
        self._tasks: dict[str, asyncio.Task[None]] = {}

    def is_running(self, run_id: str) -> bool:
        task = self._tasks.get(run_id)
        return task is not None and not task.done()

    def schedule(self, run: MissionRun) -> asyncio.Task[None]:
        existing = self._tasks.get(run.run_id)
        if existing is not None and not existing.done():
            return existing
        task = asyncio.create_task(self._play(run), name=f"mission-{run.run_id}")
        self._tasks[run.run_id] = task
        return task

    async def _play(self, run: MissionRun) -> None:
        try:
            await self._publish(
                run.run_id,
                {
                    "type": "mission_started",
                    "run_id": run.run_id,
                    "scenario_id": run.scenario_id,
                    "perspective": run.perspective,
                    "difficulty": run.difficulty,
                    "ts": utc_now().isoformat(),
                },
            )

            # Red-team missions: the PLAYER is the adversary. The
            # scheduler does not pre-emit the scripted beats — the
            # player's typed commands will emit them. We just mark the
            # run 'active' and let the command dispatcher publish its
            # own beats. The mission stays active until the client
            # resets it or the frontend concludes all objectives are met.
            if run.perspective == "red":
                # Publish an initial empty-world snapshot so the
                # frontend HUD has something to render immediately.
                await self._publish(
                    run.run_id,
                    {
                        "type": "world_snapshot",
                        "ts": utc_now().isoformat(),
                        "snapshot": self._summary(run),
                    },
                )
                return

            beats = build_script(run.scenario_id)
            multiplier = DIFFICULTY_PACING.get(run.difficulty, 1.0)
            ctx = ScriptContext(
                correlation_id=run.correlation_id,
                pipeline=self.scenario_engine.pipeline,
                identity=self.scenario_engine.identity,
                documents=self.scenario_engine.documents,
                store=self.scenario_engine.store,
                state={},
            )

            for index, beat in enumerate(beats):
                delay = beat.delay_before_seconds * multiplier
                if delay > 0:
                    await asyncio.sleep(delay)

                # Beats are synchronous and fast (milliseconds); running
                # them inline is fine today. If any grow slow we can
                # offload via run_in_executor without changing the API.
                try:
                    apply_beat(beat, ctx)
                except Exception as exc:  # noqa: BLE001
                    logger.exception(
                        "Adversary beat failed",
                        extra={
                            "run_id": run.run_id,
                            "beat_index": index,
                            "beat_kind": beat.kind.value,
                        },
                    )
                    run.status = "failed"
                    run.summary = None
                    self.mission_store.put(run)
                    await self._publish(
                        run.run_id,
                        {
                            "type": "mission_failed",
                            "ts": utc_now().isoformat(),
                            "error": str(exc),
                            "beat_index": index,
                        },
                    )
                    return

                snapshot = self._summary(run)
                await self._publish(
                    run.run_id,
                    {
                        "type": "beat",
                        "ts": utc_now().isoformat(),
                        "beat_index": index,
                        "beat_total": len(beats),
                        "beat": {
                            "kind": beat.kind.value,
                            "label": beat.label,
                        },
                        "snapshot": snapshot,
                    },
                )

            run.status = "complete"
            run.summary = self._summary(run)
            self.mission_store.put(run)
            await self._publish(
                run.run_id,
                {
                    "type": "mission_complete",
                    "ts": utc_now().isoformat(),
                    "snapshot": run.summary,
                },
            )
        except asyncio.CancelledError:
            run.status = "aborted"
            self.mission_store.put(run)
            await self._publish(
                run.run_id,
                {"type": "mission_aborted", "ts": utc_now().isoformat()},
            )
            # Close the stream on cancellation regardless of perspective
            # so subscribed clients terminate cleanly.
            await self.stream_hub.close(run.run_id)
            self._tasks.pop(run.run_id, None)
            raise
        finally:
            # For Blue missions the adversary script has finished; close
            # the stream. For Red missions the player's commands are the
            # source of subsequent beats — keep the stream open until the
            # run is explicitly ended (abort / reset). ``close()`` is
            # idempotent so if the run already terminated above via
            # cancellation this is a no-op.
            if run.perspective != "red" or run.status in {
                "complete",
                "failed",
                "aborted",
                "timed_out",
            }:
                await self.stream_hub.close(run.run_id)
            self._tasks.pop(run.run_id, None)

    async def _publish(self, run_id: str, event: dict[str, Any]) -> None:
        await self.stream_hub.publish(run_id, event)

    def _summary(self, run: MissionRun) -> dict[str, Any]:
        """Build the legacy-compatible scenario summary from current
        store contents. Delegates to the shared builder so the
        scheduler and the command-dispatch stream-event path stay in
        lockstep."""
        return build_run_snapshot(run, self.scenario_engine.store)
