# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

## Phase 1 Status (Implemented)

Phase 1 in `ARCHITECTURE.md` defines a modular monolith with an event-driven flow.

This repository now includes a first working backend slice under `backend/app` with:

- FastAPI entrypoint (`main.py`)
- telemetry normalization and event storage
- deterministic detection rules
- controlled response orchestration
- incident creation and timeline updates
- deterministic scenario execution for `SCN-AUTH-001`

## Implemented Modules

Within the monolith, boundaries are represented as services:

- **Identity Module**: basic authentication and session creation
- **Document Module**: document authorization checks by role/classification
- **Telemetry Module**: canonical event emission and lookup
- **Detection Engine**: deterministic rules (`DET-AUTH-001`, `DET-AUTH-002`, `DET-DOC-005`)
- **Response Orchestrator**: playbook actions (`PB-AUTH-001`, `PB-AUTH-002`, `PB-DOC-005`)
- **Incident Service**: incident creation, enrichment, and timeline entries
- **Scenario Engine**: `SCN-AUTH-001` end-to-end simulation

## API Endpoints (Phase 1)

- `GET /health`
- `POST /identity/login`
- `POST /documents/{document_id}/read`
- `POST /scenarios/scn-auth-001`
- `GET /incidents/{correlation_id}`
- `POST /admin/reset`

## Run Locally

```bash
cd backend
uvicorn app.main:app --reload
```

Then execute scenario:

```bash
curl -X POST http://localhost:8000/scenarios/scn-auth-001
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
