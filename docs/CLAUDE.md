# AegisRange Hardening — Demand for Perfection

## Context

You are performing a targeted security and quality hardening pass on the
AegisRange codebase. A senior developer audit identified five specific
defects. Your job is to fix ALL of them with production-grade precision.
No half-measures, no regressions, no collateral damage.

Read the codebase carefully before touching anything. Then fix each
defect in order. Run the full test suite after every change. Ship zero
broken tests.

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
     `state_sets` table (it already persists sets — hook into the same
     save_operational_state / load_operational_state pattern used for
     `revoked_sessions` and `step_up_required`). Revoked JTIs MUST
     survive process restarts.

  4. In AuthService.verify_token, after the signature and expiry checks
     pass, extract the jti from the raw payload and call
     `STORE.is_jti_revoked(jti)`. If True, return None (treat as invalid).

  5. In the /auth/logout route handler, extract the token from the
     httpOnly cookie BEFORE clearing it. Decode the JTI from that token
     (without full verification — the cookie was set by us, but still
     guard against malformed input). Call `STORE.revoke_jti(jti)`.
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
  All dependencies use `>=` floor constraints. A pip install on a new
  deployment can silently pull breaking or vulnerable versions. There is
  no lockfile and no hash verification.

REQUIRED CHANGES:

  1. Install pip-tools: `pip install pip-tools`

  2. Rename the existing requirements.txt to requirements.in and
     dev-requirements.txt to dev-requirements.in. Keep the `>=` floors
     in the .in files — they document intent.

  3. Run `pip-compile requirements.in --generate-hashes --output-file
     requirements.txt` to produce a fully pinned, hash-verified lockfile.

  4. Run `pip-compile dev-requirements.in --generate-hashes
     --output-file dev-requirements.txt` for dev dependencies.

  5. Update .github/workflows/ci.yml to use
     `pip install --require-hashes -r requirements.txt
     -r dev-requirements.txt`
     in both backend-lint and backend-test jobs.

  6. Update cache-dependency-path in both CI jobs to include both
     requirements.txt files.

  7. Add a comment block at the top of requirements.in and
     dev-requirements.in explaining:
     "Edit this file, then run `pip-compile <file>.in --generate-hashes`
      to regenerate the pinned requirements.txt lockfile."

CONSTRAINTS:
  The .txt lockfiles must be committed. The .in source files must be
  committed alongside them. Do NOT manually edit the generated .txt
  files. pip-tools itself should NOT be in requirements.txt or
  dev-requirements.txt — it is a development tool only.

────────────────────────────────────────────────────────
## DEFECT 3 — IncidentStatusUpdate.status Is an Unvalidated str
────────────────────────────────────────────────────────

FILES:
  backend/app/schemas.py
  backend/app/routers/incidents.py

PROBLEM:
  IncidentStatusUpdate.status is typed as plain `str`. Any arbitrary
  string passes Pydantic validation. The route handler enforces valid
  transitions via a dict, but invalid values (e.g. "hacked", "") reach
  the business logic before being rejected. The OpenAPI docs do not
  surface the valid values.

REQUIRED CHANGES:

  1. In schemas.py, replace the plain `str` type with a Literal:

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

  3. Do the same audit for any other schema fields that accept a
     constrained set of string values (e.g. actor_role, severity
     string inputs). Fix any you find — apply Literal or an Enum.

  4. Add tests to backend/tests/test_api_contracts.py:
     - POST an invalid status string to /incidents/{id}/status and
       assert HTTP 422 (Pydantic rejection), NOT 400.
     - Confirm the 422 response body names the `status` field.

CONSTRAINTS:
  Do NOT change the Incident dataclass model itself — only the API
  request schema. The Literal values must exactly match the strings
  used in the valid_transitions dict in the router.

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

       # NOTE: This rate limiter is process-local (in-memory only).
       # It is only correct when the application runs with a single worker.
       # See Dockerfile CMD and ARCHITECTURE.md §Scaling Constraints.
       # To support multiple workers, replace with a Redis-backed limiter.

  3. In ARCHITECTURE.md, add a new subsection under §3 (Current
     Implemented Architecture) titled "### Scaling Constraints" with
     the following content:
     - The InMemoryStore singleton and the auth rate limiter are both
       process-local. The application MUST run with a single Uvicorn
       worker.
     - Horizontal scaling requires extracting shared state to an
       external store (Redis for rate limiting, PostgreSQL or a shared
       SQLite file for the entity store).
     - The single-worker constraint is enforced in the Dockerfile CMD.

  4. In DEPLOY.md, add a "⚠ Scaling Warning" callout near the top
     of the deployment guide referencing the single-worker requirement
     and linking to ARCHITECTURE.md.

  5. Add a test in backend/tests/test_architecture.py that reads the
     backend/Dockerfile and asserts that `--workers 1` appears in
     the CMD line. This acts as a regression guard.

