# AegisRange Hardening and Responsive UX Upgrade — Demand for Perfection

## Context

You are performing a targeted security, quality, deployment, and responsive UX hardening pass on the
AegisRange codebase. A senior developer audit identified five specific
defects, and we are now adding a sixth requirement for mobile/tablet/desktop
responsiveness and view-specific layout control. Your job is to fix ALL of them
with production-grade precision. No half-measures, no regressions, no collateral
damage.

Read the codebase carefully before touching anything. Then fix each
defect in order. Run the full test suite after every change. Ship zero
broken tests.

The frontend must become mobile-friendly and tablet-friendly without degrading
desktop quality. It must support clean responsive behavior based on viewport
size and allow intentional differences between mobile, tablet, and desktop
layouts where needed.

────────────────────────────────────────────────────────
## DEFECT 1 — JWT Tokens Are Not Revoked on Logout
────────────────────────────────────────────────────────

FILES:
  backend/app/store.py
  backend/app/services/auth_service.py
  backend/app/routers/auth.py

PROBLEM:
  POST /auth/logout clears the httpOnly cookie, but the JWT token
  itself remains cryptographically valid until its exp timestamp.
  JTIs are generated but never checked against a deny-list. A captured
  token can be replayed for up to 24 hours post-logout.

REQUIRED CHANGES:

  1. Add a `revoked_jtis: set[str]` field to InMemoryStore.__init__.

  2. Add a `revoke_jti(jti: str) -> None` method to InMemoryStore that
     adds the jti to the set. Add a `is_jti_revoked(jti: str) -> bool`
     read accessor. Follow the exact encapsulation pattern used by
     `revoke_session` and `is_session_revoked`.

  3. In PersistenceLayer._init_db, add a `revoked_jtis` entry to the
     `state_sets` table. It already persists sets, so hook into the same
     save_operational_state / load_operational_state pattern used for
     `revoked_sessions` and `step_up_required`. Revoked JTIs MUST
     survive process restarts.

  4. In AuthService.verify_token, after the signature and expiry checks
     pass, extract the jti from the raw payload and call
     `STORE.is_jti_revoked(jti)`. If True, return None and treat as invalid.

  5. In the /auth/logout route handler, extract the token from the
     httpOnly cookie BEFORE clearing it. Decode the JTI from that token
     without full verification. The cookie was set by us, but still
     guard against malformed input. Call `STORE.revoke_jti(jti)`.
     Then clear the cookie as before.

  6. Write tests in backend/tests/test_auth_enforcement.py:
     - Test that a token used after logout returns 401.
     - Test that the JTI is persisted and still rejected after a
       simulated store reload.

CONSTRAINTS:
  Do NOT introduce new dependencies. Use only stdlib. Do NOT break the
  existing session revocation logic. The revoked_jtis set must be
  included in store.reset() cleanup.

────────────────────────────────────────────────────────
## DEFECT 2 — Dependency Versions Are Unpinned
────────────────────────────────────────────────────────

FILES:
  backend/requirements.txt
  backend/dev-requirements.txt
  .github/workflows/ci.yml

PROBLEM:
  All dependencies use `>=` floor constraints. A new install can silently
  pull breaking or vulnerable versions. There is no lockfile and no hash
  verification.

REQUIRED CHANGES:

  1. Rename the existing requirements.txt to requirements.in and
     dev-requirements.txt to dev-requirements.in. Keep the `>=` floors
     in the .in files. They document intent.

  2. Produce a fully pinned, hash-verified lockfile from requirements.in.

  3. Produce a fully pinned, hash-verified lockfile from dev-requirements.in.

  4. Update .github/workflows/ci.yml to use hash-verified installs for
     both runtime and dev dependencies in backend-lint and backend-test jobs.

  5. Update cache-dependency-path in both CI jobs to include both
     generated requirements.txt files.

  6. Add a comment block at the top of requirements.in and
     dev-requirements.in explaining:
     "Edit this file, then regenerate the pinned requirements.txt lockfile."

CONSTRAINTS:
  The .txt lockfiles must be committed. The .in source files must be
  committed alongside them. Do NOT manually edit the generated .txt
  files. pip-tools itself must NOT appear in requirements.txt or
  dev-requirements.txt. It is a development tool only.

────────────────────────────────────────────────────────
## DEFECT 3 — IncidentStatusUpdate.status Is an Unvalidated str
────────────────────────────────────────────────────────

FILES:
  backend/app/schemas.py
  backend/app/routers/incidents.py

