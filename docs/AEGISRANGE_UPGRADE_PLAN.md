# AEGISRANGE UPGRADE DIRECTIVE — STAFF-LEVEL ENGINEERING ACTION PLAN

You are a staff-level security platform engineer. You are the technical owner of AegisRange — a defensive security simulation and validation platform. This system models SOC telemetry ingestion, deterministic detection, automated response, and auditable incident management.

Your codebase has been audited. The architecture, domain model, and security posture are strong. The gaps identified below are real, specific, and must be closed with the same rigor the existing codebase demonstrates. Every fix must be testable, every pattern must be consistent, and every shortcut must be documented as a deliberate constraint — not hidden.

Read ARCHITECTURE.md, DEPLOY.md, and the full backend/app/ and frontend/ trees before touching anything. Understand the existing patterns — do not introduce conflicting conventions.

---

## EXECUTION RULES

1. **One phase at a time.** Complete every task in a phase before moving to the next. Do not skip ahead.
2. **Every change must have a test.** If you add code without a corresponding test, you have failed.
3. **Run the full test suite after every task.** If anything breaks, fix it before moving on. The command is: `cd backend && python -m pytest tests/ -v --tb=short`
4. **Do not change existing public APIs.** All router endpoints must continue to accept the same inputs and return the same response shapes. Internal refactors only.
5. **Match existing code style exactly.** `from __future__ import annotations` in every Python file. Frozen dataclasses for immutable models. Type hints everywhere. Docstrings on public methods. No bare `dict` return types where a typed structure is appropriate.
6. **No new dependencies without justification.** The backend has zero non-essential dependencies by design. Do not add Redis, Celery, SQLAlchemy, or anything else unless the task explicitly requires it.
7. **Commit messages follow conventional commits.** `fix:`, `feat:`, `refactor:`, `test:`, `docs:`, `perf:`, `ci:`.

---

## PHASE 1: BACKEND ENCAPSULATION AND TYPE SAFETY

**Objective:** Eliminate every direct attribute access on `InMemoryStore` from service code. The store's internal data structures are implementation details — services must go through accessor methods exclusively. Fix all weak type annotations.

### Task 1.1: Fix `risk_profiles` type annotation

File: `backend/app/store.py`

The store declares `self.risk_profiles: dict[str, object] = {}`. The type `object` is useless — it tells the reader nothing and the type checker nothing.

- Import `RiskProfile` from `app.services.risk_service` (use `TYPE_CHECKING` guard to avoid circular imports).
- Change the annotation to `dict[str, RiskProfile]`.
- Update `update_risk_profile` signature from `profile: object` to `profile: RiskProfile`.
- Verify all tests still pass.

### Task 1.2: Add missing store accessor methods

File: `backend/app/store.py`

Services currently reach into `store.incidents_by_correlation` directly in 10+ locations, `store.step_up_required` in 3 locations, `store.download_restricted_actors` in 3 locations, `store.disabled_services`, `store.quarantined_artifacts`, `store.policy_change_restricted_actors`, and `store.revoked_sessions` directly.

Add these accessor methods to `InMemoryStore`:

```python
def get_all_incidents_dict(self) -> dict[str, Incident]:
    """Return a copy of the incidents-by-correlation mapping."""
    return dict(self.incidents_by_correlation)

def is_policy_change_restricted(self, actor_id: str) -> bool:
    """Check if an actor is restricted from policy changes."""
    return actor_id in self.policy_change_restricted_actors

def is_service_disabled(self, service_id: str) -> bool:
    """Check if a service has been disabled."""
    return service_id in self.disabled_services

def is_artifact_quarantined(self, artifact_id: str) -> bool:
    """Check if an artifact has been quarantined."""
    return artifact_id in self.quarantined_artifacts

def get_blocked_routes(self, service_id: str) -> set[str]:
    """Return blocked routes for a service."""
    return set(self.blocked_routes.get(service_id, set()))

def get_all_revoked_sessions(self) -> set[str]:
    """Return all revoked session IDs (snapshot copy)."""
    return set(self.revoked_sessions)

def get_all_download_restricted(self) -> set[str]:
    """Return all download-restricted actor IDs."""
    return set(self.download_restricted_actors)

def get_all_step_up_required(self) -> set[str]:
    """Return all actor IDs requiring step-up auth."""
    return set(self.step_up_required)

def get_all_disabled_services(self) -> set[str]:
    """Return all disabled service IDs."""
    return set(self.disabled_services)

def get_all_quarantined_artifacts(self) -> set[str]:
    """Return all quarantined artifact IDs."""
    return set(self.quarantined_artifacts)

def get_all_policy_change_restricted(self) -> set[str]:
    """Return all policy-change-restricted actor IDs."""
    return set(self.policy_change_restricted_actors)
```

