# AegisRange — Claude Code Remediation Playbook

This document is written **for Claude Code**. It describes a set of scoped, independently-shippable cleanups that close the gap between the current v0.8 codebase and a "straight A" state. Each section is self-contained: you can run any one of them without the others.

The project is already healthy. None of what follows is a bug or a security hole — these are the kind of fit-and-finish items that accumulate on a real system between minor versions. Treat this as a v0.9 cleanup pass.

---

## Ground rules

Before doing any of the work below, internalize these:

1. **Never widen the public API surface to fix an encapsulation problem.** If a caller reaches for a private attribute (`_foo`), the fix is to add a proper accessor on the owner and update the caller — not to rename `_foo` to `foo`.
2. **Security changes require tests first.** For anything touching auth, CSRF, or rate limiting, add a failing test that captures the current (insecure or ambiguous) behavior, then make it pass with the fix. The test is the contract.
3. **Preserve backward compatibility on persisted state.** This project already has a `state_dicts`/`state_sets` SQLite layer with live data. Migrations must be additive (new column/table) or handled in `PersistenceLayer.load()` with a fallback path. Never silently break an existing `aegisrange.db`.
4. **Respect the CHANGELOG.** Every change described here produces a CHANGELOG entry under a new `## [0.9.0]` section. Group by Added / Changed / Fixed / Removed, matching the existing style.
5. **Don't batch unrelated changes into one commit.** The existing CHANGELOG shows discipline about this — 0.7.0 and 0.8.0 are each one coherent theme. Keep that pattern.
6. **Read before you write.** For any section that touches a file, open the file first and read it in full. The codebase has conventions (`from __future__ import annotations`, `utc_now()` from `app.models`, `logger = logging.getLogger("aegisrange...")`, frozen dataclasses for immutable entities) — follow them.

---

## Section 1 — Tighten CSRF exempt path prefixes

### The problem

`backend/app/main.py` currently exempts two path prefixes from CSRF validation:

```python
_CSRF_EXEMPT_PREFIXES = ("/scenarios/", "/missions/")
```

`/missions/*` is legitimately exempt because it is a **capability-based** surface: the `run_id` UUID in the URL *is* the authentication. `backend/app/routers/missions.py` documents this explicitly ("Holding the `run_id` (a UUID) is the capability"). No cookie is trusted there, so CSRF has nothing to protect.

`/scenarios/*` is different. Scenarios require `red_team` role via `require_role("red_team")` and are therefore reached through the cookie-authenticated surface in the browser. Exempting the entire prefix from CSRF means any future POST/PATCH/DELETE under `/scenarios/...` is silently unprotected against cross-origin cookie-driven calls. That is not what the original author intended — the exemption was almost certainly added to unblock a specific scenario-run endpoint that is called from an `fetch()` without CSRF token.

### The fix

1. **Read `backend/app/routers/scenarios.py` end-to-end.** List every state-changing route (POST/PATCH/DELETE). For each, decide: (a) cookie-authed from browser → needs CSRF, or (b) bearer-token-only (CLI/test only) → safe to exempt.
2. **Replace the broad prefix match with an explicit route list.** Mirror the style already used for `_CSRF_EXEMPT_PATHS`:
   ```python
   _CSRF_EXEMPT_PATHS = {
       "/auth/login",
       "/auth/logout",
       "/health",
       "/missions",
       # Add each genuinely-exempt scenario route here with a comment
       # explaining why it is exempt (e.g. "capability-gated by run_id").
   }
   _CSRF_EXEMPT_PREFIXES = ("/missions/",)  # capability-based, see routers/missions.py
   ```
