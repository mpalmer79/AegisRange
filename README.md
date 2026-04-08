# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

Built as a portfolio-grade demonstration of detection engineering, incident response orchestration, and security telemetry architecture.

---

## Current Implemented Baseline

**Version:** 0.6.0
**Tests:** 281 automated tests across 19 test files
**Backend:** FastAPI modular monolith with 15 services and 38 API endpoints
**Frontend:** Next.js 14 App Router with 12 pages (including login)
**Persistence:** In-memory with SQLite write-through backing (survives restart)
**Authentication:** JWT auth (HMAC-SHA256) enforced on all 35 protected routes with RBAC

### What Works End-to-End

1. Execute any of 6 adversary simulation scenarios
2. Telemetry events are generated and normalized
3. 10 detection rules evaluate events in real time
4. Alerts are created with severity and confidence scoring
5. 10 response playbooks execute containment actions
6. Incidents are created with full timeline traceability
7. MITRE ATT&CK TTP mappings enrich alerts and scenarios
8. Kill chain stage tracking maps detections to Lockheed Martin phases
9. Cross-incident correlation detects multi-stage campaigns
10. Exercise reports summarize detection coverage and response effectiveness
11. Risk scoring profiles threat actors based on accumulated behavior
12. SSE streaming provides real-time event delivery

### Infrastructure

- **JWT Authentication**: All 35 protected routes enforce `require_role()` with RBAC. 5 roles: admin, soc_manager, analyst, red_team, viewer. Public endpoints: `/health`, `/auth/login`.
- **Frontend Auth**: Login page, AuthProvider context, AuthGuard redirect, automatic token attachment on all API calls, localStorage persistence with expiry.
- **SQLite Persistence**: Write-through cache — in-memory store is primary for reads, SQLite saves after every mutating request via middleware, loads on startup.

---

## Implemented Modules

### Backend Services (15)

| Service | Responsibility |
|---------|---------------|
| Identity | Simulated user authentication and session management |
| Document | Role-based document access and classification enforcement |
| Telemetry | Event emission, normalization, storage, and lookup |
| Detection | 10 deterministic rules across 5 categories |
| Response | 10 playbook actions including containment and restriction |
| Incident | Incident creation, escalation, timeline assembly, lifecycle |
| Pipeline | Event-to-detection-to-response-to-incident orchestration |
| Scenario | 6 end-to-end adversary simulations |
| Risk | Actor risk scoring with severity weights and confidence multipliers |
| MITRE | ATT&CK TTP mapping across 8 tactics with coverage matrix |
| Kill Chain | Lockheed Martin 7-stage tracking per incident |
| Campaign | Cross-incident correlation and campaign detection |
| Auth | JWT token management, RBAC enforcement on all protected routes |
| Report | Exercise report generation with detection coverage analysis |
| Stream | SSE real-time event delivery with subscriber management |

### Frontend Pages (12)

| Page | Description |
|------|-------------|
| Login | JWT authentication with username/password |
| Dashboard | System metrics overview |
| Scenarios | Execute and review adversary simulations |
| Events | Browse and filter telemetry events |
| Alerts | View detection alerts with severity/confidence |
| Analytics | Risk profiles, rule effectiveness, scenario history |
| Incidents | Incident list with status and severity |
| Incident Detail | Timeline, notes, status transitions for a specific incident |
| ATT&CK Matrix | MITRE technique coverage visualization |
| Kill Chain | Kill chain stage progression per incident |
| Campaigns | Cross-incident campaign correlation |
| Reports | Generate and view exercise reports |

---

## Detection Rules

| Rule ID | Name | Category | Severity |
|---------|------|----------|----------|
| DET-AUTH-001 | Repeated Authentication Failure Burst | authentication | medium |
| DET-AUTH-002 | Suspicious Success After Failure Sequence | authentication | high |
| DET-SESSION-003 | Token Reuse From Conflicting Origins | session | high |
| DET-DOC-004 | Restricted Document Access Outside Role Scope | document | high |
| DET-DOC-005 | Abnormal Bulk Document Access | document | high |
| DET-DOC-006 | Read-To-Download Staging Pattern | document | critical |
| DET-SVC-007 | Unauthorized Service Identity Route Access | system | high |
| DET-ART-008 | Artifact Validation Failure Pattern | system | medium |
| DET-POL-009 | Privileged Policy Change With Elevated Risk | system | critical |
| DET-CORR-010 | Multi-Signal Compromise Sequence | correlation | critical |

