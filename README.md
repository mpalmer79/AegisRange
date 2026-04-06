# AegisRange

AegisRange is a defensive cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

## Phase 2 Backend Status

This repository currently provides a deterministic, event-driven Phase 2 backend slice aligned to `ARCHITECTURE.md`.

## Core Capabilities

- Event pipeline (`event -> detection -> response -> incident`)
- Correlation-aware telemetry ingest and lookup
- Deterministic detection rules (authentication, session, and document activity)
- Bounded, explainable response playbooks
- Incident assembly with timeline updates
- Scenario-driven validation:
  - `SCN-AUTH-001`
  - `SCN-SESSION-002`
  - `SCN-DOC-003`

## Practical Runtime Behaviors

- Alert and response deduplication prevents repeated containment actions on equivalent signals.
- Authentication burst detection supports same-actor and same-source patterns.
- Suspicious login success correlation requires source-context continuity.
- Scenario discovery endpoint lists executable scenario IDs and routes.

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

Validation commands:

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
