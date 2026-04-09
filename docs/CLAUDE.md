<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AegisRange — Claude Code Hardening Prompt</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --bg: #0a0c10;
    --surface: #10141c;
    --border: #1e2530;
    --border-bright: #2e3a4a;
    --text: #c8d4e0;
    --text-dim: #5a6a7a;
    --text-bright: #e8f0f8;
    --accent: #00d4ff;
    --accent-dim: rgba(0, 212, 255, 0.12);
    --accent-glow: rgba(0, 212, 255, 0.25);
    --warn: #ff6b35;
    --warn-dim: rgba(255, 107, 53, 0.1);
    --green: #00e5a0;
    --green-dim: rgba(0, 229, 160, 0.1);
    --purple: #a78bfa;
    --yellow: #fbbf24;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    line-height: 1.7;
    min-height: 100vh;
  }

  /* Scanline overlay */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.05) 2px,
      rgba(0, 0, 0, 0.05) 4px
    );
    pointer-events: none;
    z-index: 999;
  }

  .shell {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* ── Header ── */
  .header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 32px;
    margin-bottom: 40px;
    position: relative;
  }

  .header::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .badge {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid;
  }

  .badge-cyan { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
  .badge-orange { color: var(--warn); border-color: var(--warn); background: var(--warn-dim); }
  .badge-green { color: var(--green); border-color: var(--green); background: var(--green-dim); }

  h1 {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-bright);
    line-height: 1.2;
    margin-bottom: 10px;
    letter-spacing: -0.02em;
  }

  h1 span { color: var(--accent); }

  .subtitle {
    color: var(--text-dim);
    font-size: 14px;
    font-family: 'IBM Plex Mono', monospace;
  }

  /* ── Copy button ── */
  .copy-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .copy-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    padding: 8px 18px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .copy-btn:hover {
    background: var(--accent-glow);
    box-shadow: 0 0 16px var(--accent-glow);
  }

  .copy-btn.copied {
    color: var(--green);
    border-color: var(--green);
    background: var(--green-dim);
  }

  /* ── Prompt block ── */
  .prompt-wrap {
    position: relative;
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    background: var(--surface);
    overflow: hidden;
  }

  .prompt-wrap::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0,212,255,0.03) 0%, transparent 50%);
    pointer-events: none;
  }

  .prompt-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }

  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-r { background: #ff5f57; }
  .dot-y { background: #febc2e; }
  .dot-g { background: #28c840; }

  .prompt-body {
    padding: 24px 28px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    line-height: 1.85;
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 70vh;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .prompt-body::-webkit-scrollbar { width: 6px; }
  .prompt-body::-webkit-scrollbar-track { background: transparent; }
  .prompt-body::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 3px; }

  /* Syntax highlights within the prompt text */
  .prompt-body .h1 { color: var(--accent); font-weight: 700; }
  .prompt-body .h2 { color: var(--purple); font-weight: 600; }
  .prompt-body .h3 { color: var(--yellow); font-weight: 600; }
  .prompt-body .kw { color: var(--warn); font-weight: 600; }
  .prompt-body .ok { color: var(--green); }
  .prompt-body .dim { color: var(--text-dim); }
  .prompt-body .hl { color: var(--text-bright); }

  /* ── Breakdown cards ── */
  .section-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin: 48px 0 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 600px) { .cards { grid-template-columns: 1fr; } }

  .card {
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 16px 18px;
    background: var(--surface);
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .card:hover { border-color: var(--border-bright); }

  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
  }

  .card.sec::before { background: var(--warn); }
  .card.qual::before { background: var(--accent); }
  .card.test::before { background: var(--green); }
  .card.ops::before { background: var(--purple); }

  .card-num {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
    margin-bottom: 6px;
  }

  .card-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-bright);
    margin-bottom: 8px;
  }

  .card-desc {
    font-size: 13px;
    color: var(--text-dim);
    line-height: 1.5;
  }
</style>
</head>
<body>
<div class="shell">

  <div class="header">
    <div class="badge-row">
      <span class="badge badge-orange">Claude Code</span>
      <span class="badge badge-cyan">AegisRange</span>
      <span class="badge badge-green">5 Defects · All Addressed</span>
    </div>
    <h1>HARDENING<span> PROMPT</span></h1>
    <div class="subtitle">// Demand-for-perfection · Security + Quality + Testing + Ops</div>
  </div>

  <div class="copy-bar">
    <button class="copy-btn" id="copyBtn" onclick="copyPrompt()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Copy Prompt
    </button>
  </div>

  <div class="prompt-wrap">
    <div class="prompt-header">
      <span class="dot dot-r"></span>
      <span class="dot dot-y"></span>
      <span class="dot dot-g"></span>
      <span style="margin-left:8px;">CLAUDE_CODE_PROMPT.md</span>
    </div>
    <div class="prompt-body" id="promptBody"><span class="h1"># AegisRange Hardening — Demand for Perfection</span>

