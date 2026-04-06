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
Each domain is isolated with clear responsibilities:
- Identity
- Documents
- Telemetry
- Detection
- Response
- Incident Management

Even in a single backend service, boundaries are enforced logically.

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

## 3. System Topology

### 3.1 Phase 1 Architecture (Modular Monolith)

[Frontend - Next.js]
        |
        v
[API Gateway Layer]
        |
        v
[Backend Service (FastAPI)]
    ├── Identity Module
    ├── Document Module
    ├── Telemetry Module
    ├── Detection Engine
    ├── Response Orchestrator
    ├── Incident Service
    └── Scenario Engine
        |
        v
[PostgreSQL]

---

## 4. Core Components

### 4.1 API Gateway (Logical Layer)

Responsibilities:
- request routing
- correlation ID generation
- authentication context injection
- event emission trigger

### 4.2 Identity Service

Handles:
- authentication
- session creation
- session revocation
- step-up authentication

Emits:
- login success/failure
- token issuance
- session changes

### 4.3 Document Service

Handles:
- document listing
- read access
- download access
- classification enforcement

Emits:
- document read events
- document download events

### 4.4 Telemetry Service

Central event processor.

Responsibilities:
- normalize all events
- validate schema compliance
- persist events
- provide event lookup

### 4.5 Detection Engine

Evaluates events against rules.

Responsibilities:
- rule execution
- alert creation
- correlation tracking
- escalation triggers

Example detections:
- suspicious login after failures
- abnormal document access
- token reuse patterns

### 4.6 Response Orchestrator

Executes defensive actions.

Responsibilities:
- evaluate allowed responses
- enforce containment actions
- emit response events

Supported actions:
- step-up authentication
- session revocation
- download restriction

### 4.7 Incident Service

Builds the incident model.

Responsibilities:
- incident creation
- timeline assembly
- linking events, alerts, responses
- incident lifecycle management

### 4.8 Scenario Engine

Simulates adversary behavior.

Responsibilities:
- deterministic scenario execution
- event generation
- validation of detection/response pipeline

---

## 5. Data Flow

### 5.1 Normal Flow

1. User authenticates
2. Identity service emits auth event
3. Telemetry stores event
4. Detection engine evaluates
5. No alerts and system continues

### 5.2 Adversary Flow

1. Failed login attempts
2. Successful login
3. Rapid document access
4. Detection rules triggered
5. Alerts generated
6. Response actions executed
7. Incident created
8. Timeline assembled

---

## 6. Event Lifecycle

User Action
   ↓
Event Generated
   ↓
Telemetry Normalization
   ↓
Event Stored
   ↓
Detection Engine
   ↓
Alert Created
   ↓
Response Triggered
   ↓
Incident Updated

---

## 7. Detection Model

### Characteristics:
- rule-based
- windowed event analysis
- correlation-aware
- severity and confidence scoring

### Example Rule:
Suspicious Success After Failures:
- multiple failed logins
- followed by success within time window

---

## 8. Response Model

### Principles:
- proportional to risk
- reversible when possible
- tied to detection confidence

### Examples:
- require re-authentication
- revoke session
- restrict downloads

---

## 9. Incident Model

Each incident contains:
- primary actor
- related alerts
- response actions
- full timeline of events

Timeline entries:
- source_event
- detection
- response
- state_transition

---

## 10. Technology Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Backend
- FastAPI

### Data
- PostgreSQL

---

## 11. Phase 1 Constraints

### Included:
- authentication flow
- document access
- telemetry normalization
- three detections
- two responses
- one scenario
- incident timeline UI

### Excluded:
- microservices deployment
- machine learning detection
- multi-tenant support
- full admin dashboard

---

## 12. Future Expansion

### Phase 2 and beyond:
- distributed services
- streaming pipeline
- advanced correlation engine
- policy engine
- analytics dashboard
- AI-assisted explanations

---

## 13. Key Architectural Decisions

- modular monolith over premature microservices
- event-driven core
- deterministic detection over machine learning
- auditability over early performance optimization
- scenario-first validation approach

---

## 14. Definition of Done

The system is complete when:

A simulated adversary sequence triggers detection, enforces a response, and produces a fully traceable incident timeline.

---

## 15. Summary

AegisRange is not a tool.

It is a system-level demonstration of how modern cybersecurity platforms operate, emphasizing:

- observability
- detection engineering
- controlled response
- incident explainability
