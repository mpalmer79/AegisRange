"""Adversary-script package.

Split form of the former ``app.services.adversary_scripts`` single-file
module. Public API preserved via ``app.services.adversary_scripts``
shim and through direct imports from this package.

Layout:
- ``base.py``     — ``Beat``, ``BeatKind``, ``ScriptContext``, ``_new_event``
- ``handlers.py`` — ``apply_beat`` and per-BeatKind handler functions
- ``scripts.py``  — one ``_script_*`` builder per scenario, ``build_script``,
                    ``DIFFICULTY_PACING``, ``total_duration_seconds``
"""

from __future__ import annotations

from .base import Beat, BeatKind, ScriptContext, _new_event
from .handlers import apply_beat
from .scripts import (
    DIFFICULTY_PACING,
    build_script,
    total_duration_seconds,
)

__all__ = [
    "Beat",
    "BeatKind",
    "ScriptContext",
    "_new_event",
    "apply_beat",
    "DIFFICULTY_PACING",
    "build_script",
    "total_duration_seconds",
]
