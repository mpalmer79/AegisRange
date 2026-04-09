# ARCHITECTURE.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Overview

AegisRange is a modular security simulation platform designed to model how modern distributed systems:

- generate and normalize telemetry
- detect adversary behavior
- apply controlled response actions
- construct auditable incident timelines

The system prioritizes defensive architecture, not exploitation.

---

## 2. Architectural Principles

### 2.1 Modular Boundaries
Each domain is isolated with clear responsibilities. In the current modular monolith, boundaries are enforced logically through separate service classes with explicit interfaces.

### 2.2 Event-Driven Design
All system behavior is observable through events:
- every action emits telemetry
- detections are derived from events
- incidents are built from correlated events

Events are the source of truth.

### 2.3 Deterministic Detection
- no black-box ML
- rule-based evaluation
- explicit thresholds and conditions
- explainable outcomes

### 2.4 Controlled Response
Response actions are:
- bounded
- reversible where possible
- tied to detection confidence

### 2.5 Auditability First
Every system decision must be:
- traceable
- reproducible
- explainable

---

## 3. Current Implemented Architecture

### 3.1 System Topology

```
[Frontend - Next.js 14 App Router]
        |
        v (HTTP/SSE, JWT auth required)
[Backend Service (FastAPI, single worker)]
    ├── Identity Module (simulated actors)
    ├── Document Module
    ├── Telemetry Module
    ├── Detection Engine (10 rules)
    ├── Response Orchestrator (10 playbooks)
    ├── Incident Service
    ├── Pipeline Service
    ├── Scenario Engine (6 scenarios)
    ├── Risk Scoring Service
    ├── MITRE ATT&CK Service
    ├── Kill Chain Service
    ├── Campaign Correlation Service
    ├── Auth Service (JWT + RBAC enforced on all routes)
    ├── Report Service
    └── Stream Service (SSE)
        |
        v
[InMemoryStore (Python singleton)]
        |
        v (incremental writes + operational snapshots)
[SQLite (aegisrange.db)]
```

**Single-process constraint**: The backend runs as a single Uvicorn worker. `InMemoryStore` is a process-level singleton. Multiple workers would create independent, unsynchronized stores.

### 3.2 Service Inventory (15 services)

| Service | File | Status |
|---------|------|--------|
| IdentityService | `identity_service.py` | Active — simulated auth for threat actors |
| DocumentService | `document_service.py` | Active — role-based document access |
| TelemetryService | `event_services.py` | Active — event storage and lookup |
| DetectionService | `detection_service.py` | Active — 10 detection rules |
| ResponseOrchestrator | `response_service.py` | Active — 10 response playbooks |
| IncidentService | `incident_service.py` | Active — incident lifecycle management |
| EventPipelineService | `pipeline_service.py` | Active — event-to-incident orchestration |
| ScenarioEngine | `scenario_service.py` | Active — 6 adversary simulations |
| RiskScoringService | `risk_service.py` | Active — actor risk scoring |
| MitreAttackService | `mitre_service.py` | Active — TTP mapping and coverage |
| KillChainService | `killchain_service.py` | Active — kill chain stage tracking |
| CampaignDetectionService | `campaign_service.py` | Active — cross-incident correlation |
| AuthService | `auth_service.py` | Active — JWT + RBAC enforced on all routes |
| ReportService | `report_service.py` | Active — exercise report generation |
| StreamService | `stream_service.py` | Active — SSE subscriber management |

### 3.3 Application Structure