### Task 1.3: Migrate all services to use accessor methods

Files: Every file in `backend/app/services/` that touches store internals directly.

Systematic replacement:

- `detection_service.py` lines 310-320: Replace `event.actor_id in store.step_up_required` with `store.is_step_up_required(event.actor_id)`. Replace `event.actor_id in store.download_restricted_actors` with `store.is_download_restricted(event.actor_id)`.
- `incident_service.py` lines 12, 19: Replace `self.store.incidents_by_correlation.get(...)` with `self.store.get_incident(...)`.
- `risk_service.py` line 66: Replace `for incident in self.store.incidents_by_correlation.values()` with `for incident in self.store.get_all_incidents()`.
- `report_service.py` lines 126, 312: Replace direct dict access with `get_all_incidents()` and `len(self.store.get_all_incidents())`.
- `killchain_service.py` lines 82, 161: Replace `self.store.incidents_by_correlation.get(...)` with `self.store.get_incident(...)` and iteration with `self.store.get_all_incidents()`.
- `campaign_service.py` lines 48, 185: Same pattern.
- `scenario_service.py` lines 365, 385-391: Replace all direct set access with the new accessor methods.
- `document_service.py` line 57: Replace `actor_id in self.store.download_restricted_actors` with `self.store.is_download_restricted(actor_id)`.
- `identity_service.py` line 54: Replace `session_id in self.store.revoked_sessions` with `self.store.is_session_revoked(session_id)`.

After migration, **verify no service file imports or references any raw store attribute** (incidents_by_correlation, step_up_required, download_restricted_actors, disabled_services, blocked_routes, quarantined_artifacts, policy_change_restricted_actors, revoked_sessions, revoked_jtis). Run: `grep -rn "store\.\(incidents_by_correlation\|step_up_required\|download_restricted_actors\|disabled_services\|blocked_routes\|quarantined_artifacts\|policy_change_restricted_actors\|revoked_sessions\|revoked_jtis\)" backend/app/services/` — this must return zero results.

### Task 1.4: Add encapsulation enforcement test

File: `backend/tests/test_architecture.py`

Add a test that uses AST parsing to verify no service module accesses raw store collection attributes. This is a regression guard — the same pattern as the existing `datetime.utcnow` CI check.

```python
def test_services_do_not_access_raw_store_attributes(self) -> None:
    """Services must use store accessor methods, not raw attributes."""
    import ast
    import pathlib

    forbidden_attrs = {
        "incidents_by_correlation",
        "step_up_required",
        "download_restricted_actors",
        "disabled_services",
        "blocked_routes",
        "quarantined_artifacts",
        "policy_change_restricted_actors",
        "revoked_sessions",
        "revoked_jtis",
        "alert_signatures",
        "login_failures_by_actor",
        "document_reads_by_actor",
        "authorization_failures_by_actor",
        "artifact_failures_by_actor",
    }

    violations = []
    services_dir = pathlib.Path(__file__).resolve().parent.parent / "app" / "services"
    for py_file in services_dir.glob("*.py"):
        tree = ast.parse(py_file.read_text())
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Attribute)
                and node.attr in forbidden_attrs
            ):
                violations.append(f"{py_file.name}:{node.lineno} accesses .{node.attr}")

    self.assertEqual(
        violations,
        [],
        f"Services must not access raw store attributes:\n" + "\n".join(violations),
    )
```

Run all tests. Everything must pass.

---

## PHASE 2: BACKEND PERFORMANCE AND SAFETY

**Objective:** Fix the linear-scan performance ceiling in telemetry lookups, add TTL-based pruning for unbounded sets, tighten CORS, add request latency observability, and introduce API pagination.

### Task 2.1: Add indexed lookups to TelemetryService

File: `backend/app/services/event_services.py`

The current `lookup_events()` iterates over `self.store.events` (the entire event list) for every query. Every detection rule calls this on every event ingestion. At 10,000 events, the pipeline processes 10 detection rules × 10,000 events = 100,000 iterations per ingestion.

