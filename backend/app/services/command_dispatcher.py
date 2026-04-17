"""Dispatch parsed commands to action handlers.

Each handler is a pure function of (``ParsedCommand``, ``DispatchContext``).
Handlers return a :class:`CommandResult` describing the transcript
output and any side effects (world mutations, beat publications, XP
adjustments). Handlers never raise — they either succeed or return a
result with ``kind="error"``.

Phase 3a ships Blue-team handlers for scn-auth-001. Red team follows
in Phase 3b; other scenarios in Phase 4.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from app.models import utc_now
from app.services.adversary_scripts import (
    Beat,
    BeatKind,
    ScriptContext,
    apply_beat,
)
from app.services.command_grammar import VerbSpec
from app.services.command_parser import ParsedCommand
from app.services.mission_service import MissionRun

CommandResultKind = Literal["ok", "error"]


@dataclass
class CommandResult:
    kind: CommandResultKind
    lines: list[str] = field(default_factory=list)
    # Machine-readable effects for UI rendering / objective checks.
    effects: dict[str, Any] = field(default_factory=dict)
    # If set, the handler wants the scheduler to publish a stream event.
    stream_event: dict[str, Any] | None = None

    @classmethod
    def ok(
        cls,
        *lines: str,
        effects: dict[str, Any] | None = None,
        stream_event: dict[str, Any] | None = None,
    ) -> "CommandResult":
        return cls(
            kind="ok",
            lines=list(lines),
            effects=effects or {},
            stream_event=stream_event,
        )

    @classmethod
    def error(cls, *lines: str) -> "CommandResult":
        return cls(kind="error", lines=list(lines))


@dataclass
class DispatchContext:
    """Everything a handler may need. Injected by the MissionService."""

    run: MissionRun
    scenario_engine: Any  # ScenarioEngine, avoid import cycle
    store: Any  # InMemoryStore
    help_service: Any  # HelpService


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _handler_help(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    verb_arg = cmd.positional.get("verb")
    if verb_arg:
        page = ctx.help_service.verb_help(verb_arg, ctx.run.perspective)
        if page is None:
            return CommandResult.error(
                f"No help for '{verb_arg}'. Try `help` with no argument to list verbs."
            )
        return CommandResult.ok(*page)
    return CommandResult.ok(*ctx.help_service.overview(ctx.run.perspective))


def _handler_hint(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    lines, xp_cost = ctx.help_service.next_hint(
        scenario_id=ctx.run.scenario_id,
        perspective=ctx.run.perspective,
        difficulty=ctx.run.difficulty,
        commands_issued=[r.verb_key for r in ctx.run.command_history],
    )
    effects: dict[str, Any] = {"hint_xp_cost": xp_cost}
    return CommandResult.ok(*lines, effects=effects)


def _handler_status(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    store = ctx.store
    corr = ctx.run.correlation_id
    events = sum(1 for e in store.get_events() if e.correlation_id == corr)
    alerts = sum(1 for a in store.get_alerts() if a.correlation_id == corr)
    incident = store.get_incident(corr)
    lines = [
        f"run_id           {ctx.run.run_id}",
        f"scenario         {ctx.run.scenario_id}",
        f"perspective      {ctx.run.perspective}",
        f"difficulty       {ctx.run.difficulty}",
        f"status           {ctx.run.status}",
        f"events captured  {events}",
        f"alerts raised    {alerts}",
        f"incident         {incident.incident_id if incident else '—'}",
        f"commands issued  {len(ctx.run.command_history)}",
    ]
    return CommandResult.ok(*lines)


def _handler_alerts_list(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    corr = ctx.run.correlation_id
    severity = cmd.flags.get("severity")
    alerts = [a for a in ctx.store.get_alerts() if a.correlation_id == corr]
    if severity:
        alerts = [a for a in alerts if a.severity.value == severity]
    if not alerts:
        return CommandResult.ok("No alerts yet. Wait for the adversary to act.")
    lines = [f"{len(alerts)} alert(s):"]
    for a in alerts:
        lines.append(
            f"  {a.alert_id}  {a.rule_id:<14} {a.severity.value:<8} actor={a.actor_id}"
        )
    return CommandResult.ok(*lines)


def _handler_alerts_show(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    target_id = cmd.positional["alert_id"]
    corr = ctx.run.correlation_id
    alert = next(
        (
            a
            for a in ctx.store.get_alerts()
            if a.correlation_id == corr and a.alert_id == target_id
        ),
        None,
    )
    if alert is None:
        return CommandResult.error(
            f"Alert '{target_id}' not found in this run. "
            f"Try `alerts list` to see what's available."
        )
    lines = [
        f"alert_id         {alert.alert_id}",
        f"rule             {alert.rule_id} — {alert.rule_name}",
        f"severity         {alert.severity.value}",
        f"confidence       {alert.confidence.value}",
        f"actor            {alert.actor_id}",
        f"events           {len(alert.contributing_event_ids)} contributing",
        f"summary          {alert.summary}",
    ]
    return CommandResult.ok(*lines)


def _handler_events_tail(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    corr = ctx.run.correlation_id
    last = cmd.flags.get("last", 10) or 10
    user = cmd.flags.get("user")
    events = [e for e in ctx.store.get_events() if e.correlation_id == corr]
    if user:
        events = [e for e in events if e.actor_id == user]
    events = events[-int(last) :]
    if not events:
        return CommandResult.ok("No matching events yet.")
    lines = [f"{len(events)} event(s):"]
    for e in events:
        lines.append(
            f"  {e.timestamp.strftime('%H:%M:%S')}  {e.event_type:<30} "
            f"actor={e.actor_id or '-':<14} ip={e.source_ip or '-'}"
        )
    return CommandResult.ok(*lines)


def _handler_correlate(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    corr = ctx.run.correlation_id
    incident = ctx.store.get_incident(corr)
    if incident is None:
        return CommandResult.error(
            "No incident to correlate yet. Wait for more alerts, then retry."
        )
    alert_ids = cmd.flags.get("alerts") or []
    if alert_ids:
        return CommandResult.ok(
            f"Confirmed correlation of {len(alert_ids)} alert(s) "
            f"into incident {incident.incident_id}.",
            effects={"correlated_alert_ids": alert_ids},
        )
    return CommandResult.ok(
        f"Incident {incident.incident_id} already open "
        f"(auto-correlated from {len(incident.detection_ids)} detections)."
    )


def _handler_contain_session(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    user = cmd.flags["user"]
    action = cmd.flags["action"]
    # The detection pipeline's auto-response may have already revoked
    # sessions. This handler records the player's explicit containment
    # so objective evaluation can credit them with it. It also issues
    # the action against the store as belt-and-braces.
    if action == "revoke":
        before = set(ctx.store.get_all_revoked_sessions())
        session_id = ctx.store.actor_sessions.get(user)
        if session_id and not ctx.store.is_session_revoked(session_id):
            ctx.store.revoke_session(session_id)
        after = set(ctx.store.get_all_revoked_sessions())
        newly_revoked = sorted(after - before)
        if newly_revoked:
            lines = [
                f"Revoked {len(newly_revoked)} session(s) for {user}:",
                *(f"  - {sid}" for sid in newly_revoked),
            ]
        elif session_id:
            lines = [
                f"{user}'s session was already revoked (likely by auto-response).",
                "Containment recorded.",
            ]
        else:
            lines = [
                f"{user} has no active session on record. Containment recorded.",
            ]
    else:  # stepup
        ctx.store.require_step_up(user)
        lines = [f"Step-up authentication now required for {user} on next request."]
    return CommandResult.ok(
        *lines,
        effects={
            "containment_user": user,
            "containment_action": action,
        },
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,  # player-driven, outside the adversary script
            "beat_total": -1,
            "beat": {
                "kind": "player_contain_session",
                "label": f"Analyst contains {user} via {action}",
            },
        },
    )


def _handler_contain_document(
    cmd: ParsedCommand, ctx: DispatchContext
) -> CommandResult:
    doc_id = cmd.flags["id"]
    action = cmd.flags["action"]
    actor = cmd.flags.get("actor")
    if action == "quarantine":
        before = set(ctx.store.get_all_quarantined_artifacts())
        ctx.store.quarantine_artifact(doc_id)
        newly = sorted(set(ctx.store.get_all_quarantined_artifacts()) - before)
        if newly:
            lines = [f"Quarantined document {doc_id}. No further access."]
        else:
            lines = [f"{doc_id} was already quarantined. Containment recorded."]
    else:  # restrict
        target = actor or "user-bob"
        before = set(ctx.store.get_all_download_restricted())
        ctx.store.restrict_downloads(target)
        newly = sorted(set(ctx.store.get_all_download_restricted()) - before)
        if newly:
            lines = [f"Download privileges revoked for {target} (doc: {doc_id})."]
        else:
            lines = [f"{target} was already download-restricted. Containment recorded."]
    return CommandResult.ok(
        *lines,
        effects={
            "containment_document": doc_id,
            "containment_action": action,
        },
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,
            "beat_total": -1,
            "beat": {
                "kind": "player_contain_document",
                "label": f"Analyst contains {doc_id} via {action}",
            },
        },
    )


def _handler_contain_service(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    svc_id = cmd.flags["id"]
    action = cmd.flags["action"]  # only 'disable' today
    before = set(ctx.store.get_all_disabled_services())
    ctx.store.disable_service(svc_id)
    newly = sorted(set(ctx.store.get_all_disabled_services()) - before)
    if newly:
        lines = [f"Service {svc_id} disabled. Further privileged calls rejected."]
    else:
        lines = [f"{svc_id} was already disabled. Containment recorded."]
    return CommandResult.ok(
        *lines,
        effects={
            "containment_service": svc_id,
            "containment_action": action,
        },
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,
            "beat_total": -1,
            "beat": {
                "kind": "player_contain_service",
                "label": f"Analyst disables {svc_id}",
            },
        },
    )


# ---------------------------------------------------------------------------
# Red-team handlers (Phase 3b)
#
# The player is the adversary. Each command emits events that flow
# through the same detection + response pipeline the Blue side reads
# from. ``attempt login`` delegates to the adversary-script beat
# machinery so event shapes stay byte-equivalent to the scripted
# replay.
# ---------------------------------------------------------------------------


# Known-user credentials for the Phase 3b reference scenario. Keeping
# this in the dispatcher (rather than reading IdentityService private
# state) keeps handlers pure and testable.
_KNOWN_PASSWORDS: dict[str, str] = {
    "alice": "Correct_Horse_42!",
    "bob": "Hunter2_Strong_99!",
}


def _script_ctx(ctx: DispatchContext) -> ScriptContext:
    """Build the ScriptContext the adversary beat handlers expect.

    We keep a scratch state dict on the mission run so successive
    player beats (e.g. login → session reuse) can share the session
    id minted by an earlier successful login."""
    state = getattr(ctx.run, "_red_state", None)
    if state is None:
        state = {}
        # Stash on the run so subsequent commands see the same state.
        ctx.run.__dict__["_red_state"] = state
    return ScriptContext(
        correlation_id=ctx.run.correlation_id,
        pipeline=ctx.scenario_engine.pipeline,
        identity=ctx.scenario_engine.identity,
        documents=ctx.scenario_engine.documents,
        store=ctx.scenario_engine.store,
        state=state,
    )


def _handler_recon_users(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    # Free recon action — no event fires, no world mutation.
    lines = [
        "Visible identities on target tenant:",
        "  user-alice       analyst   sso/password",
        "  user-bob         admin     sso/password",
        "",
        "Hint: the brute-force detector trips at ~5 failed attempts "
        "per source IP within a short window.",
    ]
    return CommandResult.ok(*lines)


def _handler_attempt_login(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    user = cmd.flags["user"]
    source_ip = cmd.flags["from"]
    password = cmd.flags.get("password")
    # Accept either "alice" or "user-alice" for the --user flag.
    bare_user = user.removeprefix("user-") if user.startswith("user-") else user
    canonical_user = f"user-{bare_user}"

    script_ctx = _script_ctx(ctx)
    succeeded = password is not None and _KNOWN_PASSWORDS.get(bare_user) == password

    if succeeded:
        beat = Beat(
            kind=BeatKind.SUCCESSFUL_LOGIN,
            label=f"Intruder logs in as {canonical_user} from {source_ip}",
            delay_before_seconds=0.0,
            params={
                "username": bare_user,
                "password": password,
                "source_ip": source_ip,
            },
        )
    else:
        beat = Beat(
            kind=BeatKind.FAILED_LOGIN,
            label=(f"Intruder fails login as {canonical_user} from {source_ip}"),
            delay_before_seconds=0.0,
            params={"username": bare_user, "source_ip": source_ip},
        )

    apply_beat(beat, script_ctx)

    if succeeded:
        session_id = (script_ctx.state or {}).get("session_id", "<unknown>")
        lines = [
            f"[200] access granted as {canonical_user} from {source_ip}",
            f"      session_id = {session_id}",
        ]
        effects = {
            "attempt_user": canonical_user,
            "attempt_result": "success",
            "attempt_source_ip": source_ip,
        }
    else:
        reason = "no password supplied" if password is None else "invalid_credentials"
        lines = [
            f"[401] authentication rejected for {canonical_user} "
            f"from {source_ip} ({reason})",
        ]
        effects = {
            "attempt_user": canonical_user,
            "attempt_result": "failure",
            "attempt_source_ip": source_ip,
        }

    return CommandResult.ok(
        *lines,
        effects=effects,
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,  # player-driven, outside any scripted sequence
            "beat_total": -1,
            "beat": {"kind": beat.kind.value, "label": beat.label},
        },
    )


def _handler_session_reuse(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    source_ip = cmd.flags["from"]
    script_ctx = _script_ctx(ctx)
    session_id = (script_ctx.state or {}).get("session_id")
    if session_id is None:
        return CommandResult.error(
            "You don't have a session yet. Run `attempt login` with a valid "
            "--password first."
        )
    actor_id = (script_ctx.state or {}).get("actor_id", "user-unknown")
    actor_role = (script_ctx.state or {}).get("actor_role", "analyst")
    beat = Beat(
        kind=BeatKind.SESSION_REUSE,
        label=f"Intruder reuses {actor_id}'s session from {source_ip}",
        delay_before_seconds=0.0,
        params={
            "actor_id": actor_id,
            "actor_role": actor_role,
            "source_ip": source_ip,
            "session_id": session_id,
        },
    )
    apply_beat(beat, script_ctx)
    return CommandResult.ok(
        f"[200] session {session_id} replayed from {source_ip}",
        effects={"session_reused_from": source_ip},
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,
            "beat_total": -1,
            "beat": {"kind": beat.kind.value, "label": beat.label},
        },
    )


def _handler_doc_read(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    doc_id = cmd.flags["id"]
    burst = int(cmd.flags.get("burst", 1) or 1)
    role_override = cmd.flags.get("as")
    source_ip_override = cmd.flags.get("from")
    script_ctx = _script_ctx(ctx)

    session_id = (script_ctx.state or {}).get("session_id")
    actor_id = (script_ctx.state or {}).get("actor_id", "user-bob")
    actor_role = role_override or (script_ctx.state or {}).get("actor_role", "admin")
    source_ip = source_ip_override or (script_ctx.state or {}).get(
        "source_ip", "198.51.100.10"
    )
    if session_id is None:
        return CommandResult.error(
            "No active session. Run `attempt login --password ...` first."
        )

    for i in range(max(1, burst)):
        beat = Beat(
            kind=BeatKind.DOCUMENT_READ,
            label=(
                f"Intruder reads {doc_id} ({i + 1}/{burst})"
                if burst > 1
                else f"Intruder reads {doc_id}"
            ),
            delay_before_seconds=0.0,
            params={
                "role": actor_role,
                "document_id": doc_id,
                "label_suffix": i if burst > 1 else None,
                "actor_id": actor_id,
                "source_ip": source_ip,
                "session_id": session_id,
                "enforce_access": False,
            },
        )
        apply_beat(beat, script_ctx)

    return CommandResult.ok(
        f"[200] read {doc_id} x{burst} as {actor_id} from {source_ip}",
        effects={
            "doc_read_id": doc_id,
            "doc_read_burst": burst,
        },
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,
            "beat_total": -1,
            "beat": {
                "kind": "player_doc_read",
                "label": f"Intruder reads {doc_id} x{burst}",
            },
        },
    )


def _handler_doc_download(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    doc_id = cmd.flags["id"]
    role_override = cmd.flags.get("as")
    source_ip_override = cmd.flags.get("from")
    script_ctx = _script_ctx(ctx)

    session_id = (script_ctx.state or {}).get("session_id")
    actor_id = (script_ctx.state or {}).get("actor_id", "user-bob")
    actor_role = role_override or (script_ctx.state or {}).get("actor_role", "admin")
    source_ip = source_ip_override or (script_ctx.state or {}).get(
        "source_ip", "198.51.100.10"
    )
    if session_id is None:
        return CommandResult.error(
            "No active session. Run `attempt login --password ...` first."
        )

    beat = Beat(
        kind=BeatKind.DOCUMENT_DOWNLOAD,
        label=f"Intruder downloads {doc_id}",
        delay_before_seconds=0.0,
        params={
            "role": actor_role,
            "document_id": doc_id,
            "actor_id": actor_id,
            "source_ip": source_ip,
            "session_id": session_id,
            "enforce_access": False,
        },
    )
    apply_beat(beat, script_ctx)

    return CommandResult.ok(
        f"[200] downloaded {doc_id} as {actor_id} from {source_ip}",
        effects={"doc_download_id": doc_id},
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,
            "beat_total": -1,
            "beat": {
                "kind": "player_doc_download",
                "label": f"Intruder downloads {doc_id}",
            },
        },
    )


def _handler_svc_call(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    svc_id = cmd.flags["service"]
    route = cmd.flags["op"]
    script_ctx = _script_ctx(ctx)
    beat = Beat(
        kind=BeatKind.AUTHORIZATION_FAILURE,
        label=f"{svc_id} attempts {route}",
        delay_before_seconds=0.0,
        params={
            "actor_id": svc_id,
            "actor_type": "service",
            "actor_role": "service",
            "route": route,
            "source_ip": "10.0.1.50",
        },
    )
    apply_beat(beat, script_ctx)
    return CommandResult.ok(
        f"[403] {svc_id} denied on {route} (not in service scope)",
        effects={
            "svc_call_service": svc_id,
            "svc_call_route": route,
        },
        stream_event={
            "type": "beat",
            "ts": utc_now().isoformat(),
            "beat_index": -1,
            "beat_total": -1,
            "beat": {
                "kind": "player_svc_call",
                "label": f"{svc_id} attempts {route}",
            },
        },
    )


_HANDLERS: dict[str, Callable[[ParsedCommand, DispatchContext], CommandResult]] = {
    "help": _handler_help,
    "hint": _handler_hint,
    "status": _handler_status,
    # Blue
    "alerts.list": _handler_alerts_list,
    "alerts.show": _handler_alerts_show,
    "events.tail": _handler_events_tail,
    "correlate": _handler_correlate,
    "contain.session": _handler_contain_session,
    "contain.document": _handler_contain_document,
    "contain.service": _handler_contain_service,
    # Red
    "recon.users": _handler_recon_users,
    "attempt.login": _handler_attempt_login,
    "session.reuse": _handler_session_reuse,
    "doc.read": _handler_doc_read,
    "doc.download": _handler_doc_download,
    "svc.call": _handler_svc_call,
}


def dispatch(cmd: ParsedCommand, ctx: DispatchContext) -> CommandResult:
    handler = _HANDLERS.get(cmd.verb.handler)
    if handler is None:
        return CommandResult.error(
            f"Command '{cmd.verb.key}' has no registered handler. "
            f"This is a bug — please report."
        )
    return handler(cmd, ctx)


def _describe_verb(verb: VerbSpec) -> str:
    return f"{verb.key:<22} — {verb.effective_summary()}"