```
app/
├── main.py                 (Application entry point, middleware, lifespan)
├���─ dependencies.py         (Service wiring and shared instances)
├── schemas.py              (Pydantic request/response models)
├── serializers.py          (Domain model → API dict serialization)
├── models.py               (Core domain dataclasses and enums)
├���─ store.py                (InMemoryStore singleton)
├── persistence.py          (SQLite persistence layer)
├── config.py               (Settings from environment)
├── logging_config.py       (Structured logging setup)
├── routers/                (FastAPI APIRouter modules)
│   ├── admin.py            (Store reset)
│   ├─��� alerts.py           (Alert listing)
│   ├── analytics.py        (Risk profiles, rule effectiveness)
│   ├── auth.py             (Platform login, user listing)
│   ├── campaigns.py        (Campaign detection)
│   ├── documents.py        (Document read/download simulation)
│   ├── events.py           (Event listing, export)
│   ├── health.py           (Health check)
│   ├── identity.py         (Simulation identity login, session revoke)
│   ├── incidents.py        (Incident CRUD, notes, status)
│   ├── killchain.py        (Kill chain analysis)
│   ├── metrics.py          (Dashboard metrics)
│   ├── mitre.py            (MITRE ATT&CK mappings, coverage)
│   ├── reports.py          (Exercise report generation)
│   ├── scenarios.py        (Scenario execution)
│   └── stream.py           (SSE event streaming)
└── services/               (15 domain service modules)
```

### 3.4 Service Wiring

All services are instantiated in `dependencies.py` and wired together through constructor injection. The `InMemoryStore` singleton is shared across services that need state access. Services do not communicate through the store — they are composed through the `EventPipelineService` which orchestrates the event-detection-response-incident flow. Route handlers live in `app/routers/` and import services from `dependencies.py`.

---

## 4. Core Components

### 4.1 Identity Service

Handles:
- authentication (simulated threat actor login)
- session creation
- session revocation
- step-up authentication

Emits: login success/failure, token issuance, session change events.

**Note**: This is the *simulation* identity system for threat actors within scenarios. It is separate from the platform auth service (see §4.11).

### 4.2 Document Service

Handles:
- document read access
- download access
- classification enforcement (role-based)

Emits: document read events, document download events.

### 4.3 Telemetry Service

Central event processor.

Responsibilities:
- normalize all events into canonical `Event` dataclass
- persist events via `store.append_event()`
- provide event lookup by type, actor, time range

### 4.4 Detection Engine

Evaluates events against 10 rules across 5 categories:
- Authentication (2 rules)
- Session (1 rule)
- Document (3 rules)
- System (3 rules)
- Correlation (1 rule)

All rules use time-windowed event analysis with explicit thresholds. No ML. Each rule produces an `Alert` with severity and confidence.

### 4.5 Response Orchestrator

Executes 10 playbooks mapped to detection rules:
- Rate limiting, step-up auth
- Session revocation
- Download restriction
- Service disablement
- Route blocking
- Artifact quarantine
- Policy change restriction
- Multi-signal containment

Each playbook produces `ResponseAction` records and mutates containment state in the store.

### 4.6 Pipeline Service

Orchestrates the full flow: event → detection → response → incident.

When an event is ingested:
1. Store event via `store.append_event()`
2. Register event with incident service (if incident exists for correlation)
3. Run all detection rules
4. Deduplicate alerts via `alert_signatures`
5. Persist novel alerts via `store.extend_alerts()`
6. For each alert, execute matching response playbook
7. Create or update incident via `store.upsert_incident()`
8. Persist responses via `store.extend_responses()`

### 4.7 Incident Service

Builds the incident model. Each incident contains:
- primary actor
- related alerts
- response actions
- full timeline of events
- status lifecycle (open → investigating → contained → resolved → closed)
- severity escalation
- analyst notes

All incident mutations are followed by `store.upsert_incident()` to ensure durability.

### 4.8 Scenario Engine

6 deterministic adversary simulations that exercise the full pipeline. Each scenario injects a controlled sequence of events through the identity and document services, triggering detections and responses. Scenario execution is attributed to the platform user who triggered it via `operated_by`.

### 4.9 Risk Scoring Service

Computes per-actor risk profiles based on:
- alert severity weights
- detection confidence multipliers
- accumulated behavioral signals

Risk score changes on incidents are persisted via `store.upsert_incident()`.

