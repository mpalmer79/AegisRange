# THREAT_MODEL.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines the threat model for AegisRange. It identifies:

- system assets and trust boundaries
- potential adversaries and capabilities
- attack surfaces and entry points
- threat scenarios mapped to system behavior
- defensive objectives for detection and response

The goal is not exhaustive enumeration. The goal is to demonstrate a structured, defensible understanding of how threats manifest in a distributed system.

---

## 2. Modeling Approach

AegisRange uses a hybrid approach combining:

- STRIDE-style reasoning for threat categories
- kill chain alignment for adversary progression
- asset-centric risk evaluation
- behavior-driven detection mapping

The emphasis is on:
- realistic adversary behavior
- observable system impact
- measurable defensive response

---

## 3. System Context

The system consists of:

- user-facing frontend
- Next.js proxy layer (API gateway equivalent)
- backend service modules
- persistent data store (SQLite with WAL mode)

Core domains:
- identity and session management
- document access and classification
- telemetry and event normalization
- detection and response pipeline
- incident management

---

## 4. Protected Assets

### 4.1 Identity Assets
- user credentials
- session tokens
- authentication state
- privilege levels

### 4.2 Data Assets
- documents
- classification metadata
- access history
- download activity

### 4.3 System Assets
- detection rules
- response policies
- incident records
- telemetry data

### 4.4 Integrity Assets
- event integrity
- correlation relationships
- audit trails
- system decision history

---

## 5. Trust Boundaries

### 5.1 External User Boundary
Between:
- user device
- frontend application

Risk:
- credential theft
- session hijacking
- malicious input

---

### 5.2 API Gateway Boundary
Between:
- client requests
- backend services

Risk:
- request manipulation
- identity spoofing
- injection attempts

---

### 5.3 Service-to-Service Boundary
Between:
- internal modules (identity, documents, telemetry, etc.)

Risk:
- implicit trust exploitation
- unauthorized internal access
- event forgery

---

### 5.4 Data Persistence Boundary
Between:
- application layer
- database

Risk:
- data tampering
- unauthorized reads
- integrity loss

---

### 5.5 Telemetry Integrity Boundary
Between:
- event generation
- event consumption

Risk:
- event suppression
- event injection
- correlation poisoning

---

## 6. Adversary Profiles

### 6.1 Opportunistic External Actor
Capabilities:
- credential guessing
- password reuse attacks
- automated login attempts

Goals:
- unauthorized access
- basic data retrieval

---

### 6.2 Targeted External Actor
Capabilities:
- credential harvesting
- session hijacking
- scripted interaction patterns

Goals:
- data exfiltration
- persistence
- stealth access

---

### 6.3 Insider Threat (Authorized User)
Capabilities:
- legitimate access
- knowledge of system behavior
- ability to bypass superficial controls

Goals:
- data exfiltration
- privilege misuse
- policy circumvention

---

### 6.4 Advanced Adversary (Simulated)
Capabilities:
- coordinated multi-step behavior
- blending into normal usage patterns
- exploiting trust relationships

Goals:
- sustained access
- large-scale data extraction
- detection evasion

---

## 7. Attack Surfaces

### 7.1 Authentication Surface
- login endpoint
- credential validation flow
- session issuance

Threats:
- brute force attempts
- credential stuffing
- replay attacks

---

### 7.2 Session Surface
- token usage
- session reuse
- concurrent access

Threats:
- token theft
- session replay
- conflicting origin access

---

### 7.3 Data Access Surface
- document read operations
- document download operations
- access patterns

Threats:
- bulk access
- staged exfiltration
- abnormal usage patterns

---

### 7.4 API Surface
- request parameters
- headers
- identity context

Threats:
- injection
- request manipulation
- privilege escalation attempts

---

### 7.5 Telemetry Surface
- event generation
- event transport
- event storage

Threats:
- missing telemetry
- forged events
- correlation disruption

---

## 8. Threat Scenarios

### 8.1 Suspicious Login Sequence

Description:
Multiple failed login attempts followed by a successful authentication.

Risk:
- credential compromise
- brute force success

Observable Signals:
- repeated login failures
- rapid success event

---

### 8.2 Session Reuse Across Contexts

Description:
A session token is used from multiple conflicting contexts.

Risk:
- session hijacking
- token leakage

Observable Signals:
- simultaneous access patterns
- conflicting origin indicators

---

### 8.3 Abnormal Document Access

Description:
A user accesses a large number of documents in a short time window.

Risk:
- data harvesting
- reconnaissance

Observable Signals:
- access rate anomalies
- deviation from baseline behavior

---

### 8.4 Staged Data Exfiltration

Description:
User reads multiple documents and initiates downloads shortly after.

Risk:
- deliberate extraction of sensitive data

Observable Signals:
- read-to-download correlation
- increasing access intensity

---

### 8.5 Insider Misuse

Description:
Authorized user performs actions outside expected usage patterns.

Risk:
- policy abuse
- unauthorized data access

Observable Signals:
- access pattern deviation
- unusual timing or volume

---

## 9. Threat to Detection Mapping

| Threat Scenario                  | Detection Strategy                          |
|---------------------------------|--------------------------------------------|
| Suspicious login sequence        | failure-to-success correlation             |
| Session reuse                    | token context conflict detection           |
| Abnormal document access        | access rate threshold                      |
| Staged exfiltration             | read-to-download pattern detection         |
| Insider misuse                  | behavioral deviation rules                 |

---

## 10. Threat to Response Mapping

| Threat Scenario           | Response Action                     |
|--------------------------|------------------------------------|
| Credential compromise    | step-up authentication             |
| Session hijacking        | session revocation                 |
| Bulk access              | download restriction               |
| Data exfiltration        | access throttling                  |
| Insider misuse           | monitoring escalation              |

---

## 11. Defensive Objectives

The system must:

- detect suspicious behavior early
- correlate multi-step activity
- apply proportional containment actions
- preserve auditability of all decisions
- maintain integrity of telemetry

---

## 12. Assumptions

- system operates in a controlled simulation environment
- authentication is simplified but representative
- network-level attacks are not primary focus in Phase 1
- adversary behavior is modeled, not executed

---

## 13. Limitations

- no advanced persistent threat modeling in Phase 1
- no real-time distributed correlation engine
- no machine learning anomaly detection
- limited identity federation complexity

---

## 14. Future Enhancements

- multi-tenant threat modeling
- cross-service identity propagation
- advanced correlation across services
- adaptive detection strategies
- integration with real-world telemetry sources

---

## 15. Summary

This threat model defines a realistic and structured view of how adversaries interact with a system.

AegisRange focuses on:

- observable behavior over theoretical risk
- detection aligned with real activity
- response tied to confidence and severity
- complete traceability from event to incident

The result is a system that demonstrates not just awareness of threats, but the ability to detect and respond to them in a controlled, explainable way.
