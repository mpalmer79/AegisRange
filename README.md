# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

## Status (Phases 1-3 Implemented)

The platform implements the full architecture defined in `ARCHITECTURE.md` with:

- FastAPI backend with modular service boundaries
- 10 deterministic detection rules across 5 categories
- 10 response playbooks with controlled containment actions
- 6 adversary simulation scenarios with end-to-end validation
- Multi-signal correlation detection for compound attack sequences
- Incident lifecycle management with full timeline traceability
- Next.js frontend dashboard for visualization and scenario execution
- 158 automated tests covering all detection, response, and scenario paths

## Implemented Modules

Within the monolith, boundaries are represented as services:

- **Identity Module**: authentication, session management, step-up enforcement
- **Document Module**: role-based document access and classification enforcement
- **Telemetry Module**: canonical event emission, normalization, and lookup
- **Detection Engine**: 10 deterministic rules across authentication, session, document, system, and correlation categories
- **Response Orchestrator**: 10 playbook actions including rate limiting, session revocation, download restriction, service disablement, artifact quarantine, and multi-signal containment
- **Incident Service**: incident creation, severity escalation, timeline assembly, lifecycle transitions
- **Scenario Engine**: 6 end-to-end adversary simulations

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

## API Endpoints

### Identity
- `POST /identity/login` — authenticate user
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

### Observability
- `GET /health` — health check
- `GET /events` — list/filter events
- `GET /alerts` — list/filter alerts
- `GET /incidents` — list all incidents
- `GET /incidents/{correlation_id}` — incident detail with timeline
- `PATCH /incidents/{correlation_id}/status` — incident lifecycle transition
- `GET /metrics` — system-wide metrics

### Admin
- `POST /admin/reset` — reset all state

## Run Locally

### Backend

```bash
cd backend
pip install fastapi uvicorn pydantic pytest httpx
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Run Tests

```bash
cd backend
python -m pytest tests/ -v
```

### Execute Scenario

```bash
curl -X POST http://localhost:8000/scenarios/scn-corr-006
```

Use the returned `correlation_id` to inspect incident state:

```bash
curl http://localhost:8000/incidents/<correlation_id>
```

## Architecture and Supporting Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md)
- [docs/events/EVENT_SCHEMA.md](docs/events/EVENT_SCHEMA.md)
- [docs/detection/DETECTION_RULES.md](docs/detection/DETECTION_RULES.md)
- [docs/response/RESPONSE_PLAYBOOK.md](docs/response/RESPONSE_PLAYBOOK.md)
- [docs/incidents/INCIDENT_MODEL.md](docs/incidents/INCIDENT_MODEL.md)
- [docs/scenarios/SCENARIOS.md](docs/scenarios/SCENARIOS.md)