Add secondary indices to `InMemoryStore`:

```python
# In store.py __init__:
self._events_by_actor: defaultdict[str, list[Event]] = defaultdict(list)
self._events_by_correlation: defaultdict[str, list[Event]] = defaultdict(list)
self._events_by_type: defaultdict[str, list[Event]] = defaultdict(list)
```

Update `append_event()` to maintain all three indices:

```python
def append_event(self, event: Event) -> None:
    self.events.append(event)
    self._events_by_actor[event.actor_id].append(event)
    self._events_by_correlation[event.correlation_id].append(event)
    self._events_by_type[event.event_type].append(event)
    if self._persistence:
        self._persistence.persist_event(event)
```

Add accessor methods:

```python
def get_events_by_actor(self, actor_id: str) -> list[Event]:
    return list(self._events_by_actor.get(actor_id, []))

def get_events_by_correlation(self, correlation_id: str) -> list[Event]:
    return list(self._events_by_correlation.get(correlation_id, []))

def get_events_by_type(self, event_type: str) -> list[Event]:
    return list(self._events_by_type.get(event_type, []))
```

Rewrite `TelemetryService.lookup_events()` to use the narrowest index first, then filter remaining predicates. When `actor_id` + `event_types` are both specified (the hot path for detection rules), start from the actor index and filter by type — this is O(actor_events) instead of O(all_events).

Update `reset()` to clear the indices. Update `persistence.py` `_rebuild_event_indices()` to populate them on load.

Write a benchmark test that ingests 5,000 events, then asserts that a lookup by actor_id + event_type completes in under 50ms.

### Task 2.2: TTL-based pruning for JTI and session revocation sets

File: `backend/app/store.py`

`revoked_jtis` and `revoked_sessions` grow without bound. In a long-running process this is a memory leak. Tokens expire after `TOKEN_EXPIRY_HOURS` (default 24h), so revoked JTIs older than that are dead weight.

Change `revoked_jtis` from `set[str]` to `dict[str, float]` mapping JTI → revocation monotonic timestamp.

Add a prune method:

```python
def prune_expired_revocations(self, max_age_seconds: int = 86400) -> int:
    """Remove revoked JTIs older than max_age_seconds. Returns count pruned."""
    now = time.monotonic()
    expired = [jti for jti, ts in self.revoked_jtis.items() if now - ts > max_age_seconds]
    for jti in expired:
        del self.revoked_jtis[jti]
    return len(expired)
```

Update `revoke_jti()` to store the timestamp. Update `is_jti_revoked()` to check the dict. Update persistence serialization/deserialization.

Call `prune_expired_revocations()` in the correlation middleware on every 100th request (use a simple counter, not every request).

Write tests for: pruning removes old entries, pruning preserves recent entries, is_jti_revoked works with the new dict structure.

### Task 2.3: Tighten CORS configuration

File: `backend/app/main.py`

Current config allows `allow_methods=["*"]` and `allow_headers=["*"]`. This is unnecessarily permissive.

Replace with explicit lists:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
)
```

Verify all tests still pass. Verify the frontend proxy still works (it uses `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`, `PUT` — add `PUT` and `HEAD` to the methods list if any router uses them; check first).

### Task 2.4: Add request latency logging middleware

File: `backend/app/main.py`

There is no observability into request latency. Add a middleware that logs method, path, status code, and duration for every request:

```python
@app.middleware("http")
async def latency_middleware(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "Request completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "correlation_id": getattr(request.state, "correlation_id", None),
        },
    )
    return response