### 4.10 MITRE ATT&CK Service

Maps all 10 detection rules to MITRE ATT&CK techniques and tactics. Provides:
- rule-to-TTP mappings
- coverage matrix showing covered vs uncovered techniques
- tactic-level coverage percentages
- scenario-to-TTP resolution

### 4.11 Auth Service

Implements:
- JWT token creation/verification (HMAC-SHA256, stdlib only)
- PBKDF2-HMAC-SHA256 password hashing (260,000 iterations, 32-byte key, 16-byte salt)
- Timing-safe authentication (dummy hash on unknown users)
- 5 roles: admin (100), soc_manager (75), analyst (50), red_team (50), viewer (25)
- 5 default users with role assignments
- `require_role()` FastAPI dependency for route protection
- Role hierarchy with numeric levels
- JWT secret externalized via `JWT_SECRET` env var (refuses to start without it in production)
- Token expiry configurable via `TOKEN_EXPIRY_HOURS`

**Current state**: Enforced on all 35 protected routes. Public endpoints: `/health`, `/auth/login`. Rate limited at 20 requests per 60 seconds per client IP on auth endpoints.

### 4.12 Supporting Services

- **Kill Chain Service**: Maps detections to Lockheed Martin Cyber Kill Chain stages
- **Campaign Service**: Correlates multiple incidents into campaigns based on shared actors and TTPs
- **Report Service**: Generates exercise reports with detection coverage, response effectiveness, MITRE coverage, and recommendations
- **Stream Service**: Manages SSE subscribers with asyncio queues for real-time event delivery

---

## 5. Data Flow

### 5.1 Normal Flow

1. User authenticates
2. Identity service emits auth event
3. Telemetry stores event
4. Detection engine evaluates
5. No alerts — system continues

### 5.2 Adversary Flow

1. Failed login attempts
2. Successful login
3. Rapid document access
4. Detection rules triggered
5. Alerts generated with severity/confidence
6. Response playbooks execute containment
7. Incident created or escalated
8. Timeline assembled
9. Kill chain stages mapped
10. MITRE ATT&CK TTPs enriched

---

## 6. Event Lifecycle

```
User Action
   ↓
Event Generated (frozen dataclass)
   ↓
Telemetry Normalization
   ↓
Event Stored (in-memory + SQLite)
   ↓
Detection Engine (10 rules evaluated)
   ↓
Alert Created (if rule matches)
   ↓
Response Triggered (matching playbook)
   ↓
Incident Updated (timeline entry added)
```

---

## 7. Data Model

### 7.1 Core Types (defined in `models.py`)

| Type | Mutability | Key Fields |
|------|-----------|------------|
| `Event` | Frozen dataclass | event_id, event_type, actor_id, target_type, target_id, timestamp, payload |
| `Alert` | Frozen dataclass | alert_id, rule_id, severity, confidence, created_at, contributing_event_ids, payload |
| `ResponseAction` | Frozen dataclass | response_id, playbook_id, action_type, actor_id, correlation_id, payload |
| `TimelineEntry` | Frozen dataclass | timestamp, entry_type, reference_id, summary |
| `Incident` | Mutable dataclass | incident_id, correlation_id, primary_actor_id, status, severity, timeline, detection_ids, response_ids |
| `Severity` | Enum | informational, low, medium, high, critical |
| `Confidence` | Enum | low, medium, high |

### 7.2 Persistence Model

#### Architecture

All data lives in `InMemoryStore` (singleton) at runtime. A `PersistenceLayer` (`persistence.py`) provides hybrid SQLite persistence:

- **Entity persistence** (incremental): Events, alerts, responses, incidents, incident notes, and scenario history are written to SQLite immediately when created or updated, via store write methods (`append_event`, `extend_alerts`, `extend_responses`, `upsert_incident`, `append_incident_note`, `append_scenario_history`).
- **Operational state persistence** (snapshot): Containment sets and risk profiles are snapshot-persisted to SQLite after each mutating HTTP request via middleware.
- **Load**: On startup, all persisted state is loaded atomically (stage-then-swap). Derived state is rebuilt deterministically. Ephemeral state resets.