<span class="dim">## Context</span>

You are performing a targeted security and quality hardening pass on the
AegisRange codebase. A senior developer audit identified five specific
defects. Your job is to fix ALL of them with production-grade precision.
No half-measures, no regressions, no collateral damage.

Read the codebase carefully before touching anything. Then fix each
defect in order. Run the full test suite after every change. Ship zero
broken tests.

<span class="dim">────────────────────────────────────────────────────────</span>
<span class="h2">## DEFECT 1 — JWT Tokens Are Not Revoked on Logout</span>
<span class="dim">────────────────────────────────────────────────────────</span>

<span class="kw">FILES:</span>
  backend/app/store.py
  backend/app/services/auth_service.py
  backend/app/routers/auth.py

<span class="kw">PROBLEM:</span>
  POST /auth/logout clears the httpOnly cookie, but the JWT token
  itself remains cryptographically valid until its exp timestamp.
  JTIs are generated but never checked against a deny-list. A captured
  token can be replayed for up to 24 hours post-logout.

<span class="kw">REQUIRED CHANGES:</span>

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

<span class="kw">CONSTRAINTS:</span>
  Do NOT introduce new dependencies. Use only stdlib. Do NOT break the
  existing session revocation logic. The revoked_jtis set must be
  included in store.reset() cleanup.

<span class="dim">────────────────────────────────────────────────────────</span>
<span class="h2">## DEFECT 2 — Dependency Versions Are Unpinned</span>
<span class="dim">────────────────────────────────────────────────────────</span>

<span class="kw">FILES:</span>
  backend/requirements.txt
  backend/dev-requirements.txt
  .github/workflows/ci.yml

<span class="kw">PROBLEM:</span>
  All dependencies use `>=` floor constraints. A pip install on a new
  deployment can silently pull breaking or vulnerable versions. There is
  no lockfile and no hash verification.

<span class="kw">REQUIRED CHANGES:</span>

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

<span class="kw">CONSTRAINTS:</span>
  The .txt lockfiles must be committed. The .in source files must be
  committed alongside them. Do NOT manually edit the generated .txt
  files. pip-tools itself should NOT be in requirements.txt or
  dev-requirements.txt — it is a development tool only.

<span class="dim">────────────────────────────────────────────────────────</span>
<span class="h2">## DEFECT 3 — IncidentStatusUpdate.status Is an Unvalidated str</span>
<span class="dim">────────────────────────────────────────────────────────</span>

<span class="kw">FILES:</span>
  backend/app/schemas.py
  backend/app/routers/incidents.py

<span class="kw">PROBLEM:</span>
  IncidentStatusUpdate.status is typed as plain `str`. Any arbitrary
  string passes Pydantic validation. The route handler enforces valid
  transitions via a dict, but invalid values (e.g. "hacked", "") reach
  the business logic before being rejected. The OpenAPI docs do not
  surface the valid values.

<span class="kw">REQUIRED CHANGES:</span>

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

<span class="kw">CONSTRAINTS:</span>
  Do NOT change the Incident dataclass model itself — only the API
  request schema. The Literal values must exactly match the strings
  used in the valid_transitions dict in the router.

<span class="dim">────────────────────────────────────────────────────────</span>
<span class="h2">## DEFECT 4 — Rate Limiter Is Process-Local and Undocumented</span>
<span class="dim">────────────────────────────────────────────────────────</span>

<span class="kw">FILES:</span>
  backend/app/main.py
  backend/Dockerfile
  ARCHITECTURE.md
  DEPLOY.md

<span class="kw">PROBLEM:</span>
  The rate limiter lives in a module-level defaultdict in main.py.
  Each OS process tracks its own window independently, so with N
  workers the effective limit is N × 20. The CMD does not enforce
  single-worker mode. Neither ARCHITECTURE.md nor DEPLOY.md
  document this constraint.

<span class="kw">REQUIRED CHANGES:</span>

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

<span class="kw">CONSTRAINTS:</span>
  Do NOT add Redis or any new runtime dependency for this change. The
  goal is documentation and enforcement, not a full distributed
  rewrite. The Dockerfile CMD must remain a JSON array (exec form),
  not a shell string.

<span class="dim">────────────────────────────────────────────────────────</span>
<span class="h2">## DEFECT 5 — No Test Coverage Measurement or Threshold</span>
<span class="dim">────────────────────────────────────────────────────────</span>

