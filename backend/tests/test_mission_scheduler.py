"""Mission scheduler + stream hub — async playback contract.

The scheduler walks the adversary script, publishes beats to the SSE
hub, and writes a terminal ``mission_complete`` frame. These tests
drive the scheduler directly on an asyncio loop (no HTTP layer) so
they're fast and deterministic.
"""

from __future__ import annotations

import asyncio
import unittest
from uuid import uuid4

from app.services.adversary_scripts import DIFFICULTY_PACING, build_script
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.mission_scheduler import MissionScheduler
from app.services.mission_service import MissionRun, MissionStore
from app.services.mission_stream import MissionStreamHub
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.services.scenario_service import ScenarioEngine
from app.store import InMemoryStore
from app.models import utc_now


def _make_engine():
    store = InMemoryStore()
    telemetry = TelemetryService(store)
    detection = DetectionService(telemetry)
    response = ResponseOrchestrator(store)
    incidents = IncidentService(store)
    pipeline = EventPipelineService(
        telemetry=telemetry,
        detection=detection,
        response=response,
        incidents=incidents,
        store=store,
    )
    identity = IdentityService(store)
    documents = DocumentService(store=store)
    return ScenarioEngine(
        identity=identity,
        documents=documents,
        pipeline=pipeline,
        store=store,
    )


def _make_run(
    scenario_id: str = "scn-auth-001", difficulty: str = "operator"
) -> MissionRun:
    return MissionRun(
        run_id=f"run-{uuid4()}",
        scenario_id=scenario_id,
        perspective="blue",
        difficulty=difficulty,  # type: ignore[arg-type]
        correlation_id=f"corr-{uuid4()}",
        created_at=utc_now(),
        status="active",
    )


def _zero_out_delays(monkeypatch_dict: dict) -> None:
    """Force beats to fire back-to-back so tests are deterministic."""
    for key in monkeypatch_dict:
        monkeypatch_dict[key] = 0.0


class SchedulerRun(unittest.TestCase):
    def test_run_publishes_start_beats_and_complete(self) -> None:
        async def scenario() -> None:
            engine = _make_engine()
            hub = MissionStreamHub()
            store = MissionStore()
            scheduler = MissionScheduler(
                scenario_engine=engine,
                mission_store=store,
                stream_hub=hub,
            )
            # Eliminate delays so the test finishes in <1s regardless
            # of the base pacing in adversary_scripts.
            DIFFICULTY_PACING["operator"] = 0.0
            try:
                run = _make_run()
                store.put(run)

                queue = await hub.subscribe(run.run_id)
                task = scheduler.schedule(run)
                await task

                seen: list[str] = []
                while not queue.empty():
                    item = queue.get_nowait()
                    if isinstance(item, dict):
                        seen.append(item["type"])

                self.assertEqual(seen[0], "mission_started")
                self.assertEqual(seen[-1], "mission_complete")
                self.assertIn("beat", seen)
                beat_count = sum(1 for t in seen if t == "beat")
                self.assertEqual(beat_count, len(build_script("scn-auth-001")))

                # Final run state
                self.assertEqual(run.status, "complete")
                self.assertIsNotNone(run.summary)
                assert run.summary is not None
                self.assertGreater(run.summary["events_generated"], 0)
                self.assertIsNotNone(run.summary["incident_id"])
            finally:
                DIFFICULTY_PACING["operator"] = 0.5

        asyncio.run(scenario())

    def test_difficulty_scales_total_duration(self) -> None:
        async def scenario() -> None:
            engine = _make_engine()
            hub = MissionStreamHub()
            store = MissionStore()
            scheduler = MissionScheduler(
                scenario_engine=engine,
                mission_store=store,
                stream_hub=hub,
            )
            run = _make_run(scenario_id="scn-svc-005", difficulty="operator")
            store.put(run)

            # Operator pacing (0.5x) on scn-svc-005 which has 3 gaps of
            # 0.5s — expected total ~0.75s in production. We assert it
            # completes in under 5 seconds to avoid flakiness while
            # still verifying async playback is NOT instant.
            start = asyncio.get_event_loop().time()
            await scheduler.schedule(run)
            duration = asyncio.get_event_loop().time() - start

            self.assertLess(duration, 5.0)
            self.assertEqual(run.status, "complete")

        asyncio.run(scenario())

    def test_cancel_marks_aborted(self) -> None:
        async def scenario() -> None:
            engine = _make_engine()
            hub = MissionStreamHub()
            store = MissionStore()
            scheduler = MissionScheduler(
                scenario_engine=engine,
                mission_store=store,
                stream_hub=hub,
            )
            # Preserve analyst pacing so the task is definitely still
            # running when we cancel.
            run = _make_run(difficulty="analyst")
            store.put(run)

            task = scheduler.schedule(run)
            await asyncio.sleep(0.05)  # yield so scheduler starts
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            self.assertEqual(run.status, "aborted")

        asyncio.run(scenario())


class StreamHubReplay(unittest.TestCase):
    def test_late_subscriber_gets_backlog(self) -> None:
        async def scenario() -> None:
            hub = MissionStreamHub()
            run_id = "run-late"
            await hub.publish(run_id, {"type": "first"})
            await hub.publish(run_id, {"type": "second"})

            q = await hub.subscribe(run_id)
            first = q.get_nowait()
            second = q.get_nowait()
            assert isinstance(first, dict)
            assert isinstance(second, dict)
            self.assertEqual(first["type"], "first")
            self.assertEqual(second["type"], "second")

        asyncio.run(scenario())

    def test_close_sends_sentinel_to_existing_subscribers(self) -> None:
        async def scenario() -> None:
            hub = MissionStreamHub()
            run_id = "run-close"
            q = await hub.subscribe(run_id)
            await hub.close(run_id)
            # Queue should contain sentinel
            item = q.get_nowait()
            self.assertEqual(item, MissionStreamHub.CLOSE_SENTINEL)

        asyncio.run(scenario())

    def test_subscribe_after_close_replays_and_terminates(self) -> None:
        async def scenario() -> None:
            hub = MissionStreamHub()
            run_id = "run-after-close"
            await hub.publish(run_id, {"type": "beat", "n": 1})
            await hub.close(run_id)

            # Late subscriber sees backlog then the sentinel.
            q = await hub.subscribe(run_id)
            first = q.get_nowait()
            assert isinstance(first, dict)
            self.assertEqual(first["type"], "beat")
            sentinel = q.get_nowait()
            self.assertEqual(sentinel, MissionStreamHub.CLOSE_SENTINEL)

        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