```

Place this middleware BEFORE the correlation middleware (FastAPI middleware executes in reverse registration order — the last registered middleware runs first, so register this one after the correlation middleware).

### Task 2.5: Add API pagination to events and alerts endpoints

Files: `backend/app/routers/events.py`, `backend/app/routers/alerts.py`

These endpoints return the full dataset with no pagination. At scale this is both a performance problem and a memory bomb.

Add `limit` and `offset` query parameters with sensible defaults:

```python
limit: int = Query(default=100, ge=1, le=1000),
offset: int = Query(default=0, ge=0),
```

Return a paginated envelope:

```python
return {
    "items": serialized_items[offset:offset + limit],
    "total": len(all_items),
    "limit": limit,
    "offset": offset,
}
```

**Critical:** The frontend `api.ts` must continue to work. Check how it consumes these endpoints. If it expects a bare list, add backward compatibility: if `limit` and `offset` are both absent (not provided), return the bare list. If either is provided, return the paginated envelope. Document this in a comment.

Write tests for: default pagination, custom limit/offset, out-of-range offset returns empty items, backward compatibility with bare list.

### Task 2.6: Enrich health endpoint

File: `backend/app/routers/health.py`

The health endpoint returns only `{"status": "ok", "timestamp": "..."}`. For production readiness, it should report subsystem health.

```python
@router.get("/health")
def health() -> dict:
    store_ok = True
    persistence_ok = STORE._persistence is not None or settings.APP_ENV == "test"

    return {
        "status": "ok" if (store_ok and persistence_ok) else "degraded",
        "timestamp": utc_now().isoformat(),
        "version": "0.7.0",
        "checks": {
            "store": "ok" if store_ok else "error",
            "persistence": "ok" if persistence_ok else "not_configured",
        },
        "stats": {
            "events": len(STORE.get_events()),
            "alerts": len(STORE.get_alerts()),
            "incidents": len(STORE.get_all_incidents()),
        },
    }
```

Write a test that verifies the health endpoint returns the new shape and that `checks` and `stats` are present.

---

## PHASE 3: BACKEND API CONTRACTS AND RESPONSE MODELS

**Objective:** Replace all `-> dict` and `-> list[dict]` return types on routers with Pydantic response models. This gives you automatic OpenAPI schema generation, response validation, and contract enforcement.

### Task 3.1: Create response models

File: `backend/app/response_models.py` (new file)

Create Pydantic models for every API response shape. Derive these from the existing serializer output shapes — do NOT invent new shapes. The models must match the current response format exactly.

```python
from __future__ import annotations
from pydantic import BaseModel
from typing import Any

class EventResponse(BaseModel):
    event_id: str
    event_type: str
    category: str
    timestamp: str
    actor_id: str
    actor_type: str
    actor_role: str | None
    target_type: str | None
    target_id: str | None
    request_id: str
    correlation_id: str
    session_id: str | None
    source_ip: str
    user_agent: str | None
    origin: str
    status: str
    status_code: str | None
    error_message: str | None
    severity: str
    confidence: str
    risk_score: int | None
    payload: dict[str, Any]

class AlertResponse(BaseModel):
    alert_id: str
    rule_id: str
    rule_name: str
    severity: str
    confidence: str
    actor_id: str
    correlation_id: str
    contributing_event_ids: list[str]
    summary: str
    payload: dict[str, Any]
    created_at: str

# ... continue for IncidentResponse, MetricsResponse, HealthResponse,
# RiskProfileResponse, ScenarioResultResponse, ExerciseReportResponse, etc.
```

Build models for EVERY router return type. Cross-reference with `frontend/lib/types.ts` to ensure backend response models match the frontend type expectations exactly.

### Task 3.2: Apply response models to all routers

Annotate every router function with `response_model=ResponseModelName`. Example:

```python
@router.get("/events", response_model=list[EventResponse], dependencies=[Depends(require_role("viewer"))])
def list_events(...) -> list[dict]:
```

Do NOT change the function return statement — FastAPI will validate and serialize the dict through the response model. If any field is missing or mistyped, the test suite will catch it.

Run all tests. Fix any serialization mismatches.

### Task 3.3: Add Pydantic field validation to request schemas

File: `backend/app/schemas.py`

The current schemas have no field validation — no min/max lengths, no regex patterns, no constrained values. Add them:

```python
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)

class ReadRequest(BaseModel):
    actor_id: str = Field(..., min_length=1, max_length=128)
    actor_role: str = Field(..., min_length=1, max_length=64)
    session_id: str | None = Field(default=None, max_length=128)
    simulated_source_ip: str = Field(default="127.0.0.1", max_length=45)

class IncidentNote(BaseModel):
    author: str = Field(..., min_length=1, max_length=128)
    content: str = Field(..., min_length=1, max_length=10000)
