# AegisRange

AegisRange is a full-stack cybersecurity simulation platform designed to model how modern systems detect, analyze, and respond to threats.

This project was built to move beyond isolated features and instead focus on how real systems behave end-to-end. It simulates attack scenarios, generates telemetry, maps activity to MITRE ATT&CK and the cyber kill chain, and produces structured outputs like alerts, incidents, and reports.

The goal was not just to make something functional, but to design something that behaves like a real system under production constraints.

---

## Core Capabilities

- Simulated attack scenarios with event generation
- Detection pipeline that produces alerts and incidents
- MITRE ATT&CK and kill chain mapping
- Role-based authentication with JWT and CSRF protection
- Incident tracking and reporting workflows
- Analytics layer for system activity and outcomes
- End-to-end deployment with a frontend proxy and backend API

---

## Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Context-based state management

### Backend
- FastAPI
- Pydantic
- SQLite persistence layer

### Infrastructure
- Railway deployment
- Server-side API proxy
- Environment-based configuration

---

## System Overview

    AegisRange/
    ├── backend/                          # api server, domain engine, security logic
    │   ├── app/
    │   │   ├── main.py                   # FastAPI entry point, middleware, lifecycle
    │   │   ├── models.py                 # domain models (Event, Alert, Incident)
    │   │   ├── schemas.py                # request and response contracts
    │   │   ├── serializers.py            # model to API transformations
    │   │   ├── store.py                  # in-memory state layer
    │   │   ├── persistence.py            # SQLite persistence layer
    │   │   ├── config.py                 # environment-driven configuration
    │   │   ├── dependencies.py           # service wiring and composition root
    │   │   ├── routers/                  # API route handlers (thin controllers)
    │   │   └── services/                 # domain services (detection engine, incident pipeline, risk scoring)
    │   └── tests/                        # test coverage and validation
    │
    ├── frontend/                         # UI layer and client application
    │   ├── app/                          # Next.js views and routing
    │   │   └── api/proxy/                # server-side proxy for API requests
    │   ├── components/                   # shared UI components
    │   └── lib/                          # API client, auth context, hooks
    │
    ├── docs/                             # threat models, scenarios, system design
    │
    ├── ARCHITECTURE.md                   # design decisions and tradeoffs
    ├── DEPLOY.md                         # deployment instructions (Railway, Docker)
    └── docker-compose.yml                # local environment setup

---

## Architecture Notes

This project is built around a few key principles.

### 1. Thin API layer, strong domain layer
Routes are intentionally lightweight. Most logic lives in services that model real system behavior such as detection, incident generation, and risk scoring.

### 2. Explicit data contracts
Pydantic schemas define all API boundaries. This keeps request and response handling predictable and enforceable.

### 3. Separation of concerns
Frontend, API routing, and domain logic are clearly separated to avoid tight coupling and simplify debugging.

### 4. Proxy-based API communication
The frontend uses a server-side proxy to communicate with the backend. This avoids common issues with cookies, CSRF handling, and cross-origin requests in production.

### 5. Environment-driven configuration
All runtime behavior is controlled through environment variables, allowing the same codebase to run locally and in production without changes.

---

## Authentication Model

- JWT-based authentication
- HTTP-only cookies for session management
- CSRF token validation for protected routes
- Role-based access control for restricted actions

This was designed to reflect real-world constraints, not just local development convenience.

---

## Detection and Simulation Model

The system simulates the lifecycle of an attack.

1. Scenario execution generates events
2. Events are processed by detection services
3. Alerts are created based on detection rules
4. Alerts can escalate into incidents
5. Incidents are tracked and reported

Each step is intentionally separated to reflect how real systems process and respond to activity.

---

## Deployment

The application is deployed using Railway.

- Frontend served via Next.js
- Backend exposed as a FastAPI service
- Frontend communicates through a server-side proxy
- Environment variables control runtime behavior

See `DEPLOY.md` for full setup instructions.

---

## Why This Project

Most projects stop at making something work. This one focuses on how systems behave when everything is connected.

That includes:
- authentication edge cases
- proxy behavior
- request routing
- state handling across services
- production debugging

The goal was to build something that reflects real engineering challenges, not just isolated features.

---

## Roadmap

### Shipped in 0.10.0

- **Expanded detection rules and scenario coverage.** Added DET-GEO-011 (impossible-travel authentication), DET-EXFIL-012 (large-volume data exfiltration), and DET-HOUR-013 (off-hours privileged action), each with MITRE mapping and dedicated unit tests. Added SCN-GEO-007 and SCN-EXFIL-008 scenarios to exercise them end-to-end.
- **More advanced persistence and scaling strategies.** Shipped Phase 1 of the plan in `docs/operations/SCALING.md`: a pluggable `AuthCache` protocol (`app/services/auth_cache.py`) with in-memory and Redis-backed implementations. Multi-worker deployments can now share JWT revocations and TOTP state by setting `REDIS_URL`.
- **Improved analytics and reporting depth.** New `AnalyticsService` + `/analytics/mttd-mttr`, `/analytics/risk-trajectory/{actor_id}`, `/analytics/alert-disposition`, and `/analytics/coverage` endpoints covering detection latency, response latency, time-to-close, per-actor risk-score time series, stale-investigation watchlists, and rule-coverage gaps.
- **Architecture refinements.** Enriched `/health` with a per-subsystem reachability block (SQLite, auth cache backend, JWT-secret configuration, uptime, version). New `/metrics/prometheus` OpenMetrics exposition for Prometheus scraping (admin-gated). Builds on the 0.9.0 pass that split four service monoliths and fixed encapsulation leaks; the service + route layout is now set up so adding a rule or scenario is a local edit in one package.

### Ahead (0.11.0+)

- Postgres-authoritative persistence and a dual-write migration window (SCALING.md Phases 2–3).
- Multi-worker deployment and removal of the single-worker guardrail (SCALING.md Phase 4).
- Frontend `mock-data.ts` / `api.ts` package split deferred from 0.9.0.
- Distributed tracing and richer latency histograms surfaced through the new Prometheus endpoint.