3. **If a specific scenario route genuinely cannot accept CSRF tokens** (e.g. it's hit by a non-browser client), the correct fix is not exemption — it's requiring Bearer auth for that route. Document that in the route's docstring.
4. **Add `backend/tests/test_security_hardening.py` cases** that:
   - Assert a cookie-authed POST to each formerly-exempt scenario route returns 403 without a CSRF token.
   - Assert `/missions/*` remains exempt (capability model).
   - Assert Bearer-authed requests bypass CSRF regardless of path (existing behavior, just pin it).
5. **Document the CSRF model** in `docs/threat-model/`. One short file, `CSRF_MODEL.md`, describing: cookie surface vs capability surface vs bearer surface, and the rule for adding a new exempt route (requires threat-model review).

### Acceptance criteria

- `_CSRF_EXEMPT_PREFIXES` contains only paths that are provably capability-gated or not cookie-authenticated.
- Every exempt path or prefix has an inline comment naming *why* it is exempt.
- New tests fail on the old code and pass on the new.
- `docs/threat-model/CSRF_MODEL.md` exists and is linked from `ARCHITECTURE.md`.

---

## Section 2 — Split the service monoliths

### The problem

Several services have grown past the point where a single file is the right unit:

| File | Approx size | Smell |
|---|---|---|
| `services/auth_service.py` | 792 lines | Mixes password hashing, JWT, lockout, MFA gate, scope/role tables |
| `services/mission_service.py` | ~25 KB | Mission lifecycle + command handling + state transitions |
| `services/command_dispatcher.py` | ~25 KB | Dispatch + per-verb handlers |
| `services/detection_rules.py` | ~21 KB | Registry + 10+ rule definitions in one file |
| `services/adversary_scripts.py` | ~25 KB | All 7+ scenarios in one file |

These are not bugs. They're the natural result of iterating. Splitting them now pays off when the 11th detection rule or the 8th scenario lands.

### General splitting rules

- **Split by axis of change, not by line count.** If two chunks always change together, keep them together.
- **Preserve public imports.** External callers should still be able to write `from app.services.auth_service import require_role`. Achieve this by keeping the old module as a thin re-export shim after the split.
- **One concept per new module.** Don't split `auth_service.py` into `auth_service_part1.py` and `auth_service_part2.py`. Split into `auth/passwords.py`, `auth/jwt.py`, `auth/lockout.py`, etc.
- **Tests must not need import changes.** If `tests/test_auth_hardening.py` imports `_auth_service` from the old path, the old path must continue to work.

### Specific proposed splits

**`services/auth_service.py` → `services/auth/`**
```
services/auth/
    __init__.py         # re-exports: require_role, require_scope, _auth_service, AuthService, IdentityType, AuthChannel
    passwords.py        # _hash_password, _verify_password, PBKDF2 constants, DEFAULT_PASSWORDS, _build_default_users
    jwt.py              # TokenPayload, AuthService.create_token, verify_token, key rotation (kid/JWT_SECRET_PREVIOUS)
    lockout.py          # failed-attempt tracking, lockout window/duration logic
    roles.py            # ROLES, ROLE_SCOPES, ENDPOINT_ROLES, require_role, require_scope, require_identity_type
    correlation.py      # validate_correlation_id
    service.py          # AuthService class composing the above
```
Keep `services/auth_service.py` as:
```python
from app.services.auth.service import AuthService, _auth_service  # noqa: F401
from app.services.auth.roles import require_role, require_scope, require_identity_type  # noqa: F401
from app.services.auth.correlation import validate_correlation_id  # noqa: F401
# ... etc
```

**`services/detection_rules.py` → `services/detection/`**
```
services/detection/
    __init__.py         # re-exports RULE_REGISTRY, DetectionRule, RuleContext
    base.py             # DetectionRule, RuleContext, _build_alert
    registry.py         # RULE_REGISTRY and register()
    rules/
        auth.py         # DET-AUTH-*
        corr.py         # DET-CORR-*
        ...one file per rule family
```

**`services/adversary_scripts.py` → `services/adversary/`**
```
services/adversary/
    __init__.py         # re-exports SCRIPT_REGISTRY
    base.py             # Script dataclass, shared helpers
    scripts/
        brute_force.py
        correlated_attack.py
        ... one file per scenario
```

**`services/mission_service.py` and `services/command_dispatcher.py`**
These are more tangled. Do them last. The goal is:
```
services/mission/
    service.py          # MissionService (orchestration only)
    store.py            # MissionStore (persistence)
    lifecycle.py        # state transitions: active → running → paused → complete
    commands/
        dispatcher.py
        handlers/
            observe.py
            contain.py
            ... one file per verb family
```

### Acceptance criteria

- No public import path breaks. `grep -r "from app.services.auth_service import" backend/` returns identical results before and after.
- Each new file is under ~300 lines.
- Test suite passes without modification.
- No new circular imports. Run `python -c "import app.main"` cleanly.
- The old flat files are either deleted (if re-export shims are not needed) or reduced to pure re-exports with a top-level docstring explaining the move.

---

## Section 3 — Fix encapsulation leaks

### The problem

Two specific cases where the rest of the codebase reaches past a module's public API:

**3a. `STORE._persistence` accessed from `main.py`**
`backend/app/main.py` lifespan function reads `STORE._persistence` directly:
```python
if STORE._persistence is not None:
    mission_store.enable_persistence(STORE._persistence)
```
The leading underscore is a Python convention for "internal." External reads of `_persistence` are a coupling that breaks if `InMemoryStore` ever changes how it holds its persistence layer.

**3b. `_auth_service` treated as the canonical instance**
`backend/app/dependencies.py` re-exports `_auth_service` from `auth_service.py`. The leading underscore says "internal"; the re-export says "this is the thing everyone should use." One of those signals is wrong.

### The fix for 3a

Add a public accessor on `InMemoryStore`:
```python
def get_persistence(self) -> PersistenceLayer | None:
    """Return the attached persistence layer, or None if persistence is disabled."""
    return self._persistence
```
Update `main.py`:
```python
persistence = STORE.get_persistence()
if persistence is not None:
    mission_store.enable_persistence(persistence)
```
Do **not** rename `_persistence` to `persistence`. The attribute is still internal; only the read path is public.

### The fix for 3b

Rename `_auth_service` to `auth_service` as the canonical singleton, and update every import. This is a one-time renaming with a clear grep target:

```bash
grep -rn "_auth_service" backend/
```
Every hit should either (a) become `auth_service`, or (b) be genuinely internal to the auth module and stay prefixed.

Update `dependencies.py`:
```python
from app.services.auth_service import auth_service  # was _auth_service
```

Leave a backward-compatible alias in `auth_service.py` for one version:
```python
auth_service = AuthService(...)
_auth_service = auth_service  # deprecated alias; remove in 0.10.0
```
Mark the alias with a `# DEPRECATED:` comment and list it in the CHANGELOG under **Deprecated**.

### Acceptance criteria

- `grep -rn "STORE\._" backend/app/` returns zero hits outside of `store.py` itself and its tests.
- `grep -rn "_auth_service" backend/app/` returns only the deprecation alias line.
- Existing tests pass without modification.

---

## Section 4 — Break up the large frontend files

### The problem

**`frontend/lib/mock-data.ts` is 4,323 lines / 135 KB.** This ships in every client bundle that imports `lib/api.ts` unless the bundler tree-shakes aggressively. The file is a single export surface for mock fixtures covering metrics, events, alerts, incidents, analytics, MITRE, killchain, campaigns, and reports — every page in the app pulls from it.

**`frontend/lib/api.ts` is 1,063 lines.** Every endpoint function has to know about its mock counterpart. Adding a new endpoint means editing both files.

### The fix — mock-data

Split by feature, matching the A.1 / A.2 / A.3 / B / C slices already documented in the file header:

```
frontend/lib/mocks/
    index.ts              # barrel, re-exports everything for back-compat
    health.ts             # HealthStatus
    metrics.ts            # Metrics
    events.ts             # Event[]
    alerts.ts             # Alert[]
    incidents.ts          # Incident[], IncidentResponse, notes
    analytics.ts          # RiskProfile[], RuleEffectiveness[], ScenarioHistoryEntry[]
    mitre.ts              # MitreTactic[], MitreTechnique[], MitreCoverageEntry[], TTPMapping[], TacticCoverage[]
    killchain.ts          # KillChainAnalysis, KillChainStage[]
    campaigns.ts          # Campaign[]
    reports.ts            # ExerciseReport[]
    users.ts              # PlatformUser mocks
    _shared/
        timestamps.ts     # shared clock anchors (the 72-hour window)
        actors.ts         # shared actor IDs used across multiple mock sets
```

Preserve `frontend/lib/mock-data.ts` as a barrel:
```typescript
export * from './mocks';
```

### The fix — api.ts

Split into a core HTTP client + one module per resource, using a shared `tryLiveOrFallback` helper:

```
frontend/lib/api/
    index.ts              # barrel: re-exports all endpoint functions
    client.ts             # ApiError, fetchJson, backend probe, resetBackendProbe
    fallback.ts           # tryLiveOrFallback<T>(path, mockValue, opts) helper
    auth.ts               # platformLogin, platformLogout, getCurrentUser
    events.ts             # listEvents, exportEvents
    alerts.ts             # listAlerts
    incidents.ts          # listIncidents, getIncident, updateIncidentStatus, addIncidentNote
    scenarios.ts          # runScenario, listScenarios
    missions.ts           # startMission, getMissionSnapshot, submitCommand, ...
    analytics.ts          # riskProfiles, ruleEffectiveness, scenarioHistory
    mitre.ts              # mitre endpoints
    killchain.ts
    campaigns.ts
    reports.ts
    metrics.ts
    health.ts
```

The `tryLiveOrFallback` helper replaces the duplicated try/catch/return-mock pattern in every endpoint:

```typescript
// frontend/lib/api/fallback.ts
export async function tryLiveOrFallback<T>(
  path: string,
  mock: T,
  opts: { method?: string; body?: unknown; validate?: (x: unknown) => x is T } = {}
): Promise<T> {
  if (!(await isBackendReachable())) return mock;
  try {
    const res = await fetchJson<T>(path, opts);
    if (opts.validate && !opts.validate(res)) return mock;
    return res;
  } catch {
    return mock;
  }
}
```

Preserve `frontend/lib/api.ts` as a barrel:
```typescript
export * from './api/index';
```

### Acceptance criteria

- Every existing import of `lib/api` or `lib/mock-data` continues to work (barrel files).
- No single new file exceeds 400 lines.
- Adding a new endpoint requires editing one endpoint file and one mock file, not two 4000-line files.
- Bundle analyzer output (`npx @next/bundle-analyzer` or equivalent) shows per-page chunks no longer pulling all mocks when they only need one slice.
- `npm test` passes without modification.

---

## Section 5 — Eliminate frontend/backend role-hierarchy drift

### The problem

`frontend/lib/auth-context.tsx` hardcodes the role ladder:
```typescript
const ROLE_LEVELS: Record<string, number> = {
  admin: 100,
  soc_manager: 75,
  analyst: 50,
  red_team: 50,
  viewer: 25,
};
const SCENARIO_MIN_LEVEL = 50;
```
The comment says "mirrors backend ROLES dict." That's an honest acknowledgment of the problem: two sources of truth that will silently drift the moment someone adds a role on one side.

### The fix

The backend already returns the current user via `GET /auth/me` (or equivalent — confirm in `routers/auth.py`). Extend that response to include the role's capabilities, not just its name:

```python
# backend/app/schemas.py
class CurrentUserResponse(BaseModel):
    username: str
    role: str
    level: int                 # NEW: numeric level from ROLES[role]["level"]
    scopes: list[str]          # NEW: from ROLE_SCOPES[role]
    capabilities: list[str]    # NEW: derived boolean flags, e.g. ["run_scenarios", "manage_incidents"]
```

Populate `capabilities` from a small capability map on the backend:
```python
# backend/app/services/auth/capabilities.py
CAPABILITY_MIN_LEVEL = {
    "run_scenarios": 50,        # red_team, analyst, soc_manager, admin
    "manage_incidents": 50,
    "view_analytics": 50,
    "administer_platform": 100,
}

def capabilities_for(role: str) -> list[str]:
    level = ROLES[role]["level"]
    return [cap for cap, min_lvl in CAPABILITY_MIN_LEVEL.items() if level >= min_lvl]
```

On the frontend, remove `ROLE_LEVELS` and `SCENARIO_MIN_LEVEL` from `auth-context.tsx`. Replace `canRunScenarios(role)` with `canRunScenarios(user)` reading `user.capabilities.includes("run_scenarios")`.

### Acceptance criteria

- `ROLE_LEVELS` and `SCENARIO_MIN_LEVEL` no longer exist in any frontend file.
- Adding a new role on the backend (with a level and a capability entry) automatically flows to the frontend on next login, with no frontend changes required.
- Backend test `test_auth_identity.py` asserts `/auth/me` returns `level`, `scopes`, and `capabilities`.
- Frontend test asserts `canRunScenarios` reads from capabilities, not level.

---

## Section 6 — Plan for horizontal scalability (design-only in 0.9.0)

### The problem

The current persistence model is SQLite + in-memory singleton `STORE`. One process, one database file. The middleware in `main.py` calls `STORE.save()` after every successful mutation, and `STORE.prune_expired_revocations()` every 100 requests. This is correct and sufficient for a single-worker deployment, but it sets a ceiling. Two Railway workers pointed at the same SQLite file would race on writes; two workers pointed at separate files would fork state.

### The fix — for 0.9.0, write a design doc only

Do **not** attempt to implement multi-worker persistence in 0.9.0. The scope is too large and it cuts across every service. What 0.9.0 should produce is a design document that answers three questions:

1. **Where does authoritative state live?** SQLite (with WAL + a single writer) vs Postgres vs Redis-for-cache + Postgres-for-truth.
2. **How does the in-memory store stay consistent across workers?** Options: drop the in-memory store entirely (every read hits the DB); pub/sub invalidation (Postgres LISTEN/NOTIFY or Redis); event-sourced rebuild on each worker.
3. **What is the migration path from the current single-process design?** A phased plan: (a) move JTI revocations and TOTP state out of `InMemoryStore` into a DB-backed cache accessible from any worker; (b) move event/alert/incident reads to the DB; (c) deprecate the in-memory indices.

Deliverable: `docs/operations/SCALING.md`, 3–5 pages, with a chosen direction and a numbered phase plan. Link it from `ARCHITECTURE.md` under a new "Scalability" section.

### Acceptance criteria

- `docs/operations/SCALING.md` exists.
- `ARCHITECTURE.md` links to it and names the chosen direction in one sentence.
- No code changes. The 0.9.0 CHANGELOG entry for this item lives under **Documentation**, not **Added** or **Changed**.

---

## Section 7 — Harden the default-password story for production demos

### The problem

`services/auth_service.py` hardcodes `DEFAULT_PASSWORDS` in source. This is intentional and correct for a simulation platform — every demo deployment needs a known admin credential. But the current code has no explicit mechanism to override them for a public demo, and no warning when the defaults are in use.

### The fix

1. **Load default passwords from env first, source second.** Pattern:
   ```python
   def _resolve_default_password(username: str, fallback: str) -> str:
       env_key = f"DEFAULT_PASSWORD_{username.upper()}"
       return os.getenv(env_key, fallback)
   ```
2. **Log a warning at startup when any default password is still in use in production.** Add to `lifespan`:
   ```python
   if settings.APP_ENV == "production":
       defaults_in_use = [u for u in DEFAULT_PASSWORDS if _using_source_default(u)]
       if defaults_in_use:
           logger.warning(
               "Default passwords in use in production",
               extra={"usernames": defaults_in_use},
           )
   ```
3. **Document the override in `DEPLOY.md`** with a concrete Railway example.

### Acceptance criteria

- Setting `DEFAULT_PASSWORD_ADMIN=foo` in env changes the admin password at next startup.
- Production logs contain one `WARNING` per username still using a source default.
- No hardcoded password is removed from source — the fallback behavior in development is unchanged.
- Add a test in `test_auth_hardening.py` for the env override.

---

## Section 8 — Cross-cutting hygiene

Small items that don't deserve their own section but should not be forgotten:

- **Add `py.typed` marker** to `backend/app/` if any external consumer imports from it. Skip if not applicable.
- **Confirm `ruff` config** includes `PLR0915` (too-many-statements) and `PLR0912` (too-many-branches) even if scoped only to `services/`. This is the lint signal that will catch the next monolith before it gets big.
- **Add a `make check` or `npm run check:all` target** that runs Ruff + mypy + pytest + ESLint + tsc + jest in one command. CI probably already does this, but local devs benefit.
- **Pin `next` to a known-patched version.** 14.2.35 is current for this checkout; re-check against the Next.js security advisory feed before release.
- **`frontend/__tests__/` is 48 KB across 10 files.** Add one integration test per major page (alerts, incidents, scenarios, missions) using React Testing Library + the existing mock-data. The coverage delta per test is large because most pages are currently untested end-to-end.

---

## How Claude Code should execute this playbook

1. **Start by reading `CHANGELOG.md`, `ARCHITECTURE.md`, and this file.** Do not start work before you've read all three.
2. **Pick one section at a time.** Do not interleave. Section 1 ships before Section 2 starts.
3. **For each section, run this loop:**
   - Read every file the section touches, in full.
   - Write the tests first.
   - Make the change.
   - Run `pytest backend/tests/` and `cd frontend && npm test`.
   - Run `ruff check backend/` and `cd frontend && npx tsc --noEmit`.
   - Update `CHANGELOG.md` under `## [0.9.0]` with a one-line entry per change, grouped by Added / Changed / Fixed / Removed / Deprecated / Documentation.
   - Commit with a message of the form `section N: <one-line summary>`.
4. **Do not skip a section because "it's small."** Section 3 (encapsulation) is small but it's the kind of thing that compounds if left alone.
5. **If you find a genuine bug while doing this work, stop.** File it separately. Do not fold bug fixes into a cleanup commit — the existing CHANGELOG discipline keeps those distinct.
6. **Section 6 is documentation-only in 0.9.0.** Do not start implementing multi-worker persistence. That is a 0.10.0 decision after the design doc is reviewed.

---

## What "done" looks like for 0.9.0

- CSRF exempt list is explicit and documented; `/scenarios/*` prefix exemption is gone.
- `auth_service.py`, `detection_rules.py`, `adversary_scripts.py`, and at least one of `mission_service.py` / `command_dispatcher.py` are split into directories with re-export shims.
- No `STORE._persistence` or `_auth_service` reads outside their owning modules.
- `frontend/lib/mock-data.ts` and `frontend/lib/api.ts` are barrels; no feature file exceeds 400 lines.
- `ROLE_LEVELS` / `SCENARIO_MIN_LEVEL` constants removed from frontend; capabilities delivered by backend.
- `docs/operations/SCALING.md` and `docs/threat-model/CSRF_MODEL.md` exist and are linked from `ARCHITECTURE.md`.
- Default passwords can be overridden via env; production logs warn when defaults are in use.
- `CHANGELOG.md` has a `## [0.9.0]` section that a reader can audit against this list.

When those boxes are checked, the project is a clean A.