CONSTRAINTS:
  Do NOT add Redis or any new runtime dependency for this change. The
  goal is documentation and enforcement, not a full distributed
  rewrite. The Dockerfile CMD must remain a JSON array (exec form),
  not a shell string.

────────────────────────────────────────────────────────
## DEFECT 5 — No Test Coverage Measurement or Threshold
────────────────────────────────────────────────────────

FILES:
  backend/dev-requirements.in   (post Defect 2 rename)
  .github/workflows/ci.yml

PROBLEM:
  The test suite is large (~7,000 lines, 26 files) but coverage is
  never measured. There is no minimum threshold in CI. Coverage
  regressions are invisible.

REQUIRED CHANGES:

  1. Add `pytest-cov>=4.0` to dev-requirements.in. Recompile the
     lockfile as described in Defect 2.

  2. In .github/workflows/ci.yml, change the test run command in the
     backend-test job to:

       python -m pytest tests/ -v --tb=short \
         --cov=app --cov-report=term-missing \
         --cov-fail-under=70

     The `--cov-fail-under=70` flag causes CI to fail if overall
     coverage drops below 70%. This is the floor, not the target.

  3. Run the tests locally first to confirm the current coverage
     baseline. If it is already above 70%, raise the threshold to
     match the actual baseline (round down to the nearest 5%). Do
     not set a threshold that the current suite already fails.

  4. Add a `[tool.pytest.ini_options]` section to a new
     `backend/pyproject.toml` (create it if absent):

       [tool.pytest.ini_options]
       testpaths = ["tests"]
       addopts = "--tb=short"

     This ensures `python -m pytest` with no arguments works
     correctly from the backend/ directory in both CI and locally.

CONSTRAINTS:
  Do NOT exclude any existing source files from coverage measurement.
  Do NOT count test files themselves toward coverage. The coverage
  source must be `--cov=app` only. If any test currently fails due to
  an import error or environment issue, fix the test — do not suppress
  coverage for it.

────────────────────────────────────────────────────────
## Cross-Cutting Requirements
────────────────────────────────────────────────────────

BEFORE you write any code:
  - Run `python -m pytest tests/ -v` and confirm baseline is green.
  - Read the full store.py, auth_service.py, and persistence.py before
    touching any of them.

AFTER each defect fix:
  - Run the full test suite. Zero failures required before proceeding.
  - Verify the fix addresses the root cause, not just the symptom.

CODE STYLE — match the existing codebase exactly:
  - `from __future__ import annotations` at top of every Python file.
  - Docstrings on all new public methods (follow existing style).
  - Type annotations on all new function signatures.
  - No bare `except:` clauses — always catch specific exceptions.
  - No `print()` — use `logger = logging.getLogger("aegisrange.*")`.
  - Frozen dataclasses for new immutable value objects.

DO NOT:
  - Add any new runtime dependency not listed in these instructions.
  - Change the public API surface of any existing router endpoint.
  - Alter existing test assertions — only add new tests.
  - Use `datetime.utcnow()` — use the project's `utc_now()` helper.
  - Touch the frontend for any of these fixes.

DEFINITION OF DONE:
  ✓ All 5 defects resolved with the exact changes described above.
  ✓ `python -m pytest tests/ -v --cov=app --cov-fail-under=70` passes.
  ✓ `ruff check app/ tests/` reports zero violations.
  ✓ `ruff format --check app/ tests/` reports zero violations.
  ✓ Docker build succeeds: `docker build -t aegisrange-backend ./backend`.
  ✓ All new code has docstrings and type annotations.
  ✓ ARCHITECTURE.md and DEPLOY.md are updated (Defect 4).
  ✓ No new `# type: ignore` or `# noqa` suppressions added.
```