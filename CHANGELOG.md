# Changelog

All notable changes to AegisRange are documented in this file.

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