## Scenarios

| Scenario ID | Name | Detections Triggered |
|-------------|------|---------------------|
| SCN-AUTH-001 | Credential Abuse With Suspicious Success | DET-AUTH-001, DET-AUTH-002 |
| SCN-SESSION-002 | Session Token Reuse Attack | DET-SESSION-003 |
| SCN-DOC-003 | Bulk Document Access | DET-DOC-005 |
| SCN-DOC-004 | Read-To-Download Exfiltration Pattern | DET-DOC-006 |
| SCN-SVC-005 | Unauthorized Service Access | DET-SVC-007 |
| SCN-CORR-006 | Multi-Signal Compromise Sequence | DET-AUTH-001, DET-AUTH-002, DET-DOC-005, DET-DOC-006, DET-CORR-010 |

---

## API Endpoints

### Identity
- `POST /identity/login` — authenticate simulated user
- `POST /identity/sessions/{session_id}/revoke` — revoke session

### Documents
- `POST /documents/{document_id}/read` — read document with access control
- `POST /documents/{document_id}/download` — download document with restriction enforcement

### Scenarios
- `POST /scenarios/scn-auth-001` — credential abuse simulation
- `POST /scenarios/scn-session-002` — session token reuse simulation
- `POST /scenarios/scn-doc-003` — bulk document access simulation
- `POST /scenarios/scn-doc-004` — read-to-download exfiltration simulation
- `POST /scenarios/scn-svc-005` — unauthorized service access simulation
- `POST /scenarios/scn-corr-006` — multi-signal compromise simulation

### Telemetry and Observability
- `GET /health` — health check
- `GET /events` — list/filter events
- `GET /events/export` — export events
- `GET /alerts` — list/filter alerts
- `GET /metrics` — system-wide metrics
- `GET /stream/events` — SSE real-time event stream

### Incidents
- `GET /incidents` — list all incidents
- `GET /incidents/{correlation_id}` — incident detail with timeline
- `PATCH /incidents/{correlation_id}/status` — incident lifecycle transition
- `POST /incidents/{correlation_id}/notes` — add incident note
- `GET /incidents/{correlation_id}/notes` — get incident notes

### Analytics
- `GET /analytics/risk-profiles` — all actor risk profiles
- `GET /analytics/risk-profiles/{actor_id}` — single actor risk profile
- `GET /analytics/rule-effectiveness` — detection rule effectiveness metrics
- `GET /analytics/scenario-history` — scenario execution history

### MITRE ATT&CK
- `GET /mitre/mappings` — all rule-to-TTP mappings
- `GET /mitre/mappings/{rule_id}` — mapping for a specific rule
- `GET /mitre/coverage` — technique coverage matrix
- `GET /mitre/tactics/coverage` — tactic-level coverage percentages
- `GET /mitre/scenarios/{scenario_id}/ttps` — TTPs for a scenario

### Kill Chain
- `GET /killchain` — kill chain summary across all incidents
- `GET /killchain/{correlation_id}` — kill chain stages for a specific incident

### Campaigns
- `GET /campaigns` — detected campaigns from cross-incident correlation
- `GET /campaigns/{campaign_id}` — campaign detail

### Reports
- `POST /reports/generate` — generate exercise report

### Auth
- `POST /auth/login` — JWT login (public)
- `GET /auth/users` — list platform users (admin only)

### Admin
- `POST /admin/reset` — reset all in-memory state

---

## Run Locally

### Backend

```bash
cd backend
pip install fastapi uvicorn pydantic pytest httpx pyjwt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker-compose up --build
```

### Run Tests

