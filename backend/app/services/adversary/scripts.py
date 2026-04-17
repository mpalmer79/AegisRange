"""Per-scenario beat sequence builders.

Each ``_script_*`` function returns a fresh list of :class:`Beat`
objects for one scenario. ``build_script`` is the public dispatcher
that pulls the right builder and hands out a fresh copy with mutable
params (so transient fields like ``session_id`` don't leak across
runs).
"""

from __future__ import annotations

from typing import Any

from .base import Beat, BeatKind


def _script_auth_001() -> list[Beat]:
    beats: list[Beat] = []
    for attempt in range(1, 6):
        beats.append(
            Beat(
                kind=BeatKind.FAILED_LOGIN,
                label=(
                    f"Intruder attempts to authenticate as alice "
                    f"({attempt}/5) from 203.0.113.10"
                ),
                delay_before_seconds=2.0 if attempt > 1 else 0.0,
                params={"username": "alice", "source_ip": "203.0.113.10"},
            )
        )
    beats.append(
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="Intruder succeeds with a valid credential for alice",
            delay_before_seconds=3.0,
            params={
                "username": "alice",
                "password": "Correct_Horse_42!",
                "source_ip": "203.0.113.10",
            },
        )
    )
    return beats


def _script_session_002() -> list[Beat]:
    # The scenario logs bob in with a valid password, then emits two
    # authorization.check.success events — one from the original IP
    # and one from a different IP, simulating token theft.
    #
    # Legacy scn-session-002 does NOT emit a login.success event — the
    # authenticate() call is setup-only. Pass ``emit_event=False`` so
    # the script stays byte-equivalent to the legacy engine.
    return [
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="bob authenticates from 198.51.100.10",
            delay_before_seconds=0.0,
            params={
                "username": "bob",
                "password": "Hunter2_Strong_99!",
                "source_ip": "198.51.100.10",
                "emit_event": False,
            },
        ),
        Beat(
            kind=BeatKind.SESSION_TOKEN_ISSUED,
            label="Session token issued to bob",
            delay_before_seconds=1.5,
            params={
                "actor_id": "user-bob",
                "actor_role": "admin",
                "source_ip": "198.51.100.10",
                "session_id": None,
            },
        ),
        Beat(
            kind=BeatKind.SESSION_REUSE,
            label="Same session used from 198.51.100.10",
            delay_before_seconds=2.0,
            params={
                "actor_id": "user-bob",
                "actor_role": "admin",
                "source_ip": "198.51.100.10",
                "session_id": None,
            },
        ),
        Beat(
            kind=BeatKind.SESSION_REUSE,
            label="Same session reused from 203.0.113.55 (anomalous origin)",
            delay_before_seconds=2.0,
            params={
                "actor_id": "user-bob",
                "actor_role": "admin",
                "source_ip": "203.0.113.55",
                "session_id": None,
            },
        ),
    ]


def _script_doc_003() -> list[Beat]:
    # Legacy scn-doc-003 does the login as setup-only, without an
    # emitted login.success event. emit_event=False mirrors that.
    beats: list[Beat] = [
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="bob authenticates from 198.51.100.10",
            delay_before_seconds=0.0,
            params={
                "username": "bob",
                "password": "Hunter2_Strong_99!",
                "source_ip": "198.51.100.10",
                "emit_event": False,
            },
        )
    ]
    for index in range(20):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Bulk read doc-002 ({index + 1}/20)",
                delay_before_seconds=0.3,
                params={
                    "role": "admin",
                    "document_id": "doc-002",
                    "label_suffix": index,
                    "actor_id": "user-bob",
                    "source_ip": "198.51.100.10",
                    "sensitivity_score": 80,
                },
            )
        )
    return beats


def _script_doc_004() -> list[Beat]:
    beats: list[Beat] = [
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="bob authenticates from 198.51.100.10",
            delay_before_seconds=0.0,
            params={
                "username": "bob",
                "password": "Hunter2_Strong_99!",
                "source_ip": "198.51.100.10",
                "emit_event": False,
            },
        )
    ]
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Read {doc_id}",
                delay_before_seconds=0.7,
                params={
                    "role": "admin",
                    "document_id": doc_id,
                    "actor_id": "user-bob",
                    "source_ip": "198.51.100.10",
                    "sensitivity_score": 90,
                },
            )
        )
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_DOWNLOAD,
                label=f"Download {doc_id}",
                delay_before_seconds=0.7,
                params={
                    "role": "admin",
                    "document_id": doc_id,
                    "actor_id": "user-bob",
                    "source_ip": "198.51.100.10",
                    "sensitivity_score": 90,
                },
            )
        )
    return beats


