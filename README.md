# AegisRange

**Defensive security simulation and validation platform.**

AegisRange models a complete security operations workflow — from telemetry ingestion through deterministic detection, automated response, and auditable incident management. It answers four questions about every security event: what happened, why it mattered, what the system did about it, and how an analyst can verify the decision trail.

This is not a SIEM, SOAR, or exploitation tool. It's a cyber range built to make defensive security workflows **explainable, testable, and auditable**.

---

## How It Works

Every action in AegisRange flows through a strict domain pipeline:

```
Scenario → Event → Detection → Response → Incident
```

**Scenarios** simulate adversary behavior — credential abuse, session hijacking, data exfiltration, privilege escalation — and emit normalized **events** into the telemetry pipeline. Ten deterministic **detection rules** evaluate those events against explicit thresholds and time windows, producing alerts with severity, confidence, and full contributing-event attribution. Each alert triggers a bounded **response playbook** (session revocation, download restriction, step-up authentication), and the system assembles everything into a durable **incident** with a reconstructable timeline.

Nothing is opaque. Every alert traces back to the events that caused it. Every response traces back to the alert that triggered it. Every incident traces back to every detection and response in its lifecycle.

---

## Architecture

AegisRange runs as a modular monolith with explicit service boundaries.

```
Next.js Frontend → FastAPI Backend → InMemoryStore → SQLite
```

The backend is organized around 15 domain services — each owning a single responsibility and communicating through an orchestrated pipeline rather than shared mutable state. The in-memory store handles runtime operations while SQLite provides durable persistence, with entity writes (events, alerts, incidents) persisted incrementally and operational state (containment sets, risk profiles) persisted via snapshots. All writes within a single pipeline execution are grouped in a SQLite transaction.

The architecture is deliberately optimized for correctness and traceability within a single-process model. Constraints like single-worker mode are documented, tested, and enforced — not hidden.

For the full design rationale, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Detection Rules

AegisRange ships with 10 detection rules spanning authentication, session, document, service, artifact, policy, and correlation categories:

| Rule ID | Name | Trigger |
|---------|------|---------|
| DET-AUTH-001 | Authentication Failure Burst | ≥5 failures in 2 minutes |
| DET-AUTH-002 | Suspicious Success After Failures | Login success following ≥3 failures within 5 min |
| DET-SESSION-003 | Token Reuse From Conflicting Origins | Same session used from ≥2 IPs in 5 min |
| DET-DOC-004 | Restricted Document Access | Access denied due to classification mismatch |
| DET-DOC-005 | Abnormal Bulk Document Access | ≥20 document reads in 5 minutes |
| DET-DOC-006 | Read-to-Download Staging | Correlated read+download pattern across ≥2 documents |
| DET-SVC-007 | Unauthorized Service Route Access | ≥3 service authorization failures in 2 min |
| DET-ART-008 | Artifact Validation Failure Pattern | ≥3 artifact validation failures in 10 min |
| DET-POL-009 | Privileged Policy Change Under Risk | Policy change while actor has elevated risk context |
| DET-CORR-010 | Multi-Signal Compromise | ≥3 distinct detection rules triggered within 15 min |

Every rule uses explicit conditions, bounded time windows, and produces alerts with full contributing-event attribution. See [docs/detection/DETECTION_RULES.md](docs/detection/DETECTION_RULES.md) for the complete specification.

---

## Scenarios

Seven adversary simulation scenarios exercise the detection and response pipeline end-to-end:

| ID | Scenario | Threat Pattern |
|----|----------|----------------|
| SCN-AUTH-001 | Credential Abuse | Brute force → suspicious login |
| SCN-SESSION-002 | Session Hijacking | Token reuse from conflicting origins |
| SCN-DOC-003 | Restricted Document Access | Classification boundary violation |
| SCN-DOC-004 | Data Exfiltration | Bulk read → staged download |
| SCN-SVC-005 | Service Identity Abuse | Unauthorized service route probing |
| SCN-ART-006 | Artifact Tampering | Repeated validation failures |
| SCN-POL-007 | Privileged Policy Change | Policy modification under elevated risk |

Each scenario produces deterministic, repeatable results — the same scenario always generates the same event sequence, triggers the same detections, and produces the same incident outcome.

---

## Response Playbooks

Each detection rule maps to a specific containment playbook:

| Playbook | Action | Reversible |
|----------|--------|------------|
| PB-AUTH-001 | Rate limiting | Yes |
| PB-AUTH-002 | Step-up authentication | Yes |
| PB-SESSION-003 | Session revocation | Yes |
| PB-DOC-004 | Access denied enforcement | Yes |
| PB-DOC-005 | Download restriction | Yes |
| PB-DOC-006 | Download block | Yes |
| PB-SVC-007 | Service disabled + route block | Yes |
| PB-ART-008 | Artifact quarantine | Yes |
| PB-POL-009 | Policy change restriction + step-up | Yes |
| PB-CORR-010 | Multi-signal containment (step-up + download restriction) | Yes |

All response actions are intentionally bounded and reversible. AegisRange validates defensive controls — it doesn't perform destructive automation.

---

## Security Model

AegisRange treats its own platform security with the same rigor as the simulations it runs.

**Authentication** — PBKDF2-HMAC-SHA256 with 260,000 iterations, random 16-byte salts, and constant-time comparison. Dummy hashing on unknown usernames prevents timing side-channels. JWT tokens are delivered exclusively via httpOnly cookies — the token never touches JavaScript-accessible storage.

**Authorization** — Role-based access control with five levels (admin, soc_manager, analyst, red_team, viewer). Every protected endpoint enforces minimum role requirements through a composable dependency.