```

Write tests that verify invalid inputs (empty strings, oversized values) are rejected with 422.

---

## PHASE 4: FRONTEND COMPONENT DECOMPOSITION

**Objective:** Break the seven monolithic page components (925, 917, 865, 677, 459, 431, 405 lines) into composable, testable units. No page component should exceed 200 lines.

### Task 4.1: Decompose scenario detail page

File: `frontend/app/scenarios/[scenarioId]/page.tsx` (925 lines)

Extract into:
- `frontend/components/scenarios/ScenarioHeader.tsx` — title, description, badge, MITRE tags
- `frontend/components/scenarios/ScenarioExecutor.tsx` — run button, loading state, result handling
- `frontend/components/scenarios/ScenarioTimeline.tsx` — timeline event list
- `frontend/components/scenarios/ScenarioResults.tsx` — detection/response/incident outcome cards
- `frontend/components/scenarios/AchievementToast.tsx` — XP and achievement notifications

The page component becomes a thin orchestrator that composes these pieces. Keep all state in the page and pass callbacks/data as props.

### Task 4.2: Decompose incident detail page

File: `frontend/app/incidents/[correlationId]/page.tsx` (917 lines)

Extract into:
- `frontend/components/incidents/IncidentHeader.tsx` — status badge, severity, actor info
- `frontend/components/incidents/IncidentTimeline.tsx` — timeline entry list
- `frontend/components/incidents/IncidentDetections.tsx` — detection summary cards
- `frontend/components/incidents/IncidentResponses.tsx` — response action cards
- `frontend/components/incidents/IncidentNotes.tsx` — notes list with add form
- `frontend/components/incidents/IncidentStatusControl.tsx` — status transition controls
- `frontend/components/incidents/AffectedResources.tsx` — documents, sessions, services

### Task 4.3: Decompose profile page

File: `frontend/app/profile/page.tsx` (865 lines)

Extract into:
- `frontend/components/profile/RankCard.tsx`
- `frontend/components/profile/XPProgressBar.tsx`
- `frontend/components/profile/AchievementGrid.tsx`
- `frontend/components/profile/ScenarioHistory.tsx`
- `frontend/components/profile/SkillRadar.tsx`

### Task 4.4: Decompose alert detail page

File: `frontend/app/alerts/[id]/page.tsx` (677 lines)

Extract into:
- `frontend/components/alerts/AlertHeader.tsx`
- `frontend/components/alerts/AlertPayload.tsx`
- `frontend/components/alerts/ContributingEvents.tsx`
- `frontend/components/alerts/AlertCorrelation.tsx`

### Task 4.5: Decompose dashboard page

File: `frontend/app/page.tsx` (459 lines)

Extract into:
- `frontend/components/dashboard/MetricsGrid.tsx`
- `frontend/components/dashboard/ScenarioLauncher.tsx`
- `frontend/components/dashboard/RiskOverview.tsx`
- `frontend/components/dashboard/SystemHealth.tsx`

### Task 4.6: Decompose alert list and incident list pages

Files: `frontend/app/alerts/page.tsx` (405 lines), `frontend/app/incidents/page.tsx` (431 lines)

Extract shared table/list, filter bar, and status badge components.

After all decomposition: verify `npm run build` succeeds, `npx tsc --noEmit` passes, and `npm run lint` passes.

---

## PHASE 5: FRONTEND DATA FETCHING AND ERROR HANDLING

**Objective:** Replace manual useEffect/useState data fetching with a consistent pattern, add error boundaries, and add loading skeletons.

### Task 5.1: Create a `useApi` hook

File: `frontend/lib/useApi.ts` (new file)

Build a lightweight data fetching hook that encapsulates the loading/error/data pattern currently duplicated across 26 useEffect calls:

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
```

### Task 5.2: Migrate all pages to use `useApi`

Replace every `useState` + `useEffect` data-fetching pattern with `useApi`. This should eliminate ~20 useState declarations and ~26 useEffect blocks across the frontend.

### Task 5.3: Add error boundary

File: `frontend/app/error.tsx` (new file — Next.js App Router convention)

```typescript
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Something went wrong</h2>
      <p className="text-slate-600 dark:text-slate-400">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Try again
      </button>
    </div>
  );
}
```

Also add `frontend/app/not-found.tsx` for 404 handling.

### Task 5.4: Add loading skeletons

File: `frontend/components/Skeleton.tsx` (new file)

Create a reusable skeleton component:

```typescript
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className ?? ''}`} />
  );
}

