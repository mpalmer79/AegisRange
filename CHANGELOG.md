# Changelog

All notable changes to AegisRange are documented in this file.

## [0.10.0]

### Added
- **AuthCache abstraction** (`app/services/auth_cache.py`) — ships SCALING.md Phase 1. Defines the `AuthCache` protocol for ephemeral auth state (JTI revocations + TOTP secrets/enrollment) and two implementations: `InMemoryAuthCache` (default; shares references with the store's legacy dicts so existing direct-attribute reads stay consistent) and `RedisAuthCache` (opt-in via `REDIS_URL`; JTI revocations use native Redis TTL so pruning is automatic). A `build_auth_cache()` factory chooses the backend and falls back to in-memory if Redis is unreachable.
- `InMemoryStore` delegates `revoke_jti`, `is_jti_revoked`, `prune_expired_revocations` through the configured auth cache, and exposes the cache via `STORE.auth_cache`.
- `PersistenceLayer.load()` routes JTI + TOTP restore through `auth_cache.load_*` so the abstraction remains coherent across SQLite round-trips.
- `REDIS_URL` config key (reads from env; empty string means "use in-memory"). Documented in `DEPLOY.md`.
- `tests/test_auth_cache.py` — 18 contract tests against the in-memory cache plus an opt-in Redis suite that activates when `AEGISRANGE_TEST_REDIS_URL` is set.
- **Three new detection rules** in `app/services/detection/rules.py`:
  - **DET-GEO-011 — Impossible Travel Between Authentications** (HIGH / HIGH, critical): two successful authentications from distinct `geo_region` payload values within 60 minutes. MITRE T1078 / TA0001.
  - **DET-EXFIL-012 — Large-Volume Data Exfiltration** (CRITICAL / HIGH, critical): cumulative `bytes_downloaded` by a single actor exceeds 500 MB within 10 minutes. MITRE T1048, T1567 / TA0010.
  - **DET-HOUR-013 — Off-Hours Privileged Action** (MEDIUM / MEDIUM): admin-role privileged write (policy change, admin config, service disable) between 22:00–06:00 UTC. MITRE T1098 / TA0003.
- **Two new scenarios** exercising the new rules end-to-end:
  - **SCN-GEO-007** — impossible-travel authentication (fires DET-GEO-011).
  - **SCN-EXFIL-008** — twelve 50 MB downloads in rapid succession (fires DET-EXFIL-012).
- Scenario engine (`run_geo_007`, `run_exfil_008`) + adversary scripts (`_script_geo_007`, `_script_exfil_008`) + `POST /scenarios/scn-geo-007` / `POST /scenarios/scn-exfil-008` routes.
- Adversary beat handlers extended with optional `geo_region` (on successful-login beats) and `bytes_downloaded` (on download beats) payload fields — additive, backwards-compatible.
- Unit tests for each of the three new rules (`TestDETGEO011`, `TestDETEXFIL012`, `TestDETHOUR013`) plus end-to-end scenario tests (`TestSCNGEO007`, `TestSCNEXFIL008`).

## [0.9.0]

### Changed
- CSRF middleware: `/scenarios/*` prefix is no longer exempt. Cookie-authenticated scenario execution now requires a matching `X-CSRF-Token` header, closing a silent hole where any future POST/PATCH/DELETE under `/scenarios/*` would have been unprotected against cross-origin cookie-driven calls.
- Every remaining entry in `_CSRF_EXEMPT_PATHS` / `_CSRF_EXEMPT_PREFIXES` now carries an inline comment naming why it is exempt.
- `services/auth_service.py` (791 lines) split into the `services/auth/` package: `passwords.py`, `roles.py`, `correlation.py`, `service.py`. Original path is now a re-export shim — every existing import of `from app.services.auth_service import ...` continues to work.
- `services/detection_rules.py` (641 lines) split into the `services/detection/` package: `base.py`, `rules.py`, `metrics.py`. Original path is now a re-export shim.
- `services/adversary_scripts.py` (711 lines) split into the `services/adversary/` package: `base.py`, `handlers.py`, `scripts.py`. Original path is now a re-export shim.
- `services/mission_service.py` (662 lines) split into the `services/mission/` package: `run.py`, `store.py`, `service.py`. Original path is now a re-export shim.
- `InMemoryStore` now exposes a public `get_persistence()` accessor. `main.py` and `routers/health.py` no longer reach into `STORE._persistence` directly.
- The canonical auth service singleton is now `auth_service` (no leading underscore). All in-tree callers (`main.py`, `dependencies.py`, `routers/scenarios.py`, `routers/missions.py`, `services/auth/roles.py`) updated to use the new name.

### Removed
- Frontend `ROLE_LEVELS` and `SCENARIO_MIN_LEVEL` hardcoded constants deleted from `frontend/lib/auth-context.tsx`. The role ladder is no longer mirrored on the frontend — capability flags come from `/auth/me`. This closes the drift risk where adding a role on one side silently left the other side out of date.

### Infrastructure
- `backend/pyproject.toml` gained a `[tool.ruff.lint.pylint]` section with `max-branches = 14` and `max-statements = 60`. These are the shape signals that catch the next service monolith before it gets big — a new service that breaches either threshold is a signal to split it, not to raise the limit.
- New top-level `Makefile` with `make check`, `make check-backend`, `make check-frontend`, `make lint`, `make type`, `make test`, `make install` targets. `make check` runs the same gates CI runs, so a clean local run means the push is likely green.
- New `npm run check:all` script in `frontend/package.json` wrapping `lint` + `typecheck` + `test`. Complements `make check-frontend`.
- New `npm run typecheck` script (just `tsc --noEmit`).

### Deprecated
- `app.services.auth_service._auth_service` is now a deprecated alias for `auth_service`. Existing imports continue to work for backwards compatibility; the alias will be removed in 0.10.0.

### Added
- `backend/tests/test_security_hardening.py`: new cases pinning the CSRF model — cookie-authed POSTs to each `/scenarios/*` route are rejected without a token, accepted with a matching token, `/missions/*` remains capability-exempt, and Bearer-authed requests bypass CSRF regardless of path.
- Default simulation passwords can now be overridden at startup via `DEFAULT_PASSWORD_<USERNAME>` env vars (e.g. `DEFAULT_PASSWORD_ADMIN=…`). The source defaults remain the dev fallback; no hardcoded password was removed.
- Production startup emits a `WARNING` listing any simulation user still seeded with the source default (so demo deployments can see at a glance which credentials are publicly known).
- Test cases in `test_auth_hardening.py` pinning the env-override resolution and the `using_source_default` helper.
- `GET /auth/me` now returns `level` (numeric role level), `scopes`, and `capabilities` in addition to `username`/`role`/`display_name`. The capability list is derived on the backend from `CAPABILITY_MIN_LEVEL` (`app/services/auth/capabilities.py`), so adding a new capability on the backend flows to the frontend on next login with no frontend change.
- `AuthContext` exposes `level`, `scopes`, and `capabilities` alongside `username`/`role`. The `canRunScenarios` helper now reads from `user.capabilities` instead of a hardcoded role ladder, and sibling helpers `canManageIncidents` / `canAdministerPlatform` were added.
- `CurrentUser` TypeScript interface (`frontend/lib/types.ts`) gained `level`, `scopes`, and `capabilities` fields.
- Backend test cases in `test_auth_identity.py::TestAuthMeCapabilities` pin the new `/auth/me` contract.
- Frontend test cases in `__tests__/lib/auth-context.test.tsx::canRunScenarios` pin the capability-based gate.

### Documentation
- `docs/threat-model/CSRF_MODEL.md`: new threat-model document describing the three trust surfaces (cookie / capability / bearer) and the rule that must be answered before any new route is added to the CSRF exempt list. Linked from ARCHITECTURE.md §15.
- `docs/operations/SCALING.md`: new design document for horizontal scalability. Chooses Postgres (authoritative) + Redis (ephemeral cache) as the target and lays out a five-phase migration plan for 0.10.0 – 0.12.0. No code changes in 0.9.0. Linked from ARCHITECTURE.md §14.
- `DEPLOY.md`: documented the `DEFAULT_PASSWORD_<USERNAME>` env override for production demos.

### Deferred
- Section 4 of the 0.9.0 playbook (splitting `frontend/lib/mock-data.ts` and `frontend/lib/api.ts` into packages) was attempted but not completed in this release — the refactor requires careful line-by-line extraction of ~5,400 lines across the two files and is deferred to 0.10.0 to avoid a half-landed split.

## [0.8.0] — 2026-04-14

### Added
- Account lockout per NIST 800-53 AC-7 with two-step logic: observation window (`LOCKOUT_WINDOW_SECONDS`) and lockout duration (`LOCKOUT_DURATION_SECONDS`)
- Password complexity enforcement via Pydantic `@field_validator` on `LoginRequest` (min 12 chars, uppercase, lowercase, digit, special character)
- `SKIP_PASSWORD_COMPLEXITY` config flag (auto-true in development, false in production)
- JWT key rotation: `kid` header in all tokens, `JWT_KEY_ID` config, previous-key fallback via `JWT_SECRET_PREVIOUS`
- MFA/TOTP foundation: `TOTPService` (RFC 6238, stdlib-only), `/auth/mfa/enroll`, `/auth/mfa/verify`, `/auth/mfa/disable` endpoints
- `MFA_REQUIRED_ROLES` config for per-role MFA enforcement
- `authenticate()` returns 4-tuple `(success, token, expires_at, mfa_status)` to support MFA intermediate state
- TOTP state persistence: `totp_secrets` and `totp_enabled` stored in SQLite via `state_dicts`/`state_sets`
- `docs/operations/KEY_ROTATION.md` — operational guide for zero-downtime JWT key rotation
- Comprehensive test suites: `test_auth_hardening.py` (lockout, complexity, key rotation), `test_totp.py` (TOTP service, MFA endpoints, login flow, persistence)

### Changed
- Default user passwords upgraded to meet complexity requirements (12+ chars, mixed case, digits, special)
- Simulation identity passwords (`identity_service.py`, `scenario_service.py`) upgraded to complex passwords
- All test files updated with new password strings and 4-tuple `authenticate()` unpacking
- `LoginRequest.password` field: `min_length` increased from 1 to 12, `max_length` set to 128
- `.env.example` updated with new config keys: `JWT_KEY_ID`, `LOCKOUT_WINDOW_SECONDS`, `LOCKOUT_DURATION_SECONDS`, `SKIP_PASSWORD_COMPLEXITY`, `MFA_REQUIRED_ROLES`
- ARCHITECTURE.md updated with Phase 1 authentication hardening details

### Removed
- Old config keys: `LOCKOUT_DURATION_MINUTES`, `PASSWORD_MIN_LENGTH`, `PASSWORD_REQUIRE_*`

## [0.7.0] — 2025-06-01

### Added
- Store encapsulation: all services access state through typed accessor methods
- Event indexing: secondary indices on actor_id, correlation_id, event_type for O(1) lookups
- JTI revocation pruning: TTL-based cleanup prevents unbounded memory growth
- Request latency logging middleware with correlation ID tracking
- API pagination on events and alerts endpoints
- Enriched health endpoint with subsystem checks and entity counts
- Pydantic response models on all API endpoints with OpenAPI schema generation
- Request schema field validation with length and format constraints
- Frontend component decomposition: 45+ extracted components, no page over 200 lines
- `useApi` data fetching hook replacing manual useEffect/useState patterns
- Error boundary and loading skeleton components
- Next.js error.tsx and not-found.tsx convention pages
- Frontend test infrastructure (Jest + React Testing Library) with CI integration
- Backend conftest.py with shared fixtures and autouse store reset
- CONTRIBUTING.md developer guide
- Bandit security scanning in CI
- OpenAPI description and router-level response documentation

### Changed
- CORS restricted from wildcard to explicit methods and headers
- Coverage threshold raised from 0% to 80%
- Test files consolidated from phase-numbered names to domain-based names

### Fixed
- `risk_profiles` type annotation corrected from `object` to `RiskProfile`
- Eliminated all direct store attribute access from service layer

## [0.6.0]

### Added
- SQLite persistence layer with WAL mode and incremental entity writes
- Transaction support for pipeline processing
- Persistence round-trip tests (1,700+ lines)
- Derived state rebuild on load

## [0.5.0]

### Added
- MITRE ATT&CK technique mapping for all detection rules
- Kill chain stage attribution
- Campaign detection and cross-incident correlation
- Exercise report generation
- Server-Sent Events (SSE) streaming for real-time updates

## [0.4.0]

### Added
- JWT authentication with PBKDF2-HMAC-SHA256 password hashing
- Role-based access control (admin, soc_manager, analyst, red_team, viewer)
- httpOnly cookie token delivery
- Rate limiting on authentication endpoints
- Token revocation (JTI deny-list)

## [0.3.0]

### Added
- Risk scoring service with severity/confidence weighting
- Incident lifecycle management (open → investigating → contained → resolved → closed)
- Incident notes and timeline entries
- Analytics endpoints (risk profiles, rule effectiveness, scenario history)

## [0.2.0]

### Added
- 10 deterministic detection rules (DET-AUTH-001 through DET-CORR-010)
- 10 response playbooks (PB-AUTH-001 through PB-CORR-010)
- Event pipeline orchestration (event → detection → response → incident)
- Alert deduplication via signature tracking
- 7 adversary simulation scenarios

## [0.1.0]

### Added
- Event model with canonical schema and validation
- Telemetry service with event normalization
- In-memory store with domain model (Event, Alert, Incident, ResponseAction)
- FastAPI application skeleton with router structure
- Next.js frontend with dashboard, scenarios, events, alerts, incidents views
- Docker Compose and Railway deployment configuration
- CI pipeline (Ruff, pytest, ESLint, TypeScript, Docker build)