#### Serialization Boundary

API response serialization is centralized in `serializers.py`, which owns all domain-model-to-dict conversions. Route handlers import serializer functions (`event_to_dict`, `alert_to_dict`, `incident_to_dict`, etc.) instead of building dicts inline. This prevents field drift between endpoints.

#### State Classification

Every collection in `InMemoryStore` is classified as one of three types:

| Classification | Persistence | Load Behavior | Example |
|----------------|-------------|---------------|---------|
| **Authoritative** | Must persist | Load from SQLite | events, alerts, incidents, containment sets, risk_profiles |
| **Derived** | Must NOT persist | Rebuild deterministically | login_failures_by_actor, alert_signatures |
| **Ephemeral** | Must NOT persist | Reset to empty | actor_sessions |

Full classification:

| Collection | Classification | Justification |
|------------|---------------|---------------|
| `events` | authoritative | Primary telemetry record |
| `alerts` | authoritative | Detection output record |
| `responses` | authoritative | Response action record |
| `incidents_by_correlation` | authoritative | Incident lifecycle state |
| `incident_notes` | authoritative | Analyst observations |
| `scenario_history` | authoritative | Execution audit trail |
| `revoked_sessions` | authoritative | Active containment enforcement |
| `step_up_required` | authoritative | Active containment enforcement |
| `download_restricted_actors` | authoritative | Active containment enforcement |
| `disabled_services` | authoritative | Active containment enforcement |
| `quarantined_artifacts` | authoritative | Active containment enforcement |
| `policy_change_restricted_actors` | authoritative | Active containment enforcement |
| `blocked_routes` | authoritative | Active containment enforcement |
| `risk_profiles` | authoritative | Accumulated risk scoring state |
| `login_failures_by_actor` | derived | Rebuilt from events on load |
| `document_reads_by_actor` | derived | Rebuilt from events on load |
| `authorization_failures_by_actor` | derived | Rebuilt from events on load |
| `artifact_failures_by_actor` | derived | Rebuilt from events on load |
| `alert_signatures` | derived | Rebuilt from alerts on load |
| `actor_sessions` | ephemeral | Simulated sessions; re-auth required after restart |

#### Limitations

- **Single-process only**: The in-memory store is a process-level singleton. Multiple workers create independent, unsynchronized stores.
- **No concurrency guarantees**: No locking on store mutations. Acceptable for single-worker operation.
- **SQLite write-through**: Suitable for single-process writes only. Not designed for concurrent multi-process access.
- **Hybrid persistence gap**: A crash between an incremental entity write and the next operational state snapshot can cause operational state to lag behind entity state. Derived state recovers via rebuild; authoritative operational state may revert to last snapshot.

---

## 8. Identity Model

AegisRange has two conceptually separate identity systems:

### 8.1 Platform Users (Auth Service)

- Authenticate via `/auth/login` with JWT tokens (HMAC-SHA256)
- 5 roles: admin, soc_manager, analyst, red_team, viewer
- All 35 protected routes enforce `require_role()` via FastAPI dependency
- Platform user identity is stashed on `request.state.platform_user` by the auth middleware
- Used for: scenario execution attribution (`operated_by`), incident note authorship, status transition audit trail, admin reset logging

### 8.2 Simulated Actors (Identity Service)

- Authenticate via `/identity/login` within simulation scenarios
- 2 hardcoded users: alice (analyst), bob (admin)
- Sessions are tracked in `actor_sessions` (ephemeral — reset on restart)
- Used for: simulating threat actor behavior within scenarios

### 8.3 Attribution Model

Platform user identity flows through the system:
- Scenario execution records `operated_by` (platform user who triggered it)
- Incident notes record `author` (platform user, overriding client-supplied author)
- Status transitions record `changed_by` (platform user)
- Admin reset records `reset_by` (platform user)

