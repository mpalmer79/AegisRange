# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

Built as a portfolio-grade demonstration of detection engineering, incident response orchestration, and security telemetry architecture.

---

## Current Implemented Baseline

**Version:** 0.6.0
**Tests:** 352 automated tests across 19 test files
**Backend:** FastAPI modular monolith with 15 services and 38 API endpoints
**Frontend:** Next.js 14 App Router with 12 pages (including login)
**Persistence:** In-memory primary store with hybrid SQLite persistence (incremental entity writes + operational state snapshots)
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
- **Hybrid Persistence**: In-memory store is primary at runtime. Entities (events, alerts, responses, incidents, notes, scenario history) are persisted incrementally to SQLite as they are created. Operational state (containment sets, risk profiles) is snapshot-persisted after each mutating request. On startup, all authoritative state loads from SQLite; derived state (event indices, alert deduplication) is rebuilt deterministically; ephemeral state (simulated sessions) resets.

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
- `GET /health` — health check (public)
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

All protected endpoints require a JWT token. First authenticate:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

Then execute a scenario:

```bash
curl -X POST http://localhost:8000/scenarios/scn-corr-006 \
  -H "Authorization: Bearer $TOKEN"
```

Use the returned `correlation_id` to inspect incident state:

```bash
curl http://localhost:8000/incidents/<correlation_id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Known Limitations

### Architecture
- **Single-worker only**: The backend runs as a single Uvicorn process. The in-memory store is a Python-process-level singleton. Running multiple workers would create independent, unsynchronized store instances.
- **Not horizontally scalable**: The in-memory primary store cannot be shared across processes or hosts.
- **No concurrency guarantees**: No locking on the in-memory store. Concurrent requests that mutate the same data can race. Acceptable for single-worker operation.

### Persistence
- **SQLite limitations**: Write-through to a single SQLite file. Not suitable for concurrent multi-process writes.
- **Hybrid persistence model**: Entities persist incrementally; operational state persists via snapshot. A crash between an entity write and the next operational state snapshot can cause operational state to lag behind entity state. The system recovers correctly by rebuilding derived state on load, but authoritative operational state (containment sets) may revert to the last snapshot.
- **No WAL checkpointing control**: SQLite WAL mode is enabled but checkpoint timing is not managed.

### Security
- **Hardcoded JWT secret**: The signing key in `auth_service.py` is a static string. Acceptable for demo; must be externalized for any real deployment.
- **No TLS**: Backend serves plain HTTP. TLS termination expected at reverse proxy layer.
- **No rate limiting**: No request throttling on any endpoint.
- **No input validation on query parameters**: `since_minutes` and similar query params accept unbounded values.

### Frontend
- **Dead frontend code**: Several API functions (`readDocument`, `downloadDocument`, `exportEvents`, `getCampaign`, `resetSystem`) and types (`LoginRequest`, `LoginResponse`, `DocumentRequest`) are defined but never called from any page.
- **Inconsistent error handling**: Pages use 3 different data-fetching patterns. No retry-on-failure UI.
- **Limited accessibility**: No ARIA labels, no semantic form associations, SVG icons lack `aria-hidden`.

### Identity Model
- **No multi-tenancy**: Single-instance, single-tenant only.
- **Two separate identity systems**: Platform users (JWT auth) and simulated actors (scenario identity service) are independent. Platform user tokens do not map to simulated actor identities.

---

## Architecture and Supporting Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, module boundaries, data flow, persistence model
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md) — Deployment topology and infrastructure
- [docs/events/EVENT_SCHEMA.md](docs/events/EVENT_SCHEMA.md) — Event schema specification
- [docs/detection/DETECTION_RULES.md](docs/detection/DETECTION_RULES.md) — Detection rule definitions
- [docs/response/RESPONSE_PLAYBOOK.md](docs/response/RESPONSE_PLAYBOOK.md) — Response playbook definitions
- [docs/incidents/INCIDENT_MODEL.md](docs/incidents/INCIDENT_MODEL.md) — Incident lifecycle model
- [docs/scenarios/SCENARIOS.md](docs/scenarios/SCENARIOS.md) — Scenario specifications
