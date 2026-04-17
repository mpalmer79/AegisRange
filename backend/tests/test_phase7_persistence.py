"""Phase 7 — mission run persistence across worker restarts.

These tests drive PersistenceLayer + MissionStore directly (no HTTP)
so the SQLite round-trip is fully isolated. The contract:

- A run put into a MissionStore wired to persistence can be loaded by
  a fresh MissionStore against the same SQLite file.
- ``scratch_state`` (the per-run dict that threads session id through
  red-team commands) round-trips intact.
- ``command_history`` round-trips intact.
- Blue runs marked ``active`` at restart are flipped to ``failed`` —
  their scheduler task didn't survive the restart, so leaving them
  active would wedge the UI. Red runs keep their state.
"""

from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from app.persistence import PersistenceLayer
from app.services.mission_service import (
    CommandRecord,
    MissionRun,
    MissionStore,
    mission_run_from_dict,
    mission_run_to_dict,
)
from app.models import utc_now


class FakeStore:
    """Stub satisfying PersistenceLayer's `store` parameter — Phase 7's
    mission-run table doesn't read or write any other store state."""

    pass


def _persistence(tmpdir: str) -> PersistenceLayer:
    return PersistenceLayer(FakeStore(), db_path=Path(tmpdir) / "missions.db")


def _sample_run(
    *,
    perspective: str = "blue",
    status: str = "complete",
    run_id: str = "run-aaa",
    correlation_id: str = "corr-aaa",
) -> MissionRun:
    return MissionRun(
        run_id=run_id,
        scenario_id="scn-auth-001",
        perspective=perspective,  # type: ignore[arg-type]
        difficulty="analyst",
        correlation_id=correlation_id,
        created_at=utc_now(),
        status=status,  # type: ignore[arg-type]
        operated_by=None,
        summary={"events_generated": 6, "alerts_generated": 2},
        command_history=[
            CommandRecord(
                ts=utc_now(),
                raw="alerts list",
                verb_key="alerts list",
                kind="ok",
                lines=["1 alert(s):", "  AL-1  DET-AUTH-001"],
                effects={},
            ),
            CommandRecord(
                ts=utc_now(),
                raw="contain session --user user-alice --action revoke",
                verb_key="contain session",
                kind="ok",
                lines=["Revoked 1 session(s)"],
                effects={"containment_action": "revoke"},
            ),
        ],
        xp_delta=-10,
        scratch_state={"session_id": "session-abc", "actor_id": "user-bob"},
    )


class TestSerializationRoundtrip(unittest.TestCase):
    def test_to_dict_and_back_is_lossless(self) -> None:
        original = _sample_run()
        roundtripped = mission_run_from_dict(mission_run_to_dict(original))

        self.assertEqual(roundtripped.run_id, original.run_id)
        self.assertEqual(roundtripped.scenario_id, original.scenario_id)
        self.assertEqual(roundtripped.perspective, original.perspective)
        self.assertEqual(roundtripped.difficulty, original.difficulty)
        self.assertEqual(roundtripped.correlation_id, original.correlation_id)
        self.assertEqual(roundtripped.status, original.status)
        self.assertEqual(roundtripped.summary, original.summary)
        self.assertEqual(roundtripped.xp_delta, original.xp_delta)
        self.assertEqual(roundtripped.scratch_state, original.scratch_state)
        self.assertEqual(
            len(roundtripped.command_history), len(original.command_history)
        )
        self.assertEqual(
            roundtripped.command_history[0].verb_key,
            original.command_history[0].verb_key,
        )
        self.assertEqual(
            roundtripped.command_history[1].effects,
            original.command_history[1].effects,
        )


