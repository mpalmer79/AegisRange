# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

## Phase 2 Status (Implemented)

Phase 1 delivered a modular monolith backend slice. This update implements the **next phase** of the backend by expanding detection/response coverage, introducing an event-processing pipeline service, and adding more scenario validation.

## What Changed in This Phase

- Introduced `EventPipelineService` so primary events produce deterministic downstream artifacts:
  - detection events (`detection.rule.triggered`)
  - response events (`response.<action>.executed`)
  - incident updates
- Expanded rule and playbook support:
  - `DET-AUTH-001`, `DET-AUTH-002`
  - `DET-SESSION-003`
  - `DET-DOC-004`, `DET-DOC-005`
  - `PB-AUTH-001`, `PB-AUTH-002`, `PB-SESSION-003`, `PB-DOC-004`, `PB-DOC-005`
- Added a dedicated scenario engine with deterministic scenario runs:
  - `SCN-AUTH-001`
  - `SCN-SESSION-002`
  - `SCN-DOC-003`
- Added telemetry inspection endpoint and session authorization endpoint.

## API Endpoints

- `GET /health`
- `POST /identity/login`
- `POST /documents/{document_id}/read`
- `POST /session/authorize`
- `POST /scenarios/scn-auth-001`
- `POST /scenarios/scn-session-002`
- `POST /scenarios/scn-doc-003`
- `GET /telemetry/events`
- `GET /incidents/{correlation_id}`
- `POST /admin/reset`

## Run Locally

```bash
cd backend
uvicorn app.main:app --reload
```

Run scenarios:

```bash
curl -X POST http://localhost:8000/scenarios/scn-auth-001
curl -X POST http://localhost:8000/scenarios/scn-session-002
curl -X POST http://localhost:8000/scenarios/scn-doc-003
```

Inspect telemetry for a correlation ID:

```bash
curl "http://localhost:8000/telemetry/events?correlation_id=<correlation_id>"
```

## Architecture and Supporting Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md)
- [docs/events/EVENT_SCHEMA.md](docs/events/EVENT_SCHEMA.md)
- [docs/detection/DETECTION_RULES.md](docs/detection/DETECTION_RULES.md)
- [docs/response/RESPONSE_PLAYBOOK.md](docs/response/RESPONSE_PLAYBOOK.md)
- [docs/incidents/INCIDENT_MODEL.md](docs/incidents/INCIDENT_MODEL.md)
- [docs/scenarios/SCENARIOS.md](docs/scenarios/SCENARIOS.md)