Simulated actor identity flows through events:
- Events record `actor_id` (simulated actor like "user-alice")
- Alerts inherit `actor_id` from triggering events
- Incidents inherit `primary_actor_id` from the first alert

These two identity systems do not cross-reference.

---

## 9. Detection Model

### Characteristics
- Rule-based with explicit thresholds
- Time-windowed event analysis
- Correlation-aware (multi-signal detection)
- Severity and confidence scoring
- Deterministic and explainable

### Rule Categories
- **Authentication**: Failed login bursts, suspicious success after failures
- **Session**: Token reuse from conflicting origins
- **Document**: Unauthorized access, bulk access, read-to-download staging
- **System**: Unauthorized service access, artifact validation failures, privileged policy changes
- **Correlation**: Multi-signal compromise sequences

---

## 10. Response Model

### Principles
- Proportional to risk
- Reversible when possible
- Tied to detection confidence

### Implemented Actions
- Rate limiting and step-up authentication
- Session revocation
- Download restriction
- Service disablement
- Route blocking
- Artifact quarantine
- Policy change restriction
- Multi-signal containment (combines multiple actions)

---

## 11. Incident Model

Each incident contains:
- Primary actor
- Related alerts
- Response actions
- Full timeline of events, detections, responses, and state transitions
- Status lifecycle: `open` → `investigating` → `contained` → `resolved` → `closed`
- Severity (escalates based on highest alert severity)
- Analyst notes

---

## 12. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.x |
| Persistence | In-memory primary + SQLite hybrid persistence |
| Auth | HMAC-SHA256 JWT (stdlib), PBKDF2 passwords, enforced on all protected routes |
| Testing | pytest (397 tests across 22 files), unittest |
| Containerization | Docker, docker-compose |
| CI | GitHub Actions |

---

## 13. Current Constraints and Limitations

### Implemented
- Full detection/response pipeline (10 rules, 10 playbooks, 6 scenarios)
- MITRE ATT&CK integration with coverage analysis
- Kill chain tracking
- Campaign correlation
- Risk scoring
- Exercise reporting
- SSE streaming
- JWT auth enforced on all 35 protected routes with RBAC
- PBKDF2-HMAC-SHA256 password hashing (260K iterations)
- JWT secret externalized via `JWT_SECRET` env var (enforced in production)
- Input validation on query parameters (ge/le constraints)
- Rate limiting on authentication endpoints (20 requests/60s per IP)
- Global exception handler (prevents stack trace leaks)
- Hybrid SQLite persistence with incremental entity writes
- Transaction boundary on pipeline writes (atomic entity persistence)
- Timezone-aware UTC datetimes throughout backend
- Frontend login page, AuthProvider, AuthGuard
- Frontend/backend API contract alignment
- Centralized serialization boundary
- Router-based route organization (16 APIRouter modules)
- Lifespan context manager (replaces deprecated on_event)

### Not Yet Implemented
- PostgreSQL persistence option
- Multi-worker / horizontal scaling support
- Machine learning detection
- Multi-tenant support
- Message queue / streaming pipeline

---

## 14. Key Architectural Decisions

- Modular monolith over premature microservices
- Event-driven core — events are the source of truth
- Deterministic detection over machine learning
- Auditability over early performance optimization
- Scenario-first validation approach
- Frozen dataclasses for immutable events and alerts
- In-memory primary store with hybrid SQLite persistence for durability without ORM complexity
- Incremental entity persistence to reduce snapshot overhead
- Explicit state classification (authoritative / derived / ephemeral)
- Centralized serialization layer to prevent field drift
- Platform user attribution on all mutating operations
- Router-based route organization for separation of concerns
- Service wiring centralized in `dependencies.py` to avoid circular imports
- PBKDF2 password hashing over plain-text storage
- JWT secret externalization with production enforcement
- Rate limiting on auth endpoints to mitigate brute-force attacks
