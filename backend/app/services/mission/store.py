"""In-process registry of mission runs with optional SQLite persistence."""

from __future__ import annotations

from threading import RLock
from typing import Any

from .run import MissionRun, mission_run_from_dict, mission_run_to_dict


class MissionStore:
    """In-process registry of mission runs keyed by ``run_id``.

    When a persistence layer is attached via :meth:`enable_persistence`,
    every ``put()`` also upserts to SQLite. On startup the caller should
    invoke :meth:`load_from_persistence` to restore prior runs.
    """

    def __init__(self) -> None:
        self._runs: dict[str, MissionRun] = {}
        self._by_correlation: dict[str, str] = {}
        self._lock = RLock()
        self._persistence: Any = None

    def enable_persistence(self, persistence: Any) -> None:
        """Attach a :class:`PersistenceLayer`. Subsequent ``put()`` calls
        upsert the mission into SQLite; ``load_from_persistence`` can
        then restore state on startup."""
        self._persistence = persistence

    def put(self, run: MissionRun) -> None:
        with self._lock:
            self._runs[run.run_id] = run
            self._by_correlation[run.correlation_id] = run.run_id
        # Persist outside the lock — SQLite has its own serialization.
        if self._persistence is not None:
            self._persistence.persist_mission_run(
                run.run_id, run.correlation_id, mission_run_to_dict(run)
            )

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

    def load_from_persistence(self) -> int:
        """Restore every persisted mission run into memory. Blue runs
        still in ``active`` status at restart are marked ``failed`` —
        the scheduler task that was playing their adversary script was
        lost when the worker exited, and silently leaving them
        ``active`` would wedge the UI. Red runs keep their state
        because no scheduler task owns them; the player drives them.

        Returns the number of runs loaded."""
        if self._persistence is None:
            return 0
        rows = self._persistence.load_mission_runs()
        loaded = 0
        with self._lock:
            for data in rows:
                try:
                    run = mission_run_from_dict(data)
                except (KeyError, ValueError):
                    # Skip corrupt rows rather than failing startup.
                    continue
                # Blue runs with an in-flight scheduler are dead after
                # a restart — their asyncio task didn't survive. Mark
                # them failed so the UI surfaces the right state.
                if run.perspective == "blue" and run.status == "active":
                    run.status = "failed"
                self._runs[run.run_id] = run
                self._by_correlation[run.correlation_id] = run.run_id
                loaded += 1
        # Persist the transitioned statuses so a second restart
        # doesn't re-flip anything.
        if self._persistence is not None:
            for run in list(self._runs.values()):
                self._persistence.persist_mission_run(
                    run.run_id,
                    run.correlation_id,
                    mission_run_to_dict(run),
                )
        return loaded
