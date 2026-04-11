# AegisRange Architecture

## 1. What AegisRange Is

AegisRange is a defensive security simulation and validation platform. It is built to model how a modern security operations stack should ingest telemetry, evaluate deterministic detection rules, execute bounded response actions, and assemble an auditable incident record.

This platform is not an exploitation tool. Its purpose is to validate defensive controls, exercise detection coverage, and make security workflows explainable.

At its core, AegisRange answers four questions:

1. What happened
2. Why it mattered
3. What the system did in response
4. How an analyst can verify the decision trail

---

## 2. Product Scope

AegisRange is not trying to be a full SIEM, SOAR, EDR, or threat intel platform.

Its current product scope is narrower and more deliberate:

- simulate realistic security-relevant activity
- normalize that activity into a canonical event model
- run deterministic detection logic against those events
- trigger controlled response playbooks
- create and maintain auditable incidents
- expose coverage and exercise outcomes through reports and dashboards

The primary value of the platform is explainable defensive validation.

---

## 3. Architectural Priorities

The architecture is designed around five priorities.

### Explainability First
Every alert, response, and incident must be attributable to concrete system activity. The platform favors deterministic logic over opaque scoring or black-box inference.

### Auditability by Default
Security systems are only useful if their decisions can be reconstructed later. Events, detections, responses, notes, and incident state changes are treated as part of the audit trail.

### Clear Domain Boundaries
The system is organized as a modular monolith with explicit service boundaries. Each service owns a defined responsibility and communicates through orchestrated workflows rather than uncontrolled shared logic.

### Controlled Response
Response actions are intentionally bounded. AegisRange is designed to validate defensive controls, not perform destructive automation.

### Honest Operational Constraints
The current system is intentionally optimized for correctness and clarity within a single-process deployment model. It does not pretend to provide distributed guarantees it does not yet implement.

---

## 4. System Overview

AegisRange currently runs as a modular monolith with a Next.js frontend and a FastAPI backend.

### Topology

Frontend → FastAPI Backend → InMemoryStore → SQLite

### Current Deployment Shape

- Frontend: Next.js application
- Backend: FastAPI application
- Runtime model: single Uvicorn worker
- State model: in-memory operational store with SQLite persistence
- Authentication: JWT-based platform auth with RBAC
- Streaming: server-sent events for real-time updates

This is a deliberate MVP architecture. It prioritizes simplicity, traceability, and fast iteration over horizontal scale.

---

## 5. Core Domain Model

The system is organized around a simple but strict progression:

Event → Alert → Response → Incident

Each stage has a different responsibility.

### Event
A normalized record of something that happened in the system.

### Alert
A deterministic detection outcome derived from one or more events.

### Response
A bounded action taken because of an alert.

### Incident
A durable investigation object that groups related detections, responses, and timeline activity into one auditable record.

---

## 6. Service Architecture

The backend is organized as a set of domain services with explicit responsibilities.

- Identity Service: authentication simulation and session behavior
- Document Service: access control and policy enforcement
- Telemetry Service: event creation and normalization
- Detection Service: rule evaluation and alert generation
- Response Service: execution of response playbooks
- Incident Service: incident lifecycle and timeline management
- Pipeline Service: orchestration of event → detection → response → incident
- Scenario Service: adversary simulation
- Risk Service: actor risk scoring
- MITRE Service: ATT&CK mapping
- Kill Chain Service: stage attribution
- Campaign Service: incident correlation
- Report Service: analytics and summaries
- Stream Service: real-time updates
- Auth Service: platform security

---

## 7. Processing Flow

The system follows a deterministic processing pipeline:

1. Action occurs (user or scenario)
2. Event is generated and normalized
3. Event is persisted
4. Detection rules evaluate the event
5. Alerts are generated and deduplicated
6. Response playbooks execute
7. Incident is created or updated
8. Timeline is extended
9. Real-time updates are emitted

---

## 8. Detection Philosophy

AegisRange uses deterministic detection logic to prioritize explainability.

- rules are explicit
- thresholds are defined
- time windows are bounded
- contributing events are recorded
- severity and confidence are assigned intentionally

This design favors trust and debuggability over black-box behavior.

---

## 9. Response Philosophy

Responses are controlled and bounded.

- actions are tied to alerts
- actions are recorded
- actions are reversible when possible
- no hidden side effects

The goal is validation, not uncontrolled automation.

---

## 10. Incident Model

Incidents are the primary investigative object.

Each incident includes:

- identifier
- actor
- severity
- status
- detections
- responses
- timeline
- notes

Lifecycle:

open → investigating → contained → resolved → closed

All mutations must be persisted to ensure durability.

---

## 11. Persistence Model

The system uses a hybrid persistence approach.

### Runtime State
In-memory store for active operations.

### Durable State
SQLite for persistence.

### Strategy

Incremental persistence:
- events
- alerts
- responses
- incidents

Snapshot persistence:
- enforcement state
- risk profiles

This balances simplicity and durability for the MVP stage.

---

## 12. State Classification

Authoritative:
- events, alerts, responses, incidents, notes

Derived:
- counters, aggregates, signatures

Ephemeral:
- active sessions, in-process state

---

## 13. System Guarantees

Current guarantees:

- deterministic processing
- durable persistence of core entities
- reconstructable workflows
- auditable timelines

Non-guarantees:

- multi-worker consistency
- distributed coordination
- exactly-once delivery
- event replay

---

## 14. Constraints

- single-worker requirement
- in-memory coordination limits scaling
- SQLite is not horizontally scalable
- hybrid persistence can create minor drift on crash

These are known and accepted for the current stage.

---

## 15. Security Model

Platform security:

- JWT authentication
- hashed credentials
- RBAC
- protected routes
- token expiration

Simulation identity is separate from platform identity.

---

## 16. Observability

Current:

- persisted records
- incident timelines
- reports
- real-time updates

Future:

- structured logging
- metrics
- tracing
- failure tracking

---

## 17. Why Modular Monolith

Chosen for:

- clarity
- debuggability
- speed of iteration
- reduced complexity

Distribution will come later if justified.

---

## 18. Evolution Path

Near-term:
- improve explainability
- expose system reasoning
- strengthen persistence

Mid-term:
- externalize state
- introduce async processing
- improve observability

Long-term:
- selective service decomposition
- distributed architecture where needed

---

## 19. Summary

AegisRange models a complete defensive workflow:

simulate activity → detect → respond → investigate

The current architecture is a modular monolith optimized for:

- explainability
- auditability
- correctness
- iteration speed

Future work will focus on strengthening guarantees, observability, and scalability while preserving system clarity.