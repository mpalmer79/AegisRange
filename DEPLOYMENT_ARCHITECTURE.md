# DEPLOYMENT_ARCHITECTURE.md

## Project Title

AegisRange: Defensive Security Simulation and Validation Platform

---

## 1. Purpose

This document defines how AegisRange is deployed, what runtime assumptions it depends on, and how the deployment model is expected to evolve.

ARCHITECTURE.md defines the logical system design, domain boundaries, and processing model.

This document defines:

- how the system runs today
- which deployment modes are currently supported
- what infrastructure constraints exist today
- what changes are required before stronger scale or isolation are introduced

---

## 2. Deployment Scope

AegisRange currently supports three practical deployment modes:

1. local development
2. local or self-hosted Docker Compose
3. hosted two-service deployment on Railway

The deployment model is intentionally simple at this stage. It prioritizes correctness, traceability, and low operational complexity over horizontal scale.

---

## 3. Deployment Principles

### Runtime Honesty
The deployment document should describe what the system actually does today, not just what it may do later.

### Separation of Concerns
Frontend delivery, backend execution, and persistent storage are treated as separate operational concerns even when deployed simply.

### Least Privilege
Secrets, runtime identities, network access, and storage paths should be scoped to the smallest practical boundary.

### Environment Isolation
Development and hosted deployments should not share secrets, mutable data, or runtime assumptions.

### Explicit Constraints
Known scale and runtime limits must be documented clearly. The system should not imply production guarantees it does not implement.

---

## 4. Current Deployment Reality

### What Exists Today

| Component | Current Implementation | Notes |
|----------|----------------------|------|
| Frontend | Next.js standalone production build | Runs via node server.js |
| Backend | FastAPI single-process | Uvicorn with --workers 1 |
| Persistence | Hybrid | In-memory + SQLite |
| Database | SQLite | Configurable DB_PATH |
| Auth | JWT | Environment-based secret |
| Realtime | SSE | Backend-driven |
| Containers | Dockerfiles | Frontend + backend |
| Compose | docker-compose.yml | Local full stack |
| Hosting | Railway | Two-service deployment |
| Config | .env.example | Documented variables |

### Supported Modes

#### Local Development
- frontend: 3000
- backend: 8000
- SQLite optional

#### Docker Compose
- frontend container
- backend container
- persistent volume

#### Railway
- frontend service
- backend service
- persistent volume at /data
- env vars per service
- health checks enabled

---

## 5. Runtime Topology

### Local / Docker

User → Frontend → Backend → In-memory → SQLite

### Railway

User → Frontend Service → Backend Service → In-memory → SQLite (/data)

---

## 6. Frontend Deployment

### Implementation

- Next.js 14
- standalone output
- built with next build
- runs via node server.js

### Environment

- NEXT_PUBLIC_API_URL
- BACKEND_URL

### Responsibility

- UI delivery
- routing
- API communication

---

## 7. Backend Deployment

### Implementation

- FastAPI
- Uvicorn runtime
- single worker enforced
- DB_PATH defaults to /data/aegisrange.db
- /health endpoint exposed

### Critical Constraint

Backend must run as a single worker.

Reasons:
- in-memory coordination
- process-local state
- rate limiting is not shared

Multi-worker deployment will break correctness.

### Responsibilities

- API handling
- authentication
- pipeline orchestration
- persistence
- SSE streaming

---

## 8. Persistence Model

### Structure

- in-memory runtime state
- SQLite durable storage

### Behavior

Incremental:
- events
- alerts
- responses
- incidents

Snapshot:
- enforcement state
- risk profiles

### Limitations

- no distributed coordination
- no HA database
- no exactly-once guarantees

---

## 9. Environment Model

### Development
- local secrets
- local DB
- debugging

### Hosted
- Railway services
- persistent storage
- public access

### Future Staging
- isolated env
- production-like config

---

## 10. Secrets and Config

### Backend
- APP_ENV
- LOG_LEVEL
- JWT_SECRET
- DB_PATH

### Frontend
- NEXT_PUBLIC_API_URL
- BACKEND_URL

### Limitation

No external secret manager yet.

---

## 11. Health and Observability

### Current

- /health endpoint
- logs
- persisted data
- SSE updates

### Missing

- metrics
- tracing
- centralized logging

---

## 12. Network Model

### Boundaries

1. browser → frontend
2. frontend → backend
3. backend → storage

### Missing

- service mesh
- internal queues
- private networking layers

---

## 13. Railway Deployment

### Structure

- frontend/
- backend/

Each has:
- Dockerfile
- railway.toml

### Backend Needs

- APP_ENV=production
- JWT_SECRET set
- DB_PATH=/data/aegisrange.db
- volume mounted

### Suitability

Railway is:
- good for MVP
- good for demos

Not enterprise-grade infrastructure.

---

## 14. Docker Compose

### Runs

- frontend
- backend
- volume

### Use

- local full stack
- testing

---

## 15. Current Guarantees

- containerized deployment
- durable SQLite persistence (if volume mounted)
- reproducible environment
- health checks
- correct single-worker behavior

---

## 16. Non-Guarantees

- multi-worker safety
- distributed systems behavior
- zero downtime deploys
- HA database
- queue-based retries

---

## 17. Evolution Path

### Near-Term

- logging
- observability
- better deployment validation

### Mid-Term

- external state
- PostgreSQL
- shared cache
- async processing

### Long-Term

monolith → external state → distributed components → scale

---

## 18. Summary

AegisRange deploys today as:

- Next.js frontend
- FastAPI backend
- SQLite persistence
- Docker-based runtime
- Railway-compatible hosting

It is optimized for:

- correctness
- clarity
- reproducibility
- fast iteration

The next step is not more infrastructure.

The next step is stronger guarantees:
- observability
- persistence reliability
- shared state
- scale readiness