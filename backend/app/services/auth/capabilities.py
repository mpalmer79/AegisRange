"""Capability map — boolean flags derived from a role's numeric level.

The frontend no longer knows the role ladder; it reads the
``capabilities`` list off the ``/auth/me`` response instead. Adding a
new capability on the backend (with a threshold) automatically flows
to the UI at next login with no frontend change.
"""

from __future__ import annotations

from .roles import ROLES

# Minimum role level (from ROLES[role]["level"]) required to hold each
# capability. Keep these in step with what routers actually enforce:
# - run_scenarios:        red_team/analyst (level 50) can run scenarios
# - manage_incidents:     analyst (level 50) and up can mutate incidents
# - view_analytics:       analyst (level 50) and up can read analytics
# - administer_platform:  admin (level 100) only
CAPABILITY_MIN_LEVEL: dict[str, int] = {
    "run_scenarios": 50,
    "manage_incidents": 50,
    "view_analytics": 50,
    "administer_platform": 100,
}


def _level_for(role: str) -> int:
    entry = ROLES.get(role)
    if entry is None:
        return 0
    level = entry.get("level")
    return int(level) if isinstance(level, int) else 0


def capabilities_for(role: str) -> list[str]:
    """Return the capability names a role holds, sorted for determinism."""
    level = _level_for(role)
    return sorted(
        cap for cap, min_lvl in CAPABILITY_MIN_LEVEL.items() if level >= min_lvl
    )


def level_for(role: str) -> int:
    """Public accessor for a role's numeric level (used by ``/auth/me``)."""
    return _level_for(role)
