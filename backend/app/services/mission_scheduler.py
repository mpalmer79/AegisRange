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
from app.services.mission_service import MissionRun, MissionStore
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
        task = asyncio.create_task(
            self._play(run), name=f"mission-{run.run_id}"
        )
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
                    logger.exception("Adversary beat failed", extra={
                        "run_id": run.run_id,
                        "beat_index": index,
                        "beat_kind": beat.kind.value,
                    })
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
            raise
        finally:
            await self.stream_hub.close(run.run_id)
            self._tasks.pop(run.run_id, None)

    async def _publish(self, run_id: str, event: dict[str, Any]) -> None:
        await self.stream_hub.publish(run_id, event)

    def _summary(self, run: MissionRun) -> dict[str, Any]:
        """Build the legacy-compatible scenario summary from current
        store contents. Reuses the scenario_engine's summary builder so
        the shape is identical to the synchronous path."""
        # ``ScenarioEngine._summary`` writes to scenario_history; we do
        # *not* want an intermediate snapshot to pollute history.
        # Inline a read-only copy instead.
        store = self.scenario_engine.store
        scenario_label = _SCENARIO_LABEL[run.scenario_id]
        events_count = sum(
            1 for e in store.get_events() if e.correlation_id == run.correlation_id
        )
        alerts_count = sum(
            1 for a in store.get_alerts() if a.correlation_id == run.correlation_id
        )
        responses_count = sum(
            1
            for r in store.get_responses()
            if r.correlation_id == run.correlation_id
        )
        incident = store.get_incident(run.correlation_id)
        return {
            "scenario_id": scenario_label,
            "correlation_id": run.correlation_id,
            "events_total": events_count,
            "events_generated": events_count,
            "alerts_total": alerts_count,
            "alerts_generated": alerts_count,
            "responses_total": responses_count,
            "responses_generated": responses_count,
            "incident_id": incident.incident_id if incident else None,
            "step_up_required": store.is_step_up_required("user-alice"),
            "revoked_sessions": sorted(store.get_all_revoked_sessions()),
            "download_restricted_actors": sorted(
                store.get_all_download_restricted()
            ),
            "disabled_services": sorted(store.get_all_disabled_services()),
            "quarantined_artifacts": sorted(store.get_all_quarantined_artifacts()),
            "policy_change_restricted_actors": sorted(
                store.get_all_policy_change_restricted()
            ),
            "operated_by": run.operated_by,
            "run_id": run.run_id,
        }


_SCENARIO_LABEL: dict[str, str] = {
    "scn-auth-001": "SCN-AUTH-001",
    "scn-session-002": "SCN-SESSION-002",
    "scn-doc-003": "SCN-DOC-003",
    "scn-doc-004": "SCN-DOC-004",
    "scn-svc-005": "SCN-SVC-005",
    "scn-corr-006": "SCN-CORR-006",
}
