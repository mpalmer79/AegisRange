"""Backwards-compatible re-export shim.

The contents of this module were split into the ``app.services.adversary``
package in 0.9.0. Every name that used to live here still imports from
here — only the implementation moved. See
``app/services/adversary/__init__.py`` for the current layout.
"""

from __future__ import annotations

from app.services.adversary import (  # noqa: F401
    DIFFICULTY_PACING,
    Beat,
    BeatKind,
    ScriptContext,
    _new_event,
    apply_beat,
    build_script,
    total_duration_seconds,
)

__all__ = [
    "DIFFICULTY_PACING",
    "Beat",
    "BeatKind",
    "ScriptContext",
    "_new_event",
    "apply_beat",
    "build_script",
    "total_duration_seconds",
]