def _script_svc_005() -> list[Beat]:
    return [
        Beat(
            kind=BeatKind.AUTHORIZATION_FAILURE,
            label=f"svc-data-processor attempts {route}",
            delay_before_seconds=0.5 if idx > 0 else 0.0,
            params={
                "actor_id": "svc-data-processor",
                "actor_type": "service",
                "actor_role": "service",
                "route": route,
                "source_ip": "10.0.1.50",
            },
        )
        for idx, route in enumerate(
            ["/admin/config", "/admin/secrets", "/admin/users", "/admin/audit"]
        )
    ]


def _script_corr_006() -> list[Beat]:
    beats: list[Beat] = []
    # Phase 1: credential abuse.
    for attempt in range(1, 6):
        beats.append(
            Beat(
                kind=BeatKind.FAILED_LOGIN,
                label=f"Credential spray {attempt}/5 against alice",
                delay_before_seconds=1.5 if attempt > 1 else 0.0,
                params={"username": "alice", "source_ip": "203.0.113.10"},
            )
        )
    beats.append(
        Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label="Intruder succeeds as alice",
            delay_before_seconds=2.5,
            params={
                "username": "alice",
                "password": "Correct_Horse_42!",
                "source_ip": "203.0.113.10",
            },
        )
    )
    # Phase 2: bulk document reads.
    docs_cycle = ("doc-001", "doc-002")
    for index in range(20):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Bulk read {docs_cycle[index % 2]} ({index + 1}/20)",
                delay_before_seconds=0.25,
                params={
                    "role": "analyst",
                    "document_id": docs_cycle[index % 2],
                    "label_suffix": index,
                    "actor_id": "user-alice",
                    "source_ip": "203.0.113.10",
                    "sensitivity_score": 80,
                    "session_id": None,
                },
            )
        )
    # Phase 3: read-to-download exfiltration.
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_READ,
                label=f"Read {doc_id} ahead of download",
                delay_before_seconds=0.5,
                params={
                    "role": "analyst",
                    "document_id": doc_id,
                    "actor_id": "user-alice",
                    "source_ip": "203.0.113.10",
                    "sensitivity_score": 90,
                    "enforce_access": doc_id in ("doc-001", "doc-002"),
                    "session_id": None,
                },
            )
        )
    for doc_id in ("doc-001", "doc-002", "doc-003"):
        beats.append(
            Beat(
                kind=BeatKind.DOCUMENT_DOWNLOAD,
                label=f"Download {doc_id}",
                delay_before_seconds=0.5,
                params={
                    "role": "analyst",
                    "document_id": doc_id,
                    "actor_id": "user-alice",
                    "source_ip": "203.0.113.10",
                    "sensitivity_score": 90,
                    "enforce_access": False,
                    "session_id": None,
                },
            )
        )
    return beats


def _script_tutorial_000() -> list[Beat]:
    # Single failed-login beat — gives the player one event to inspect
    # with `events tail` while learning the console. No alerts, no
    # incident: the tutorial is about the verbs, not the detection
    # surface.
    return [
        Beat(
            kind=BeatKind.FAILED_LOGIN,
            label="Tutorial demo: a failed login from 203.0.113.10",
            delay_before_seconds=0.0,
            params={"username": "alice", "source_ip": "203.0.113.10"},
        ),
    ]


_SCRIPT_BUILDERS: dict[str, Any] = {
    "scn-tutorial-000": _script_tutorial_000,
    "scn-auth-001": _script_auth_001,
    "scn-session-002": _script_session_002,
    "scn-doc-003": _script_doc_003,
    "scn-doc-004": _script_doc_004,
    "scn-svc-005": _script_svc_005,
    "scn-corr-006": _script_corr_006,
}


def build_script(scenario_id: str) -> list[Beat]:
    """Return a fresh mutable list of beats for ``scenario_id``.

    Beats are frozen dataclasses; the list itself is fresh per call so
    transient fields (e.g. session_id filled in at replay) do not leak
    across runs when stored in ``params``."""
    builder = _SCRIPT_BUILDERS.get(scenario_id)
    if builder is None:
        raise ValueError(f"No adversary script for scenario: {scenario_id}")
    # Make a shallow copy of params so replay mutations don't persist.
    return [
        Beat(
            kind=b.kind,
            label=b.label,
            delay_before_seconds=b.delay_before_seconds,
            params=dict(b.params),
        )
        for b in builder()
    ]


DIFFICULTY_PACING: dict[str, float] = {
    "recruit": 1.5,  # slower, teach-first
    "analyst": 1.0,  # baseline
    "operator": 0.5,  # tight time pressure
}


def total_duration_seconds(beats: list[Beat], *, difficulty: str = "analyst") -> float:
    multiplier = DIFFICULTY_PACING.get(difficulty, 1.0)
    return sum(b.delay_before_seconds for b in beats) * multiplier