class TestStoreRestoresRunsAcrossRestart(unittest.TestCase):
    def test_put_then_reload_yields_same_runs(self) -> None:
        with TemporaryDirectory() as tmp:
            persistence = _persistence(tmp)

            store_a = MissionStore()
            store_a.enable_persistence(persistence)
            run = _sample_run()
            store_a.put(run)

            # Simulate a restart: brand-new store, same SQLite file.
            store_b = MissionStore()
            store_b.enable_persistence(persistence)
            loaded = store_b.load_from_persistence()
            self.assertEqual(loaded, 1)

            restored = store_b.get(run.run_id)
            self.assertIsNotNone(restored)
            assert restored is not None
            self.assertEqual(restored.run_id, run.run_id)
            self.assertEqual(restored.scratch_state.get("session_id"), "session-abc")
            self.assertEqual(len(restored.command_history), 2)

    def test_lookup_by_correlation_works_after_restart(self) -> None:
        with TemporaryDirectory() as tmp:
            persistence = _persistence(tmp)
            run = _sample_run(correlation_id="corr-special")

            store_a = MissionStore()
            store_a.enable_persistence(persistence)
            store_a.put(run)

            store_b = MissionStore()
            store_b.enable_persistence(persistence)
            store_b.load_from_persistence()

            via_corr = store_b.get_by_correlation("corr-special")
            self.assertIsNotNone(via_corr)
            assert via_corr is not None
            self.assertEqual(via_corr.run_id, run.run_id)


class TestActiveRunsTransitionOnRestart(unittest.TestCase):
    def test_blue_active_becomes_failed_on_load(self) -> None:
        with TemporaryDirectory() as tmp:
            persistence = _persistence(tmp)
            store_a = MissionStore()
            store_a.enable_persistence(persistence)

            # Blue run mid-scheduler at restart time.
            blue = _sample_run(
                perspective="blue", status="active", run_id="run-blue-active"
            )
            store_a.put(blue)

            store_b = MissionStore()
            store_b.enable_persistence(persistence)
            store_b.load_from_persistence()

            restored = store_b.get(blue.run_id)
            assert restored is not None
            self.assertEqual(restored.status, "failed")

    def test_red_active_stays_active_on_load(self) -> None:
        with TemporaryDirectory() as tmp:
            persistence = _persistence(tmp)
            store_a = MissionStore()
            store_a.enable_persistence(persistence)

            red = _sample_run(
                perspective="red",
                status="active",
                run_id="run-red-active",
                correlation_id="corr-red-active",
            )
            store_a.put(red)

            store_b = MissionStore()
            store_b.enable_persistence(persistence)
            store_b.load_from_persistence()

            restored = store_b.get(red.run_id)
            assert restored is not None
            self.assertEqual(restored.status, "active")
            self.assertEqual(restored.scratch_state.get("session_id"), "session-abc")

    def test_completed_runs_unchanged_on_load(self) -> None:
        with TemporaryDirectory() as tmp:
            persistence = _persistence(tmp)
            store_a = MissionStore()
            store_a.enable_persistence(persistence)
            done = _sample_run(perspective="blue", status="complete")
            store_a.put(done)

            store_b = MissionStore()
            store_b.enable_persistence(persistence)
            store_b.load_from_persistence()
            restored = store_b.get(done.run_id)
            assert restored is not None
            self.assertEqual(restored.status, "complete")


class TestPutUpdatesPersistedRow(unittest.TestCase):
    def test_subsequent_put_overwrites_persisted_data(self) -> None:
        with TemporaryDirectory() as tmp:
            persistence = _persistence(tmp)
            store_a = MissionStore()
            store_a.enable_persistence(persistence)

            run = _sample_run()
            store_a.put(run)

            # Mutate the run, put again — same primary key, replace.
            run.status = "aborted"
            run.command_history.append(
                CommandRecord(
                    ts=utc_now(),
                    raw="status",
                    verb_key="status",
                    kind="ok",
                    lines=["ok"],
                    effects={},
                )
            )
            store_a.put(run)

            store_b = MissionStore()
            store_b.enable_persistence(persistence)
            store_b.load_from_persistence()
            restored = store_b.get(run.run_id)
            assert restored is not None
            self.assertEqual(restored.status, "aborted")
            self.assertEqual(len(restored.command_history), 3)


if __name__ == "__main__":
    unittest.main()
