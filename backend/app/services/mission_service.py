"""Backwards-compatible re-export shim.

The contents of this module were split into the ``app.services.mission``
package in 0.9.0. Every name that used to live here still imports from
here — only the implementation moved. See
``app/services/mission/__init__.py`` for the current layout.
"""

from __future__ import annotations

from app.services.mission import (  # noqa: F401
    SCENARIO_LABEL,
    SUPPORTED_SCENARIOS,
    CommandRecord,
    Difficulty,
    MissionRun,
    MissionService,
    MissionStatus,
    MissionStore,
    Perspective,
    build_run_snapshot,
    mission_run_from_dict,
    mission_run_to_dict,
)

__all__ = [
    "SCENARIO_LABEL",
    "SUPPORTED_SCENARIOS",
    "CommandRecord",
    "Difficulty",
    "MissionRun",
    "MissionService",
    "MissionStatus",
    "MissionStore",
    "Perspective",
    "build_run_snapshot",
    "mission_run_from_dict",
    "mission_run_to_dict",
]