**Trust Boundaries** — Platform identity (the authenticated user) and simulation identity (the emulated threat actor) are explicitly separated. Simulation metadata in request bodies is treated as untrusted and never affects platform-level authorization.

**Rate Limiting** — Authentication endpoints are rate-limited (20 requests/60 seconds per IP) with `Retry-After` headers.

**Error Handling** — A global exception handler prevents stack traces from leaking to clients.

---

## Frontend

The Next.js frontend provides 13 views for operating and observing the platform:

- **Dashboard** — scenario launcher, system health, metrics, risk overview
- **Scenarios** — drill-down execution with step-by-step event/detection/response detail
- **Training Ops** — guided multi-phase operations with objectives and scoring
- **Events** — filterable telemetry feed with event detail
- **Alerts** — detection alert viewer with contributing event correlation
- **Incidents** — incident lifecycle management with timeline, notes, and status transitions
- **Analytics** — risk profiles, rule effectiveness, scenario history
- **ATT&CK Matrix** — MITRE technique coverage mapping
- **Kill Chain** — attack phase attribution and progression analysis
- **Campaigns** — cross-incident correlation and campaign detection
- **Reports** — exercise summary generation
- **Architecture** — live system topology and design documentation
- **Career** — player progression, XP tracking, daily challenges

The frontend uses a live-first API pattern: every request tries the backend first, and falls back to realistic mock data if the backend is unreachable — so the UI is never empty regardless of deployment mode.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, Uvicorn |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Persistence | SQLite (WAL mode, incremental + snapshot) |
| Auth | Custom JWT (HMAC-SHA256), httpOnly cookies, RBAC |
| Streaming | Server-Sent Events (SSE) |
| CI | GitHub Actions (Ruff, pytest, ESLint, tsc, Docker) |
| Deployment | Docker Compose, Railway |

Zero external runtime dependencies beyond Python and Node.js standard ecosystems. No Redis, no Postgres, no message queues. This is a deliberate choice — complexity is added when justified, not assumed.

---

## Getting Started

### Docker Compose (recommended)

```bash
git clone https://github.com/yourusername/AegisRange.git
cd AegisRange

cp .env.example .env
echo "JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')" >> .env

docker compose up --build -d
```

Backend: [http://localhost:8000](http://localhost:8000) · Frontend: [http://localhost:3000](http://localhost:3000)

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
export APP_ENV=development
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm ci
npm run dev
```

### Default Users

| Username | Role | Password |
|----------|------|----------|
| `admin` | admin | `admin_pass` |
| `soc_lead` | soc_manager | `soc_lead_pass` |
| `analyst1` | analyst | `analyst1_pass` |
| `red_team1` | red_team | `red_team1_pass` |
| `viewer1` | viewer | `viewer1_pass` |

---

## Development

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized setup)

### Running Linters

```bash
# Backend
cd backend && python -m ruff check app/ tests/ && python -m ruff format --check app/ tests/

# Frontend
cd frontend && npm run lint && npx tsc --noEmit
```

### Resetting the Database

```bash
# Docker
docker compose down -v && docker compose up --build -d

# Manual
rm backend/aegisrange.db
```

---

## Testing

The backend includes 7,200+ lines of tests across 24+ test files:

```bash
cd backend
pip install -r dev-requirements.txt
pytest tests/ -v
```

Test coverage spans detection rules, pipeline integration, persistence round-trips, auth enforcement, API contracts, serializers, edge cases, and architectural invariants (including a CI check that the Dockerfile enforces single-worker mode and an AST scan that prevents `datetime.utcnow()` regressions).

---

## Project Structure

```
AegisRange/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, lifespan
│   │   ├── models.py            # Domain models (Event, Alert, Incident)
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── serializers.py       # Model → API dict conversion
│   │   ├── store.py             # InMemoryStore with persistence hooks
│   │   ├── persistence.py       # SQLite persistence layer
│   │   ├── config.py            # Environment-based configuration
│   │   ├── dependencies.py      # Service wiring (composition root)
│   │   ├── routers/             # FastAPI route handlers (thin)
│   │   └── services/            # Domain services (15 modules)
│   └── tests/                   # 24+ test modules
├── frontend/
│   ├── app/                     # Next.js pages (13 views)
│   ├── components/              # Shared UI components
│   └── lib/                     # API client, types, contexts, hooks
├── docs/                        # Detection rules, scenarios, threat model,
│                                  response playbooks, incident model, event schema
├── ARCHITECTURE.md              # Full design rationale and constraints
├── DEPLOY.md                    # Deployment guide (Railway, Docker, bare metal)
├── CONTRIBUTING.md              # Developer guide and code standards
└── docker-compose.yml
```

---

## Documentation

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, domain model, persistence strategy, constraints |
| [DEPLOY.md](DEPLOY.md) | Railway, Docker Compose, and bare metal deployment |
| [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md) | Infrastructure topology and networking |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, code standards, PR process |
| [Detection Rules](docs/detection/DETECTION_RULES.md) | All 10 rules with conditions, thresholds, and severity |
| [Scenarios](docs/scenarios/SCENARIOS.md) | 7 adversary simulation scenarios |
| [Threat Model](docs/threat-model/THREAT_MODEL.md) | Assets, adversaries, attack surfaces, defensive objectives |
| [Response Playbooks](docs/response/RESPONSE_PLAYBOOK.md) | Containment actions and escalation logic |
| [Incident Model](docs/incidents/INCIDENT_MODEL.md) | Lifecycle, timeline, severity escalation |
| [Event Schema](docs/events/EVENT_SCHEMA.md) | Canonical event model and validation rules |

---

## License

This project is provided for portfolio and educational purposes.
