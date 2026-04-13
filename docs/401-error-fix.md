# AegisRange — Fix Scenario 401s, Restore Auth Flow, and Remove Broken Demo Behavior

## Context

You are fixing a real auth and scenario-execution defect in the AegisRange project.

The current production behavior is inconsistent and broken:

- Scenario **RUN** actions return **401 Unauthorized** on the live site
- The **Scenarios** page visibly surfaces `Error: API 401:`
- The dashboard quick-scenario cards trigger the same failure path, but the UX is less obvious
- The frontend currently behaves like a **demo-auth shell** instead of a real authenticated app
- The backend scenario routes are protected and require the **red_team** role
- There is no working login page, and `/login` currently resolves to a 404 route
- The frontend auth context is hardcoded to a static demo identity and does not perform real authentication
- Scenario execution is currently treated as **live-only**, with no graceful unauthorized UX

Your job is to fix this **end-to-end** in a production-clean, internally consistent way.

---

## Core Objective

Eliminate the scenario 401 problem by aligning:

1. frontend authentication
2. backend authorization
3. scenario execution UX
4. login routing
5. role-aware behavior

The final system must not pretend the user is authenticated when they are not.

---

## Architectural Reality You Must Respect

### Backend
Scenario routes are intentionally protected and require:

- `red_team` role

This access control should remain meaningful unless a deliberate, explicit demo-mode override is introduced.

### Frontend
The current frontend has a broken design mismatch:

- `AuthProvider` returns a static demo identity
- user appears authenticated even when no backend auth exists
- scenario execution still calls real protected endpoints
- no valid login acquisition path exists
- `/login` is missing

This mismatch is the root problem.

---

## Decision Rule

Implement a **real authentication path** and **role-aware scenario UX**.

Do **not** solve this by blindly removing authorization from the backend.

Only introduce a demo-mode bypass if it is explicit, environment-gated, and clearly separated from production behavior.

Default expectation:
- real login
- real token/cookie flow
- real role checks
- graceful unauthorized UX

---

# Phase 1 — Audit and Confirm Current Failure Paths

## Step 1 — Verify current files involved

Inspect and confirm behavior in at least these files:

### Frontend
- `frontend/lib/auth-context.tsx`
- `frontend/lib/api.ts`
- `frontend/app/scenarios/page.tsx`
- `frontend/app/components/dashboard/ScenarioGrid.tsx`
- `frontend/app/layout.tsx`
- any existing auth or guard components
- any route files related to login or user session

### Backend
- `backend/app/routers/scenarios.py`
- `backend/app/routers/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/main.py`
- any dependency/auth middleware files

Do not guess. Confirm actual control flow first.

---

# Phase 2 — Replace Fake Demo Auth with Real Platform Auth

## Problem

`frontend/lib/auth-context.tsx` currently returns a fake authenticated user and no-op login/logout behavior.

That is wrong.

It causes the UI to imply authenticated access while protected backend endpoints still reject requests.

## Required Actions

1. Replace the current static demo auth context with a real auth provider.
2. The auth provider must:
   - determine the current user from the backend
   - expose authenticated state based on reality
   - expose working `login()` and `logout()` functions
   - stop claiming the user is authenticated unless backend session/token validation confirms it
3. Use the existing platform auth endpoints if already implemented:
   - `/auth/login`
   - `/auth/logout`
   - `/auth/me`
4. On app load, fetch current user from backend and hydrate auth state.
5. If unauthenticated:
   - `isAuthenticated` must be false
   - role must be null
   - username must be null

Do not preserve fake demo identity as the default state.

---

# Phase 3 — Create a Real Login Page and Route

## Problem

The application currently has no working login route and `/login` returns a 404.

## Required Actions

1. Create a real login page at:

- `frontend/app/login/page.tsx`

2. The page must:
   - render a clean login form
   - collect username and password
   - call the real auth context login flow
   - redirect after successful login
   - show meaningful auth errors on failure

3. The login page should support at least the platform roles already represented in backend auth:
   - admin
   - soc_manager
   - analyst
   - red_team
   - viewer

4. Do not hardcode credentials into the UI.
5. If helpful for development, add non-secret hint text only if already documented or clearly dev-only.

---

# Phase 4 — Make Scenario UX Role-Aware

## Problem

Scenario execution currently assumes a live authenticated backend but does not handle missing auth or wrong roles in a coherent way.

## Required Actions

### Scenarios page
Update the scenario cards page so that:
- unauthenticated users do not just hit 401 with a raw error string
- users without `red_team` privileges get a clear message
- buttons are disabled or rerouted appropriately when access is not allowed

### Dashboard quick scenarios
Update dashboard quick scenario cards to use the same logic.

### Required behavior
1. If the user is not logged in:
   - clicking RUN should direct them to login or show a clear login-required message
2. If the user is logged in but lacks `red_team`:
   - disable RUN or show an explicit “red team access required” message
3. If the user has `red_team`:
   - RUN should work against live backend execution

Do not allow the UI to behave as though all users can run protected scenarios.

---

# Phase 5 — Fix Scenario API Error Handling

## Problem

`runScenario()` currently uses a strict live-only path and surfaces raw API failures poorly.

