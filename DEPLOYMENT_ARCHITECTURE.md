# DEPLOYMENT_ARCHITECTURE.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines the deployment architecture for AegisRange, covering both the current runtime reality and the target-state deployment model.

**ARCHITECTURE.md** defines the logical system design. This document defines:

- how the system is currently deployed
- how it is intended to be deployed at maturity
- target infrastructure boundaries and operational controls

---

## 2. Deployment Principles

### 2.1 Separation of Concerns
Logical modules and infrastructure components must remain clearly separated.

### 2.2 Environment Isolation
Development, staging, and production environments should not share databases, secrets, runtime identities, or telemetry stores.

### 2.3 Least Privilege
Each deployed component should have only the permissions it needs, limited network access, and scoped credentials.

### 2.4 Defense in Depth
Security is enforced at multiple layers: ingress, application, identity, service communication, data storage.

### 2.5 Observability by Default
Every deployed component should emit logs, metrics, events, and health signals.

### 2.6 Stateless Service Preference
Where possible, services should be stateless so they can scale horizontally, restart safely, and fail independently.

---

## 3. Current Deployment Reality

### 3.1 What Exists Today

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Backend | FastAPI single process | Runs via `uvicorn app.main:app` |
| Frontend | Next.js 14 dev server | Runs via `npm run dev` |
| Persistence | In-memory primary + hybrid SQLite persistence | Incremental entity writes + operational state snapshots; state survives restart |
| Database | SQLite (auto-created) | `aegisrange.db`, disabled in test env; path configurable via `DB_PATH` |
| Authentication | JWT (HMAC-SHA256) enforced on all 35 protected routes | RBAC with 5 roles; PBKDF2-hashed passwords; secret externalized via `JWT_SECRET`; rate limited |
| Containerization | Dockerfiles + docker-compose | Backend and frontend containers |
| CI | GitHub Actions | Runs ruff lint + pytest (backend), lint + build (frontend) |
| Secrets | `.env.example` template | `JWT_SECRET`, `CORS_ORIGINS`, `TOKEN_EXPIRY_HOURS`, `DB_PATH`, `LOG_LEVEL`, `APP_ENV` |

### 3.2 Current Runtime Model

```
Developer Machine or Docker
    ├── Frontend (Next.js, port 3000)
    │     └── Calls backend API via HTTP
    └── Backend (FastAPI/Uvicorn, port 8000)
          ├── InMemoryStore (Python process memory)
          └── SQLite (aegisrange.db, write-through cache)
```

- No network segmentation
- No TLS (local HTTP)
- No secret management beyond environment variables
- State persists across restarts via SQLite; resets via `POST /admin/reset`

### 3.3 Docker Compose

The provided `docker-compose.yml` runs two containers:
- `backend`: FastAPI on port 8000
- `frontend`: Next.js on port 3000

No database container is included — SQLite is embedded in the backend process and auto-creates `aegisrange.db` on startup.

---

## 4. Target-State Deployment Model

The following sections describe the intended deployment architecture. These are design targets, not current implementation.

### 4.1 Target Deployment Phases

**Phase 1 (current)**:
- Modular monolith backend
- Single frontend with login flow
- SQLite write-through persistence (done)
- JWT authentication enforced on all routes (done)
- Local or simple cloud deployment

**Phase 2 (future)**:
- Service decomposition
- Isolated internal services
- Managed telemetry pipeline
- Stronger network segmentation
- Production-grade runtime controls

---

## 5. Target Environment Model

### 5.1 Local *(partially implemented)*
Purpose: development, debugging, schema validation, scenario testing

Current state: functional with in-memory persistence. Docker support exists.

### 5.2 Staging *(not implemented)*
Purpose: pre-production validation, integration testing, deployment verification

Target: production-like configuration, isolated database, real deployment workflows.

### 5.3 Production *(not implemented)*
Purpose: portfolio-grade hosted deployment, controlled public presentation

Target: strict secret separation, network segmentation, managed database, controlled ingress.

---

## 6. Target Deployment Topology

```
Public User
   |
   v
Frontend Hosting Layer (Vercel / Netlify / static host)
   |
   v
Public API Entry Point (HTTPS, reverse proxy)
   |
   v
Application Runtime Layer (FastAPI)
   ├── Identity Domain
   ├── Document Domain
   ├── Telemetry Domain
   ├── Detection Domain
   ├── Response Domain
   ├── Incident Domain
   ├── Scenario Domain
   ├── MITRE / Kill Chain / Campaign Domains
   └── Auth (JWT enforcement)
   |
   v
Private Data Layer
   ├── PostgreSQL (or SQLite for development)
   └── Optional Cache / Queue Layer
```

---

## 7. Target Infrastructure Components

### 7.1 Frontend Hosting Layer
Responsibilities: serve web UI, authenticate users, communicate with backend API.

Requirements:
- HTTPS enabled
- Environment-based API configuration
- No direct database access
- No secrets embedded in client code

### 7.2 API Entry Layer
Responsibilities: receive public requests, terminate TLS, enforce routing, protect backend.

Requirements: HTTPS only, request validation, rate limiting, security headers.

### 7.3 Application Runtime Layer
Responsibilities: execute business logic, enforce authentication, run detection/response pipeline.

Requirements: environment-specific configuration, scoped secrets, health endpoints.

### 7.4 Data Layer *(not yet implemented)*
Responsibilities: persist events, alerts, incidents, documents, scenario records.

Requirements: private network access only, backup capability, encryption at rest.

### 7.5 Optional Cache / Queue Layer *(not yet implemented)*
Responsibilities: short-lived state, background processing, future event queue support.

---

## 8. Target Network Zones

