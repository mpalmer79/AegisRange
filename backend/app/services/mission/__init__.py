"""Mission package — split form of ``app.services.mission_service``.

Layout:
- ``run.py``      — ``MissionRun``, ``CommandRecord``, type aliases,
                    ``SCENARIO_LABEL``/``SUPPORTED_SCENARIOS``,
                    ``build_run_snapshot``, ``mission_run_to_dict`` /
                    ``mission_run_from_dict``
- ``store.py``    — ``MissionStore`` (in-process registry with SQLite persistence)
- ``service.py``  — ``MissionService`` (orchestration)

Public API is preserved via ``app.services.mission_service`` shim.
"""

from __future__ import annotations

from .run import (
    SCENARIO_LABEL,
    SUPPORTED_SCENARIOS,
    CommandRecord,
    Difficulty,
    MissionRun,
    MissionStatus,
    Perspective,
    build_run_snapshot,
    mission_run_from_dict,
    mission_run_to_dict,
)
from .service import MissionService
from .store import MissionStore

__all__ = [
    "SCENARIO_LABEL",
    "SUPPORTED_SCENARIOS",
    "CommandRecord",
    "Difficulty",
    "MissionRun",
    "MissionStatus",
    "MissionService",
    "MissionStore",
    "Perspective",
    "build_run_snapshot",
    "mission_run_from_dict",
    "mission_run_to_dict",
]
