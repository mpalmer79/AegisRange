# Changelog

All notable changes to AegisRange are documented in this file.

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