### 8.1 Public Zone
Contains: frontend, public API endpoint.
Allowed: inbound HTTPS from users, outbound to backend API.
Denied: direct database access.

### 8.2 Application Zone
Contains: backend runtime.
Allowed: inbound from API entry layer, outbound to data layer.
Denied: arbitrary inbound public access.

### 8.3 Data Zone
Contains: database, optional cache.
Allowed: inbound only from application zone.
Denied: direct public or frontend access.

---

## 9. Trust Boundaries

| Boundary | Between | Concerns |
|----------|---------|----------|
| 1 | User → Frontend | Browser security, session handling |
| 2 | Frontend → API | HTTPS enforcement, authentication context |
| 3 | API → Application | Origin trust, request normalization |
| 4 | Application → Data | Least-privilege access, query integrity |
| 5 | Internal domains | Service identity, access restrictions |

**Current state**: Boundaries 1-3 exist logically. Auth is enforced on all protected routes (boundary 2-3). TLS is not present in local dev (expected at reverse proxy). Boundary 4 is partially implemented via SQLite persistence. Boundary 5 does not apply yet (single monolith).

---

## 10. Secret Management

### 10.1 Current State
- 8 environment variables defined in `.env.example`: `APP_ENV`, `LOG_LEVEL`, `LOG_FORMAT`, `CORS_ORIGINS`, `JWT_SECRET`, `TOKEN_EXPIRY_HOURS`, `DB_PATH`, `NEXT_PUBLIC_API_URL`
- JWT signing secret is externalized via `JWT_SECRET` env var. In development, a default dev secret is used. In production (`APP_ENV=production`), the application refuses to start without `JWT_SECRET` set
- Passwords are hashed with PBKDF2-HMAC-SHA256 (260,000 iterations)
- No secret manager integration

### 10.2 Target State
- Database credentials
- JWT signing secret (rotatable)
- Session encryption keys
- Environment-separated secrets
- No secrets in source control or frontend bundles

---

## 11. Identity and Access Model

### 11.1 Current State
Two conceptually separate identity systems exist:
1. **IdentityService**: Simulates threat actor authentication for scenarios. Active and used.
2. **AuthService**: Platform user authentication with JWT (HMAC-SHA256) and RBAC. **Enforced on all 35 protected routes** via `require_role()` FastAPI dependency. PBKDF2-hashed passwords. JWT secret externalized via `JWT_SECRET` env var.

Frontend has login page, AuthProvider context, AuthGuard redirect, and automatic token attachment on all API calls.

### 11.2 Target State (remaining)
- Externalized JWT secret via managed secret store (currently env var)
- Token refresh / rotation mechanism
- IdentityService continues to handle in-scenario actor simulation

---

## 12. Availability and Failure Handling

### 12.1 Current State
- Backend failure: in-memory state is lost but authoritative state survives in SQLite. On restart, entities (events, alerts, responses, incidents, notes, scenario history) and operational state (containment sets, risk profiles) are restored from SQLite. Derived state is rebuilt deterministically. Ephemeral state (simulated sessions) resets.
- Pipeline writes are transactional: a crash mid-pipeline cannot leave partial entity state on disk.
- Frontend failure: UI unavailable, backend unaffected

### 12.2 Target State

| Failure | Effect | Mitigation |
|---------|--------|-----------|
| Frontend | UI unavailable | Static hosting, health checks |
| Backend | All APIs unavailable | Restartable stateless runtime, health probes |
| Database | Persistence unavailable | Backups, connection retry, graceful degradation |

---

## 13. Scaling Model

### 13.1 Current State
Single backend instance. In-memory state prevents horizontal scaling.

### 13.2 Target State
- Frontend: stateless, horizontally scalable
- Backend: stateless with database, scalable behind load balancer
- Database: single instance initially, read replicas for scale

---

## 14. Deployment Pipeline

### 14.1 Current State
- GitHub Actions CI runs pytest on push/PR
- Dockerfiles exist for backend and frontend
- No automated deployment pipeline

### 14.2 Target State
- Source control driven deployment
- Environment-specific configuration
- Automated tests before deployment
- Schema migration handling
- Rollback capability

---

## 15. Portfolio-Grade Deployment Recommendation

For a realistic but manageable deployment:

| Component | Recommendation |
|-----------|---------------|
| Frontend | Vercel or Netlify |
| Backend | FastAPI in container on cloud platform |
| Database | Managed PostgreSQL or SQLite for demos |
| Secrets | Environment variables per environment |
| Networking | HTTPS only, backend separated from database |

---

## 16. Anti-Patterns to Avoid

- Public database exposure
- Shared secrets across environments
- Frontend access to backend internals
- Storing secrets in repository files
- Assuming internal traffic is trusted
- Deploying without environment isolation
- Over-engineering microservices before runtime controls exist

---

## 17. Future Enhancements

- Service decomposition into separate deployable units
- Message queue for asynchronous event handling
- Internal service mesh or identity layer
- Dedicated telemetry pipeline
- Managed secret store
- Formal backup and recovery strategy
- Zero trust service-to-service authentication

---

## 18. Summary

This document describes both the current deployment reality and the target deployment architecture for AegisRange.

**Current state**: Two containers (backend + frontend). In-memory primary store with hybrid SQLite persistence (incremental entity writes + operational state snapshots). JWT auth enforced on all 35 protected routes with RBAC and PBKDF2-hashed passwords. JWT secret externalized via environment variable. CORS origins configurable. No TLS (expected at reverse proxy). Functional for development and demonstration.

**Target state**: HTTPS via reverse proxy, managed secret store, environment separation, network segmentation, Railway or cloud deployment. The core auth and persistence foundations are in place.
