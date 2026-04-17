"""Tokenizer + grammar-aware parser for mission commands.

Takes a raw line the player typed into the console and either returns
a :class:`ParsedCommand` — which the dispatcher can run — or a
:class:`ParseError` describing exactly what was wrong.

The tokenizer supports ``"double-quoted"`` and ``'single-quoted'``
strings so players can submit notes that contain spaces. Flags follow
the usual ``--name value`` or ``--name=value`` shapes.
"""

from __future__ import annotations

import shlex
from dataclasses import dataclass
from typing import Any, Literal

from app.services.command_grammar import (
    FlagSpec,
    Perspective,
    PositionalSpec,
    VerbSpec,
    find_verb,
    verbs_for,
)

ParseErrorKind = Literal[
    "empty",
    "tokenize",
    "unknown_verb",
    "unknown_subcommand",
    "missing_positional",
    "missing_flag",
    "unknown_flag",
    "invalid_flag_value",
]


@dataclass(frozen=True)
class ParsedCommand:
    verb: VerbSpec
    positional: dict[str, Any]
    flags: dict[str, Any]
    raw: str


@dataclass(frozen=True)
class ParseError:
    kind: ParseErrorKind
    message: str
    # Optional suggestion — e.g. closest known verb for typo recovery.
    suggestion: str | None = None


@dataclass(frozen=True)
class ParseOutcome:
    ok: ParsedCommand | None = None
    err: ParseError | None = None

    @property
    def is_ok(self) -> bool:
        return self.ok is not None


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


def parse(raw: str, *, perspective: Perspective) -> ParseOutcome:
    stripped = raw.strip()
    if not stripped:
        return ParseOutcome(err=ParseError(kind="empty", message="No command entered."))

    try:
        tokens = shlex.split(stripped, posix=True)
    except ValueError as exc:
        return ParseOutcome(
            err=ParseError(kind="tokenize", message=f"Could not tokenize: {exc}")
        )

    if not tokens:
        return ParseOutcome(err=ParseError(kind="empty", message="No command entered."))

    name = tokens[0].lower()

    # Two-token verbs take precedence (e.g. "alerts list"). Fall back to
    # single-token when subcommand isn't recognised.
    if len(tokens) >= 2:
        sub = tokens[1].lower()
        spec = find_verb(name, sub, perspective)
        if spec is not None:
            return _parse_args(spec, tokens[2:], raw, perspective)

    spec = find_verb(name, None, perspective)
    if spec is None:
        return ParseOutcome(
            err=ParseError(
                kind="unknown_verb",
                message=f"Unknown command '{name}'.",
                suggestion=_closest_verb(name, perspective),
            )
        )
    if len(tokens) >= 2 and tokens[1].startswith("--") is False:
        # User typed a subcommand but none match this verb.
        return ParseOutcome(
            err=ParseError(
                kind="unknown_subcommand",
                message=(
                    f"'{tokens[1]}' is not a subcommand of '{name}'. Try `help {name}`."
                ),
            )
        )
    return _parse_args(spec, tokens[1:], raw, perspective)


def _parse_args(
    spec: VerbSpec,
    args: list[str],
    raw: str,
    perspective: Perspective,
) -> ParseOutcome:
    positional: dict[str, Any] = {}
    flags: dict[str, Any] = {}

    positional_queue: list[PositionalSpec] = list(spec.positional)
    i = 0
    while i < len(args):
        token = args[i]
        if token.startswith("--"):
            flag_token = token[2:]
            if "=" in flag_token:
                fname, _, fvalue = flag_token.partition("=")
                flag_spec = _find_flag(spec, fname)
                if flag_spec is None:
                    return ParseOutcome(
                        err=ParseError(
                            kind="unknown_flag",
                            message=f"Unknown flag '--{fname}' for `{spec.key}`.",
                        )
                    )
                parsed = _coerce_flag_value(flag_spec, fvalue)
                if isinstance(parsed, ParseError):
                    return ParseOutcome(err=parsed)
                flags[flag_spec.name] = parsed
                i += 1
                continue

            fname = flag_token
            flag_spec = _find_flag(spec, fname)
            if flag_spec is None:
                return ParseOutcome(
                    err=ParseError(
                        kind="unknown_flag",
                        message=f"Unknown flag '--{fname}' for `{spec.key}`.",
                    )
                )
            # Peek next token as the value.
            if i + 1 >= len(args) or args[i + 1].startswith("--"):
                return ParseOutcome(
                    err=ParseError(
                        kind="invalid_flag_value",
                        message=f"Flag '--{fname}' requires a value.",
                    )
                )
            parsed = _coerce_flag_value(flag_spec, args[i + 1])
            if isinstance(parsed, ParseError):
                return ParseOutcome(err=parsed)
            flags[flag_spec.name] = parsed
            i += 2
            continue

        # Positional argument
        if not positional_queue:
            return ParseOutcome(
                err=ParseError(
                    kind="unknown_flag",
                    message=(
                        f"Unexpected extra argument '{token}' for `{spec.key}`. "
                        f"Usage: {spec.usage}"
                    ),
                )
            )
        pspec = positional_queue.pop(0)
        positional[pspec.name] = token
        i += 1

    # Validate required positionals + flags
    missing_pos = [p.name for p in positional_queue if p.required]
    if missing_pos:
        return ParseOutcome(
            err=ParseError(
                kind="missing_positional",
                message=(f"Missing argument: <{missing_pos[0]}>. Usage: {spec.usage}"),
            )
        )
    missing_flags = [f.name for f in spec.flags if f.required and f.name not in flags]
    if missing_flags:
        return ParseOutcome(
            err=ParseError(
                kind="missing_flag",
                message=(
                    f"Missing required flag: --{missing_flags[0]}. Usage: {spec.usage}"
                ),
            )
        )
    # Fill defaults
    for f in spec.flags:
        if f.name not in flags and f.default is not None:
            flags[f.name] = f.default

    return ParseOutcome(
        ok=ParsedCommand(verb=spec, positional=positional, flags=flags, raw=raw)
    )


def _find_flag(spec: VerbSpec, name: str) -> FlagSpec | None:
    for f in spec.flags:
        if f.name == name:
            return f
    return None


def _coerce_flag_value(flag: FlagSpec, value: str) -> Any | ParseError:
    if flag.type == "str":
        return value
    if flag.type == "int":
        try:
            return int(value)
        except ValueError:
            return ParseError(
                kind="invalid_flag_value",
                message=f"--{flag.name} expects an integer; got '{value}'.",
            )
    if flag.type == "csv":
        return [part.strip() for part in value.split(",") if part.strip()]
    if flag.type == "choice":
        if flag.choices and value not in flag.choices:
            return ParseError(
                kind="invalid_flag_value",
                message=(
                    f"--{flag.name} must be one of "
                    f"{', '.join(flag.choices)}; got '{value}'."
                ),
            )
        return value
    return value


def _closest_verb(typed: str, perspective: Perspective) -> str | None:
    """Best-effort suggestion when a verb doesn't parse — we look for
    a verb whose name or ``name sub`` prefix matches the first few
    characters. Cheap and deterministic; no edit-distance library."""
    typed_lower = typed.lower()
    candidates = []
    for v in verbs_for(perspective):
        if v.name.startswith(typed_lower) or typed_lower.startswith(v.name):
            candidates.append(v.key)
    return candidates[0] if candidates else None