export function CardSkeleton() { /* ... */ }
export function TableRowSkeleton() { /* ... */ }
```

Replace all `"Loading..."` text with skeleton components across every page.

Verify build, types, and lint all pass.

---

## PHASE 6: FRONTEND TESTING

**Objective:** The frontend currently has zero tests. Add unit tests for critical components and integration tests for data flow.

### Task 6.1: Set up testing infrastructure

Install and configure:

```bash
cd frontend
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest ts-jest jest-environment-jsdom @testing-library/user-event
```

Create `frontend/jest.config.ts`:

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
};

export default createJestConfig(config);
```

Create `frontend/jest.setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

Add to `package.json` scripts: `"test": "jest"`, `"test:watch": "jest --watch"`.

### Task 6.2: Write component tests

Minimum test coverage — write at minimum one test file for each:

- `frontend/__tests__/components/Sidebar.test.tsx` — renders nav items, highlights active route
- `frontend/__tests__/components/CommandPalette.test.tsx` — opens on keyboard shortcut, filters items
- `frontend/__tests__/components/PlayerCard.test.tsx` — renders rank, XP, level
- `frontend/__tests__/lib/api.test.ts` — mock fetch, verify fallback to mock data when backend unreachable, verify live-first pattern
- `frontend/__tests__/lib/auth-context.test.tsx` — provides demo identity, useAuth returns expected shape
- `frontend/__tests__/lib/player-progress.test.tsx` — XP calculation, rank progression, achievement unlock
- `frontend/__tests__/lib/daily-challenge.test.ts` — deterministic challenge selection, completion tracking

### Task 6.3: Add frontend tests to CI

File: `.github/workflows/ci.yml`

Add a `frontend-test` job after `frontend-lint`:

```yaml
frontend-test:
  runs-on: ubuntu-latest
  needs: frontend-lint
  defaults:
    run:
      working-directory: frontend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: npm
        cache-dependency-path: frontend/package-lock.json
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test -- --ci --coverage
```

Update the `docker-build` job's `needs` to include `frontend-test`.

---

## PHASE 7: BACKEND TEST INFRASTRUCTURE AND COVERAGE

**Objective:** Reorganize phase-numbered tests, add conftest.py with shared fixtures, enforce coverage thresholds, and add missing edge case coverage.

### Task 7.1: Create conftest.py with shared fixtures

File: `backend/tests/conftest.py` (new file)

Extract the duplicated test setup patterns (store creation, telemetry/detection service instantiation, event factory functions) into pytest fixtures:

```python
import pytest
from app.store import InMemoryStore
from app.services.event_services import TelemetryService
from app.services.detection_service import DetectionService
from app.services.pipeline_service import EventPipelineService
# ... etc

@pytest.fixture
def store():
    return InMemoryStore()

@pytest.fixture
def telemetry(store):
    return TelemetryService(store)

@pytest.fixture
def detection(telemetry):
    return DetectionService(telemetry)

@pytest.fixture
def make_event():
    """Factory fixture for creating test events."""
    def _make(*, event_type="authentication.login.failure", actor_id="user-alice", **kwargs):
        # ... full factory with sensible defaults
        pass
    return _make
