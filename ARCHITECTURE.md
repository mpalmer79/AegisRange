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
        v (HTTP/SSE)
[Backend Service (FastAPI)]
    ├── Identity Module
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
[In-Memory Store ←→ SQLite (write-through cache)]
```

**Current persistence**: All state lives in `InMemoryStore` at runtime. A SQLite write-through cache (`persistence.py`) saves state after every mutating HTTP request and reloads on startup. State survives restarts but is not designed for concurrent multi-process writes.

**Current authentication**: `auth_service.py` implements JWT creation/verification (HMAC-SHA256), 5 roles (admin, soc_manager, analyst, red_team, viewer), and a `require_role()` FastAPI dependency. All 35 protected routes enforce `require_role()`. Public endpoints: `/health`, `/auth/login`. Frontend has login page, AuthProvider context, and AuthGuard redirect.

### 3.2 Service Inventory (15 services)

| Service | File | Status |
|---------|------|--------|
| IdentityService | `identity_service.py` | Active — simulated auth for threat actors |
| DocumentService | `document_service.py` | Active — role-based document access |
| TelemetryService | `event_services.py` | Active — event storage and lookup |
| DetectionService | `detection_service.py` | Active — 10 detection rules |
| ResponseService | `response_service.py` | Active — 10 response playbooks |
| IncidentService | `incident_service.py` | Active — incident lifecycle management |
| PipelineService | `pipeline_service.py` | Active — event-to-incident orchestration |
| ScenarioService | `scenario_service.py` | Active — 6 adversary simulations |
| RiskService | `risk_service.py` | Active — actor risk scoring |
| MitreAttackService | `mitre_service.py` | Active — TTP mapping and coverage |
| KillChainService | `killchain_service.py` | Active — kill chain stage tracking |
| CampaignService | `campaign_service.py` | Active — cross-incident correlation |
| AuthService | `auth_service.py` | Active — JWT + RBAC enforced on all routes |
| ReportService | `report_service.py` | Active — exercise report generation |
| StreamService | `stream_service.py` | Active — SSE subscriber management |

### 3.3 Service Wiring

All services are instantiated at module level in `main.py` and wired together through constructor injection. The `InMemoryStore` singleton is shared across services that need persistence. Services do not communicate through the store — they are composed through the `PipelineService` which orchestrates the event-detection-response-incident flow.

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
- persist events in memory
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

Each playbook produces `ResponseAction` records.

### 4.6 Pipeline Service

Orchestrates the full flow: event → detection → response → incident.

When an event is ingested:
1. Store in telemetry
2. Run all detection rules
3. For each alert, execute matching response playbook
4. Create or update incident with timeline entries

### 4.7 Incident Service

Builds the incident model. Each incident contains:
- primary actor
- related alerts
- response actions
- full timeline of events
- status lifecycle (open → investigating → contained → resolved)
- severity escalation
- analyst notes

### 4.8 Scenario Engine

6 deterministic adversary simulations that exercise the full pipeline. Each scenario injects a controlled sequence of events through the identity and document services, triggering detections and responses.

### 4.9 Risk Scoring Service

Computes per-actor risk profiles based on:
- alert severity weights
- detection confidence multipliers
- accumulated behavioral signals

### 4.10 MITRE ATT&CK Service

Maps all 10 detection rules to MITRE ATT&CK techniques and tactics. Provides:
- rule-to-TTP mappings
- coverage matrix showing covered vs uncovered techniques
- tactic-level coverage percentages
- scenario-to-TTP resolution
- alert enrichment with MITRE context

### 4.11 Auth Service

Implements:
- JWT token creation/verification (HMAC-SHA256)
- 5 roles: admin, soc_manager, analyst, red_team, viewer
- 5 default users with role assignments
- `require_role()` FastAPI dependency for route protection
- Role hierarchy with numeric levels

**Current state**: Enforced on all 35 protected routes. Public endpoints: `/health`, `/auth/login`. 19 auth enforcement tests verify 401/403 behavior.

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
Event Stored (in-memory list)
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
| `ResponseAction` | Frozen dataclass | action_id, playbook_id, action_type, target_actor, executed_at, details |
| `TimelineEntry` | Frozen dataclass | timestamp, entry_type, source_id, summary |
| `Incident` | Mutable dataclass | correlation_id, primary_actor_id, alerts, responses, timeline, status, severity |
| `Severity` | Enum | low, medium, high, critical |
| `Confidence` | Enum | low, medium, high |

### 7.2 Persistence Model

All data is stored in `InMemoryStore` (singleton) at runtime. Key collections:

- `events: list[Event]`
- `alerts: list[Alert]`
- `responses: list[ResponseAction]`
- `incidents_by_correlation: dict[str, Incident]`
- `risk_profiles: dict[str, RiskProfile]`
- Various tracking dicts for login failures, document reads, session state

A `PersistenceLayer` (`persistence.py`) provides SQLite write-through caching:
- **Save**: Serializes all store state to SQLite tables after every mutating HTTP request (POST/PATCH/DELETE with status < 400)
- **Load**: Restores full state from SQLite on startup
- **Clear**: Drops all SQLite data on `POST /admin/reset`
- Disabled in test environment (`APP_ENV=test`)

The `reset()` method clears SQLite, reinitializes all collections, and preserves the persistence reference.

---

## 8. Detection Model

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

## 9. Response Model

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

## 10. Incident Model

Each incident contains:
- Primary actor
- Related alerts
- Response actions
- Full timeline of events, detections, responses, and state transitions
- Status lifecycle: `open` → `investigating` → `contained` → `resolved`
- Severity (escalates based on highest alert severity)
- Analyst notes

---

## 11. Technology Stack

### Current Implemented Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.x |
| Persistence | In-memory + SQLite write-through cache |
| Auth | PyJWT (HMAC-SHA256), enforced on all protected routes |
| Testing | pytest (281 tests across 19 files), unittest |
| Containerization | Docker, docker-compose |
| CI | GitHub Actions |

---

## 12. Current Constraints

### Implemented
- Full detection/response pipeline (10 rules, 10 playbooks, 6 scenarios)
- MITRE ATT&CK integration with coverage analysis
- Kill chain tracking
- Campaign correlation
- Risk scoring
- Exercise reporting
- SSE streaming
- JWT auth enforced on all 35 protected routes with RBAC
- SQLite write-through persistence
- Frontend login page, AuthProvider, AuthGuard
- Frontend/backend API contract alignment (alias fields)

### Not Yet Implemented
- PostgreSQL persistence option
- Rate limiting
- Input validation on query parameters
- Microservices deployment
- Machine learning detection
- Multi-tenant support
- Message queue / streaming pipeline

---

## 13. Target-State Architecture

The following represents the intended evolution of the platform. These items are designed but not yet built.

### 13.1 Target Topology

```
[Frontend - Next.js]
        |
        v