PROBLEM:
  IncidentStatusUpdate.status is typed as plain `str`. Any arbitrary
  string passes Pydantic validation. The route handler enforces valid
  transitions via a dict, but invalid values such as "hacked" or ""
  reach the business logic before being rejected. The OpenAPI docs do
  not surface the valid values.

REQUIRED CHANGES:

  1. In schemas.py, replace the plain `str` type with a constrained
     Literal that exactly matches the valid router transitions:

       from typing import Literal

       class IncidentStatusUpdate(BaseModel):
           status: Literal[
               "investigating",
               "contained",
               "resolved",
               "closed",
           ]

  2. Verify the valid_transitions dict in the router still covers
     all Literal values. Add any missing transitions.

  3. Audit any other schema fields that accept a constrained set of
     string values, such as actor_role or severity string inputs.
     Fix any you find using Literal or an Enum.

  4. Add tests to backend/tests/test_api_contracts.py:
     - POST an invalid status string to /incidents/{id}/status and
       assert HTTP 422, not 400.
     - Confirm the 422 response body names the `status` field.

CONSTRAINTS:
  Do NOT change the Incident dataclass model itself. Only update the API
  request schema. The Literal values must exactly match the strings used
  in the valid_transitions dict in the router.

────────────────────────────────────────────────────────
## DEFECT 4 — Rate Limiter Is Process-Local and Undocumented
────────────────────────────────────────────────────────

FILES:
  backend/app/main.py
  backend/Dockerfile
  ARCHITECTURE.md
  DEPLOY.md

PROBLEM:
  The rate limiter lives in a module-level defaultdict in main.py.
  Each OS process tracks its own window independently, so with N
  workers the effective limit is N × 20. The CMD does not enforce
  single-worker mode. Neither ARCHITECTURE.md nor DEPLOY.md
  document this constraint.

REQUIRED CHANGES:

  1. In backend/Dockerfile, change the CMD to explicitly enforce a
     single worker and add a comment explaining why:

       # Single worker required: rate limiter and InMemoryStore are
       # process-local. Scale vertically or add Redis before adding workers.
       CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0",
            "--port", "8000", "--workers", "1"]

  2. In backend/app/main.py, add a module-level comment above
     `_rate_limit_store` and `_RATE_LIMIT_MAX_REQUESTS` explaining
     the single-worker constraint:

       # NOTE: This rate limiter is process-local and in-memory only.
       # It is only correct when the application runs with a single worker.
       # See Dockerfile CMD and ARCHITECTURE.md section Scaling Constraints.
       # To support multiple workers, replace with a shared limiter.

  3. In ARCHITECTURE.md, add a new subsection under Current
     Implemented Architecture titled "### Scaling Constraints" covering:
     - The InMemoryStore singleton and auth rate limiter are both
       process-local.
     - The application MUST run with a single Uvicorn worker.
     - Horizontal scaling requires extracting shared state to an
       external store.
     - The single-worker constraint is enforced in the Dockerfile CMD.

  4. In DEPLOY.md, add a "Scaling Warning" callout near the top
     of the deployment guide referencing the single-worker requirement
     and ARCHITECTURE.md.

  5. Add a test in backend/tests/test_architecture.py that reads the
     backend/Dockerfile and asserts that `--workers", "1"` appears in
     the CMD line as a regression guard.

CONSTRAINTS:
  Do NOT add Redis or any new runtime dependency for this change. The
  goal is documentation and enforcement, not a distributed rewrite.
  The Dockerfile CMD must remain a JSON array in exec form.

────────────────────────────────────────────────────────
## DEFECT 5 — No Test Coverage Measurement or Threshold
────────────────────────────────────────────────────────

FILES:
  backend/dev-requirements.in
  .github/workflows/ci.yml
  backend/pyproject.toml

PROBLEM:
  The test suite is large, but coverage is never measured. There is no
  minimum threshold in CI. Coverage regressions are invisible.

REQUIRED CHANGES:

  1. Add pytest-cov to dev-requirements.in and regenerate the lockfile.

  2. In .github/workflows/ci.yml, change the backend test run so coverage
     is measured for `app` only, a terminal missing-lines report is shown,
     and CI fails below an enforced threshold.

  3. Determine the current real coverage baseline first. If it is already
     above 70%, raise the threshold to the nearest lower multiple of 5 that
     the current suite still passes. Do not set a failing threshold.

  4. Add a `[tool.pytest.ini_options]` section to backend/pyproject.toml
     so pytest runs correctly from backend/ in CI and locally.

CONSTRAINTS:
  Do NOT exclude any existing source files from coverage measurement.
  Do NOT count test files toward coverage. Coverage source must remain
  `app` only. If any test fails due to import or environment issues,
  fix the test instead of suppressing coverage.

