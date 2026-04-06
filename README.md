# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

## Phase 2 (Conflict-Resolved) Status

This branch resolves merge conflicts in the Phase 2 backend files and keeps the architecture aligned with `ARCHITECTURE.md` by preserving deterministic, event-driven behavior.

## Key Backend Capabilities

- Event-driven flow through a pipeline service (`event -> detection -> response -> incident`)
- Correlation-aware telemetry ingestion and lookup
- Deterministic detection rules (auth/session/document)
- Bounded response playbooks (rate limit, step-up auth, session revoke, access restrictions)
- Incident assembly with timeline updates
- Deterministic scenario engine for:
  - `SCN-AUTH-001`
  - `SCN-SESSION-002`
  - `SCN-DOC-003`

## Improvements Included in Conflict Resolution

- Added response and alert deduplication state in the in-memory store.
- Updated auth-burst detection to honor `same actor OR same source_ip` behavior.
- Tightened suspicious-success detection to require same source context as recent failures.
- Added `/scenarios` endpoint for discoverability.
- Added app version in `/health` output.

## API Endpoints

- `GET /health`
- `GET /scenarios`
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

Run validations:

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
python -m compileall backend/app backend/tests
```

## Architecture and Supporting Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md)
- [docs/events/EVENT_SCHEMA.md](docs/events/EVENT_SCHEMA.md)
- [docs/detection/DETECTION_RULES.md](docs/detection/DETECTION_RULES.md)
- [docs/response/RESPONSE_PLAYBOOK.md](docs/response/RESPONSE_PLAYBOOK.md)
- [docs/incidents/INCIDENT_MODEL.md](docs/incidents/INCIDENT_MODEL.md)
- [docs/scenarios/SCENARIOS.md](docs/scenarios/SCENARIOS.md)