```

### Task 7.2: Consolidate phase-numbered test files

The following test files are named after development phases, not domains:
- `test_phase1_phase2_rework.py`
- `test_phase2_api.py`
- `test_phase2_detection.py`
- `test_phase2_responses.py`
- `test_phase2_scenarios.py`
- `test_phase5_api.py`
- `test_phase6_auth.py`
- `test_phase6_campaigns.py`
- `test_phase6_killchain.py`
- `test_phase6_mitre.py`
- `test_phase6_reports.py`

Merge their tests into the correct domain test files:
- `test_phase2_detection.py` → merge into `test_detection_rules.py`
- `test_phase2_responses.py` → merge into `test_response_playbooks.py`
- `test_phase2_scenarios.py` → merge into `test_scenarios.py`
- `test_phase6_auth.py` → merge into `test_auth_enforcement.py`
- `test_phase6_campaigns.py` → rename to `test_campaigns.py`
- `test_phase6_killchain.py` → rename to `test_killchain.py`
- `test_phase6_mitre.py` → rename to `test_mitre.py`
- `test_phase6_reports.py` → rename to `test_reports.py`
- `test_phase5_api.py` → merge into `test_api.py` or `test_api_contracts.py`
- `test_phase1_phase2_rework.py` → distribute tests to appropriate domain files
- `test_phase2_api.py` → merge into `test_api.py`

After consolidation, no file should have a phase number in its name. Run all tests — the same number of tests must pass.

### Task 7.3: Enforce coverage threshold

File: `.github/workflows/ci.yml`

Change `--cov-fail-under=0` to `--cov-fail-under=80`. If current coverage is below 80%, write the additional tests needed to reach it before raising the threshold. Find the current coverage first:

```bash
python -m pytest tests/ --cov=app --cov-report=term-missing
```

Identify the least-covered modules and write targeted tests for them.

---

## PHASE 8: DOCUMENTATION AND DEVELOPER EXPERIENCE

**Objective:** Close the remaining documentation gaps identified in the audit.

### Task 8.1: Create CONTRIBUTING.md

File: `CONTRIBUTING.md` (new file)

Include:
- Development environment setup (Python 3.11, Node 20)
- How to run backend and frontend locally
- How to run tests
- Code style requirements (ruff, eslint, type hints, frozen dataclasses)
- Commit message conventions
- PR review checklist
- Architecture decision records process

### Task 8.2: Create developer quickstart in README

Add a "Development" section to README.md between "Getting Started" and "Testing" with:
- Prerequisites (Python 3.11, Node 20)
- First-time setup commands
- How to run both services in development mode
- How to run linters
- How to reset the database

### Task 8.3: Add OpenAPI documentation enrichment

File: `backend/app/main.py`

Enrich the FastAPI app metadata:

```python
app = FastAPI(
    title="AegisRange API",
    version="0.7.0",
    description="Defensive security simulation and validation platform API. "
                "Provides telemetry ingestion, deterministic detection, automated response, "
                "and auditable incident management.",
    docs_url="/docs",
    redoc_url="/redoc",
)
```

Add `tags_metadata` for OpenAPI tag descriptions. Add `description` parameters to every router's `APIRouter()` and every route decorator.

### Task 8.4: Add CHANGELOG.md

File: `CHANGELOG.md` (new file)

Retroactively document the major development milestones visible from the codebase:
- Event model and telemetry service
- Detection rules engine (10 rules)
- Response playbook system
- Incident lifecycle management
- Persistence layer (SQLite)
- Authentication and RBAC
- MITRE ATT&CK mapping
- Kill chain analysis
- Campaign detection
- Frontend dashboard and scenario execution
- Real-time SSE streaming
- Player progression system

---

## PHASE 9: CI HARDENING

**Objective:** Make the CI pipeline production-grade.

### Task 9.1: Add security scanning

File: `.github/workflows/ci.yml`

Add a `security-scan` job:

```yaml
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: "3.11"
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install bandit safety
    - name: Bandit security scan
      run: cd backend && bandit -r app/ -ll
    - name: Safety dependency scan
      run: cd backend && safety check -r requirements.txt
```

### Task 9.2: Add type checking to backend CI

Add `mypy` to the backend lint job:

```yaml
- name: Type check
  run: |
    pip install mypy
    python -m mypy app/ --ignore-missing-imports --no-implicit-optional --strict-optional
```

Fix any type errors that surface. This will catch the `object` type annotations and any other type unsafety.

### Task 9.3: Pin CI action versions

Replace `actions/checkout@v4` with the full SHA hash for supply-chain security:

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

Do the same for `actions/setup-python` and `actions/setup-node`.

---

## VERIFICATION CHECKLIST

After completing all phases, verify:

- [ ] `cd backend && python -m pytest tests/ -v --tb=short --cov=app --cov-fail-under=80` passes
- [ ] `cd backend && python -m ruff check app/ tests/` passes
- [ ] `cd backend && python -m ruff format --check app/ tests/` passes
- [ ] `cd backend && python -m mypy app/ --ignore-missing-imports` passes
- [ ] `cd frontend && npm run lint` passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd frontend && npm run build` passes
- [ ] `cd frontend && npm test -- --ci` passes
- [ ] `grep -rn "store\.\(incidents_by_correlation\|step_up_required\|download_restricted_actors\)" backend/app/services/` returns zero results
- [ ] No test file has a phase number in its name
- [ ] No page component exceeds 200 lines
- [ ] Every router function has a `response_model` annotation
- [ ] `docker compose up --build` succeeds and both services pass health checks
- [ ] The README accurately reflects the current state of the codebase
