# AegisRange

AegisRange is a defensive security simulation and validation platform focused on explainable detection, response, and incident modeling.

It is designed to model how a modern security operations workflow should behave under real conditions, while keeping every decision auditable and understandable.

---

## What This System Does

- Simulates realistic security-relevant activity
- Normalizes activity into structured telemetry
- Applies deterministic detection logic
- Executes controlled response actions
- Builds auditable incident records

This is not a full SIEM or SOAR platform. It is a focused system for validating detection and response behavior with clarity and traceability.

---

## System Workflow

The platform models a complete defensive pipeline:

1. **Scenario execution** — pre-built attack narratives that emit structured telemetry events
2. **Detection engine** — deterministic rules evaluate events and generate alerts
3. **Response pipeline** — automated playbooks apply containment actions
4. **Incident management** — correlated events, alerts, and responses are grouped into incidents
5. **Risk scoring** — actor-level risk profiles built from contributing detections
6. **MITRE ATT&CK mapping** — detection rules mapped to techniques and tactics
7. **Kill chain analysis** — incident progression tracked across Lockheed Martin kill chain stages
8. **Campaign correlation** — related incidents grouped by shared actors and TTPs

---

## Architecture

| Layer     | Stack                | Description |
|-----------|----------------------|-------------|
| Backend   | Python 3.11 / FastAPI | REST API, detection engine, persistence (SQLite) |
| Frontend  | Next.js 14 / React   | Dashboard, incident viewer, analytics |

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation and [DEPLOY.md](DEPLOY.md) for deployment instructions.

---

## Quick Start (Development)

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

The frontend runs at `http://localhost:3000` and proxies API requests to the backend at `http://localhost:8000`.

### Running Tests

```bash
# Backend (475+ tests, 95% coverage)
cd backend
pytest tests/

# With coverage report
pytest tests/ --cov=app --cov-report=term-missing

# Frontend type check
cd frontend
npx tsc --noEmit
```

---

## Project Structure

```
AegisRange/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, lifespan
│   │   ├── config.py            # Environment configuration
│   │   ├── models.py            # Domain models (Event, Alert, Incident, etc.)
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── serializers.py       # Model → dict serialization
│   │   ├── store.py             # In-memory data store with SQLite backing
│   │   ├── persistence.py       # SQLite persistence layer
│   │   ├── routers/             # FastAPI route handlers
│   │   └── services/            # Business logic (detection, response, etc.)
│   ├── tests/                   # pytest test suite
│   └── Dockerfile
├── frontend/
│   ├── app/                     # Next.js pages and components
│   ├── lib/                     # API client, mock data, types
│   └── Dockerfile
├── ARCHITECTURE.md
├── DEPLOY.md
└── README.md
```

---

## License

See repository for license details.