[Reverse Proxy (TLS termination)]
        |
        v
[Backend Service (FastAPI)]
    ├── All current services
    ├── require_role() enforced on routes  ← DONE
    └── Rate limiting middleware
        |
        v
[PostgreSQL (production) / SQLite (dev)]  ← SQLite DONE
```

### 13.2 Planned Enhancements
- PostgreSQL persistence option for production deployments
- Rate limiting middleware
- Input validation hardening on query parameters
- Streaming pipeline for asynchronous event processing
- Advanced correlation engine with temporal pattern matching
- Policy engine for externalized detection/response policies
- AI-assisted detection explanations

---

## 14. Key Architectural Decisions

- Modular monolith over premature microservices
- Event-driven core — events are the source of truth
- Deterministic detection over machine learning
- Auditability over early performance optimization
- Scenario-first validation approach
- Frozen dataclasses for immutable events and alerts
- In-memory persistence with SQLite write-through for durability without ORM complexity

---

## 15. Summary

AegisRange is a system-level demonstration of how modern cybersecurity platforms operate, emphasizing:

- observability
- detection engineering
- controlled response
- incident explainability
- threat intelligence integration (MITRE ATT&CK)
- kill chain analysis
- campaign correlation

The platform currently implements 15 services, 38 API endpoints, 10 detection rules, 10 response playbooks, and 6 adversary simulations with 281 automated tests across 19 test files. Persistence uses an in-memory store with SQLite write-through caching. JWT authentication is enforced on all 35 protected routes with role-based access control.