## Required Actions

Update `frontend/lib/api.ts` and any scenario action handlers so that:

1. Unauthorized responses are handled intentionally
2. 401 and 403 are distinguishable in the UI
3. Raw messages like:
   - `Error: API 401:`
   do not appear directly to users

### Desired UX mapping
- 401 → “Please sign in to run scenarios.”
- 403 → “Your account does not have red team access.”
- backend unavailable → “Scenario execution is unavailable right now.”
- other errors → concise, user-friendly fallback

Do not hide real errors from developers in logs, but do not leak raw low-context errors into the interface.

---

# Phase 6 — Preserve Backend Authorization Integrity

## Problem

The backend red_team restriction is probably correct and should not be casually removed.

## Required Actions

1. Keep scenario endpoints protected by role-aware auth unless an explicit demo flag is introduced
2. Review:
   - `backend/app/routers/scenarios.py`
   - auth dependency chain
3. Confirm that:
   - valid red_team authentication succeeds
   - unauthenticated access returns 401
   - authenticated non-red_team access returns 403

Do not weaken the route protection to paper over frontend defects.

---

# Phase 7 — Optional Demo Mode Only If Explicitly Environment-Gated

## Only do this if needed and only if implemented safely

If the product requires recruiter/demo operation without real login, implement a **strictly environment-gated demo mode**.

### Requirements for demo mode
1. Must be controlled by an explicit environment variable
2. Must not silently activate in production by default
3. Must be easy to identify in code
4. Must not masquerade as real auth
5. Must not weaken normal production auth flow

### Acceptable demo-mode behavior
- auto-inject a known demo `red_team` identity only when demo mode is explicitly enabled
- or allow scenario execution through a demo backend path that is clearly marked

### Unacceptable behavior
- fake global auth context that always says user is authenticated
- hidden bypasses with no environment guard
- mixed fake auth plus real protected API calls

If demo mode is added, document it clearly.

---

# Phase 8 — Add Route Protection / Navigation Logic

## Required Actions

1. Add proper auth-aware navigation behavior:
   - unauthenticated users can view allowed public pages
   - scenario execution requires login
2. If route guards already exist, integrate them cleanly
3. Consider whether scenario detail pages should:
   - remain browsable
   - but restrict actual launch/run behavior

Keep public read-only browsing and protected execution clearly separated.

---

# Phase 9 — Update Tests

## Required Actions

Add or update tests to cover:

### Frontend
- login page renders
- login success updates auth state
- unauthenticated scenario run shows proper UX
- non-red_team user gets role error UX
- red_team user can trigger scenario action path
- no raw `Error: API 401:` text leaks into user-facing UI

### Backend
- unauthenticated scenario run returns 401
- analyst or viewer scenario run returns 403
- red_team scenario run returns 200
- auth endpoints still work correctly

Do not leave this as a manual-only fix.

---

# Phase 10 — Remove Broken Demo Assumptions

## Required Actions

After implementing the real fix:

1. Remove the old fake-auth assumptions from:
   - auth context
   - login/logout no-ops
   - any comments claiming auth is disabled if that is no longer true
2. Update documentation where needed:
   - auth flow
   - scenario access model
   - demo mode, if added

The codebase must tell the truth about how authentication works.

---

# Files Likely to Change

Expect to modify some or all of these:

## Frontend
- `frontend/lib/auth-context.tsx`
- `frontend/lib/api.ts`
- `frontend/app/login/page.tsx`  ← create if missing
- `frontend/app/scenarios/page.tsx`
- `frontend/app/components/dashboard/ScenarioGrid.tsx`
- `frontend/components/AuthGuard.tsx` if applicable
- `frontend/app/layout.tsx` if provider wiring changes

## Backend
- `backend/app/routers/scenarios.py`
- `backend/app/routers/auth.py`
- `backend/app/services/auth_service.py`
- any auth dependency or middleware files if needed

Only change backend auth rules if the design explicitly requires it.

---

# Validation Checklist

Before finishing, verify all of the following:

## Live auth flow
- login page exists
- valid login succeeds
- invalid login fails cleanly
- logout works
- current-user state is real, not fake

## Scenario execution
- unauthenticated run does not leak raw 401 text
- unauthenticated user is guided to login
- non-red_team user gets clear access-denied UX
- red_team user can run scenarios successfully

## Integrity
- backend still enforces role-based scenario protection
- frontend no longer claims authenticated access without proof
- dashboard and scenarios page behave consistently

## Regression
- app still builds
- existing dashboard data still loads
- auth-related tests pass
- scenario tests pass

---

# Output Requirements

When complete, provide:

1. concise summary of root cause
2. exact files changed
3. whether you implemented:
   - real login only
   - or real login plus demo mode
4. how unauthorized scenario execution is now handled
5. any credentials assumptions used for local testing
6. any follow-up work still recommended

---

# Execution Directive

Fix the real architecture mismatch.

Do not patch around it with cosmetic error suppression alone.

The correct end state is:

- the frontend reflects real auth state
- the login route exists
- scenario execution is role-aware
- backend protection remains meaningful
- users never see broken raw 401 behavior again