```bash
cd backend
python -m pytest tests/ -v
```

### Execute a Scenario

```bash
curl -X POST http://localhost:8000/scenarios/scn-corr-006
```

Use the returned `correlation_id` to inspect incident state:

```bash
curl http://localhost:8000/incidents/<correlation_id>
```

---

## Known Limitations

- **SQLite persistence**: Write-through cache to SQLite. Suitable for single-instance deployment. Not designed for concurrent multi-process writes.
- **No input validation on query parameters**: `since_minutes` and similar query params accept unbounded values without range constraints.
- **No rate limiting**: No request throttling on any endpoint.
- **No TLS**: Backend serves plain HTTP. TLS termination expected at reverse proxy layer.
- **No multi-tenancy**: Single-instance, single-tenant only.
- **Dead frontend code**: Several API functions (`readDocument`, `downloadDocument`, `exportEvents`, `getCampaign`, `resetSystem`) and types (`LoginRequest`, `LoginResponse`, `DocumentRequest`) are defined but never called from any page.
- **Inconsistent frontend error handling**: Pages use 3 different data-fetching patterns (`Promise.allSettled`, `try/catch` in `useCallback`, simple `useEffect`). No retry-on-failure UI.
- **Limited accessibility**: No ARIA labels, no semantic form associations, SVG icons lack `aria-hidden`.

---

## Completed Hardening Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Architecture truth audit | Done |
| 1 | Documentation realignment | Done |
| 2 | Frontend/backend contract reconciliation | Done |
| 3 | SQLite persistence layer | Done |
| 4 | Auth boundary hardening (JWT on all routes + frontend login) | Done |
| 5 | Architectural consistency pass | Done |
| 6 | Validation, gap analysis, roadmap | Done |

---

## Forward Roadmap

Prioritized by impact. Items are designed but not yet built.

### Next (High Impact)

1. **Remove dead frontend code** — Delete unused API functions, types, and imports to reduce bundle size and cognitive overhead.
2. **Input validation hardening** — Add `ge=0, le=1440` constraints to `since_minutes` and similar query parameters. Validate enum values for incident status transitions.
3. **Standardize frontend data-fetching** — Pick one pattern (recommend `useCallback` + error state) and apply consistently across all 12 pages. Add retry buttons on error states.
4. **Add type annotations** — Missing return types on `stream_service.event_generator`, `require_role` decorator, and `correlation_middleware`.

### Later (Medium Impact)

5. **Test coverage expansion** — Add tests for: SSE streaming endpoint, document read/download endpoints, incident detail GET, incident status transitions, incident notes CRUD.
6. **Frontend accessibility** — Add `aria-label` to interactive elements and SVG icons, link form labels with `htmlFor`, add `aria-hidden` to decorative icons.
7. **Rate limiting** — Add configurable rate limiting to `/metrics`, `/alerts`, `/events/export`, and auth endpoints.
8. **PostgreSQL option** — Abstract persistence layer behind an interface to support PostgreSQL alongside SQLite.

### Future (Architecture Evolution)

9. **Streaming pipeline** — Replace synchronous event-to-incident flow with async message queue.
10. **Advanced correlation engine** — Temporal pattern matching across longer time windows.
11. **Policy engine** — Externalized detection and response policies.
12. **Multi-tenant support** — Tenant isolation at data and API layers.

---

## Architecture and Supporting Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, module boundaries, data flow
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md) — Target deployment topology and infrastructure
- [docs/events/EVENT_SCHEMA.md](docs/events/EVENT_SCHEMA.md) — Event schema specification
- [docs/detection/DETECTION_RULES.md](docs/detection/DETECTION_RULES.md) — Detection rule definitions
- [docs/response/RESPONSE_PLAYBOOK.md](docs/response/RESPONSE_PLAYBOOK.md) — Response playbook definitions
- [docs/incidents/INCIDENT_MODEL.md](docs/incidents/INCIDENT_MODEL.md) — Incident lifecycle model
- [docs/scenarios/SCENARIOS.md](docs/scenarios/SCENARIOS.md) — Scenario specifications