<span class="kw">FILES:</span>
  backend/dev-requirements.in   (post Defect 2 rename)
  .github/workflows/ci.yml

<span class="kw">PROBLEM:</span>
  The test suite is large (~7,000 lines, 26 files) but coverage is
  never measured. There is no minimum threshold in CI. Coverage
  regressions are invisible.

<span class="kw">REQUIRED CHANGES:</span>

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

<span class="kw">CONSTRAINTS:</span>
  Do NOT exclude any existing source files from coverage measurement.
  Do NOT count test files themselves toward coverage. The coverage
  source must be `--cov=app` only. If any test currently fails due to
  an import error or environment issue, fix the test — do not suppress
  coverage for it.

<span class="dim">────────────────────────────────────────────────────────</span>
<span class="h2">## Cross-Cutting Requirements</span>
<span class="dim">────────────────────────────────────────────────────────</span>

<span class="kw">BEFORE you write any code:</span>
  - Run `python -m pytest tests/ -v` and confirm baseline is green.
  - Read the full store.py, auth_service.py, and persistence.py before
    touching any of them.

<span class="kw">AFTER each defect fix:</span>
  - Run the full test suite. Zero failures required before proceeding.
  - Verify the fix addresses the root cause, not just the symptom.

<span class="kw">CODE STYLE — match the existing codebase exactly:</span>
  - `from __future__ import annotations` at top of every Python file.
  - Docstrings on all new public methods (follow existing style).
  - Type annotations on all new function signatures.
  - No bare `except:` clauses — always catch specific exceptions.
  - No `print()` — use `logger = logging.getLogger("aegisrange.*")`.
  - Frozen dataclasses for new immutable value objects.

<span class="kw">DO NOT:</span>
  - Add any new runtime dependency not listed in these instructions.
  - Change the public API surface of any existing router endpoint.
  - Alter existing test assertions — only add new tests.
  - Use `datetime.utcnow()` — use the project's `utc_now()` helper.
  - Touch the frontend for any of these fixes.

<span class="kw">DEFINITION OF DONE:</span>
  <span class="ok">✓</span> All 5 defects resolved with the exact changes described above.
  <span class="ok">✓</span> `python -m pytest tests/ -v --cov=app --cov-fail-under=70` passes.
  <span class="ok">✓</span> `ruff check app/ tests/` reports zero violations.
  <span class="ok">✓</span> `ruff format --check app/ tests/` reports zero violations.
  <span class="ok">✓</span> Docker build succeeds: `docker build -t aegisrange-backend ./backend`.
  <span class="ok">✓</span> All new code has docstrings and type annotations.
  <span class="ok">✓</span> ARCHITECTURE.md and DEPLOY.md are updated (Defect 4).
  <span class="ok">✓</span> No new `# type: ignore` or `# noqa` suppressions added.
</div>
  </div>

  <div class="section-label">Defect map</div>

  <div class="cards">
    <div class="card sec">
      <div class="card-num">DEFECT 01 · SECURITY</div>
      <div class="card-title">JWT Token Revocation</div>
      <div class="card-desc">Add revoked_jtis set to store, hook into persistence, check in verify_token, extract + revoke on logout.</div>
    </div>
    <div class="card qual">
      <div class="card-num">DEFECT 02 · SUPPLY CHAIN</div>
      <div class="card-title">Pinned Dependency Lockfile</div>
      <div class="card-desc">pip-tools .in → .txt with --generate-hashes. CI uses --require-hashes. Both files committed.</div>
    </div>
    <div class="card qual">
      <div class="card-num">DEFECT 03 · VALIDATION</div>
      <div class="card-title">Literal Schema on Status Field</div>
      <div class="card-desc">Replace str with Literal["investigating","contained","resolved","closed"]. 422 on invalid input.</div>
    </div>
    <div class="card ops">
      <div class="card-num">DEFECT 04 · OPERABILITY</div>
      <div class="card-title">Single-Worker Enforcement</div>
      <div class="card-desc">--workers 1 in Dockerfile CMD. Scaling constraints documented in ARCHITECTURE.md + DEPLOY.md. Regression test added.</div>
    </div>
    <div class="card test">
      <div class="card-num">DEFECT 05 · TESTING</div>
      <div class="card-title">Coverage Measurement + Floor</div>
      <div class="card-desc">pytest-cov added. --cov-fail-under=70 in CI. pyproject.toml configures pytest options. No suppressions.</div>
    </div>
  </div>

</div>

<script>
  function copyPrompt() {
    const body = document.getElementById('promptBody');
    const text = body.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyBtn');
      btn.classList.add('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"/></svg> Copy Prompt`;
      }, 2500);
    });
  }
</script>
</body>
</html>