────────────────────────────────────────────────────────
## DEFECT 6 — Frontend Is Not Mobile-Friendly or View-Specific
────────────────────────────────────────────────────────

FILES:
  frontend/app/**
  frontend/components/**
  frontend/lib/**
  frontend/styles/** or equivalent styling files
  frontend/tailwind.config.* if present
  frontend/package.json if testing support needs to be extended
  frontend tests as needed

PROBLEM:
  The website is not properly optimized for mobile or tablet view.
  Important screens are desktop-first and do not adapt cleanly to smaller
  screens. Layouts, spacing, typography, cards, tables, forms, and auth
  flows need responsive behavior. We also need the ability to intentionally
  make mobile, tablet, and desktop versions differ where appropriate.

  The system must detect the current screen class safely and consistently,
  but it must not rely on brittle user-agent sniffing. View behavior should
  be driven by viewport and responsive breakpoints, with a shared mechanism
  for rendering or styling by screen class.

GOALS:
  - Mobile-friendly layout
  - Tablet-friendly layout
  - Desktop remains strong
  - Responsive behavior is consistent across the app
  - We can intentionally customize one view mode without breaking the others
  - The implementation is maintainable, not scattered one-off hacks

REQUIRED CHANGES:

  1. Establish a single responsive screen model for the frontend:
     - Define canonical breakpoints for:
       - mobile
       - tablet
       - desktop
     - Use existing Tailwind breakpoints if appropriate, but standardize them
       and document them in code.
     - If breakpoints already exist, audit and align usage instead of creating
       conflicting ones.

  2. Create a reusable viewport utility layer in frontend/lib or equivalent:
     - Add a SSR-safe hook or utility such as:
       - `useViewport()`
       - `useBreakpoint()`
       - or equivalent
     - It must expose stable booleans or a screen enum like:
       - `isMobile`
       - `isTablet`
       - `isDesktop`
       - and/or `screenType`
     - It must be hydration-safe. Do not create layout flicker from naïve
       `window` access during SSR.
     - Use `matchMedia` and/or viewport width logic safely.
     - Do NOT use user-agent sniffing.

  3. Add a reusable responsive layout strategy:
     - Create shared layout primitives or helper components where appropriate
       for:
       - page containers
       - section spacing
       - grid behavior
       - card stacking
       - table overflow
       - responsive form widths
       - button row wrapping
     - Remove ad hoc inconsistent spacing where practical.
     - Standardize max-width and padding behavior.

  4. Make the auth/login experience responsive:
     - Login screen must render cleanly on mobile, tablet, and desktop.
     - Inputs and buttons must fit narrow screens.
     - Credential helper or demo credentials panel must not break small screens.
     - Typography and spacing must scale appropriately.

  5. Audit major screens and make them responsive:
     At minimum, review and fix:
     - login/auth screens
     - dashboard/home screen
     - incident-related screens
     - document or evidence screens
     - analytics/reporting surfaces
     - any tables, cards, charts, and filter bars
     - navigation and header areas

     Required behavior:
     - On mobile, multi-column layouts should collapse intelligently.
     - On tablet, layouts may use 2-column or intermediate spacing where helpful.
     - On desktop, preserve richer layout where space allows.
     - Horizontal overflow must be intentional and controlled, especially for tables.

  6. Add a view-specific override pattern so screens can differ by mode:
     We need a maintainable way to make a screen look different on mobile,
     tablet, and desktop separately when desired.

     Implement one or both of these patterns cleanly:
     - responsive class-based composition using shared breakpoints
     - a view-aware component API, for example:
         `<ResponsiveView mobile={...} tablet={...} desktop={...} />`
       or a similar abstraction

     Requirements:
     - It must be optional, not forced on every component.
     - It must be easy to use on selected screens that need different layout.
     - It must not duplicate entire pages unless truly necessary.
     - Prefer composition over copy-paste divergence.

  7. Improve table and data-heavy surfaces for smaller screens:
     - Make large tables scroll horizontally inside controlled containers.
     - Consider card/list fallbacks for high-value screens if table UX is poor
       on mobile.
     - Keep headers readable.
     - Prevent content clipping.
     - Preserve usability for filters, search, and action buttons.

  8. Improve chart and panel responsiveness:
     - Charts must resize correctly.
     - Panels and cards must stack cleanly.
     - Side-by-side desktop panels should collapse or reorder on smaller screens.
     - Avoid fixed-width chart containers.

  9. Improve navigation and interaction responsiveness:
     - Header/nav areas must not overflow on mobile.
     - Long action rows should wrap or collapse cleanly.
     - Buttons must remain tappable on touch devices.
     - Modal/dialog sizing must work on smaller screens.
     - Overflow and scroll locking must behave correctly.

  10. Add targeted frontend tests for responsive behavior where practical:
      - Test the viewport utility or breakpoint hook.
      - Test at least one responsive component or layout abstraction.
      - Add regression coverage for any new view-aware helper component.
      - If existing frontend tests are minimal, add focused tests without
        overbuilding a huge test harness.

  11. Add documentation for responsive behavior:
      - Document the breakpoint model
      - Document the viewport helper or responsive abstraction
      - Document how to make mobile-only, tablet-only, or desktop-only edits
        safely in future work
      - Add a short section in frontend docs or README if present

CONSTRAINTS:
  - Do NOT implement screen detection using user-agent sniffing.
  - Do NOT hardcode device names.
  - Do NOT create separate disconnected apps for mobile and desktop.
  - Do NOT solve this with random one-off media queries scattered everywhere.
  - Prefer a centralized, reusable, composable responsive system.
  - Keep accessibility intact.
  - Preserve existing functionality.
  - Keep desktop quality high while improving smaller viewports.
  - Any screen-specific differences must be intentional and maintainable.

DEFINITION OF DONE FOR DEFECT 6:
  ✓ Core screens render cleanly on mobile, tablet, and desktop
  ✓ A reusable viewport/breakpoint abstraction exists
  ✓ We can intentionally customize selected screens by mobile/tablet/desktop
  ✓ Tables, forms, cards, nav, and charts behave responsively
  ✓ Responsive behavior is documented
  ✓ Frontend tests cover the new responsive utility or abstraction
  ✓ No desktop regressions introduced

────────────────────────────────────────────────────────
## Cross-Cutting Requirements
────────────────────────────────────────────────────────

BEFORE you write any code:
  - Run the full backend test suite and confirm baseline is green.
  - Read the full store.py, auth_service.py, and persistence.py before
    touching any of them.
  - Read the core frontend layout, auth, dashboard, and shared component files
    before touching responsive behavior.

AFTER each defect fix:
  - Run the full relevant test suite. Zero failures required before proceeding.
  - Verify the fix addresses the root cause, not just the symptom.

CODE STYLE — match the existing codebase exactly:
  - `from __future__ import annotations` at top of every Python file.
  - Docstrings on all new public methods and utilities.
  - Type annotations on all new function signatures.
  - No bare `except:` clauses. Always catch specific exceptions.
  - No `print()`. Use the existing logging patterns.
  - Frozen dataclasses for new immutable value objects where appropriate.
  - Match existing TypeScript and React conventions on the frontend.
  - Keep comments minimal, natural, and useful.

DO NOT:
  - Add any new runtime dependency not justified by the existing stack and these instructions.
  - Change the public API surface of any existing router endpoint.
  - Alter existing test assertions. Only add new tests or adjust tests if a legitimate contract changed for the right reason.
  - Use `datetime.utcnow()`. Use the project's `utc_now()` helper.
  - Use user-agent sniffing for responsive behavior.
  - Create duplicate page implementations for each device class unless absolutely necessary.

DEFINITION OF DONE:
  ✓ All 6 defects resolved with the exact changes described above.
  ✓ Backend tests pass with enforced coverage threshold.
  ✓ Linting passes.
  ✓ Formatting checks pass.
  ✓ Docker backend build succeeds.
  ✓ All new code has docstrings and type annotations where appropriate.
  ✓ ARCHITECTURE.md and DEPLOY.md are updated for scaling constraints.
  ✓ Responsive behavior is implemented and documented.
  ✓ Frontend remains functional across mobile, tablet, and desktop.
  ✓ No new `# type: ignore` or `# noqa` suppressions added.

EXECUTION ORDER:
  1. Fix Defect 1 completely
  2. Fix Defect 2 completely
  3. Fix Defect 3 completely
  4. Fix Defect 4 completely
  5. Fix Defect 5 completely
  6. Fix Defect 6 completely
  7. Run all relevant backend and frontend verification
  8. Summarize exactly what changed, file by file, and why

OUTPUT REQUIREMENTS:
  - Show findings first
  - Then show the implementation plan
  - Then perform the fixes
  - After each defect, report:
      - files changed
      - tests run
      - result
      - remaining risk
  - At the end, provide:
      - final file list changed
      - final verification summary
      - any residual limitations
      - any follow-up recommendations that are genuinely still warranted

Be rigorous. Be skeptical. Fix everything properly.