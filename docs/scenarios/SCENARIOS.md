# SCENARIOS.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines adversary simulation scenarios used to validate AegisRange.

Scenarios demonstrate that the system can:

- generate realistic telemetry
- trigger detection rules
- execute response playbooks
- produce complete incident timelines

This is the validation layer of the system.

---

## 2. Design Principles

### 2.1 Behavior Over Exploits
Scenarios simulate adversary behavior patterns, not exploit payloads.

### 2.2 Deterministic Execution
Each scenario must produce consistent, repeatable results.

### 2.3 End-to-End Traceability
Each step must map to:
- events
- detections
- responses
- incident outcomes

### 2.4 Threat Alignment
Each scenario must align to defined threats in THREAT_MODEL.md.

---

## 3. Scenario Structure

Each scenario must include:

- scenario_id
- scenario_name
- description
- threats_addressed
- preconditions
- sequence_of_actions
- expected_events
- expected_detections
- expected_responses
- expected_incident_outcome
- evidence_produced
- failure_conditions

---

## 4. Scenario Definitions

---

## SCN-AUTH-001

### Name
Credential Abuse With Suspicious Success

### Description
Simulates repeated login failures followed by a successful authentication.

### Threats Addressed
- credential abuse
- account compromise

### Preconditions
- valid user account exists

### Sequence of Actions
1. multiple failed login attempts
2. successful login using correct credentials

### Expected Events
- authentication.login.failure (multiple)
- authentication.login.success

### Expected Detections
- DET-AUTH-001
- DET-AUTH-002

### Expected Responses
- PB-AUTH-001
- PB-AUTH-002

### Expected Incident Outcome
- alert created
- session flagged for step-up authentication

### Evidence Produced
- failure sequence
- success event
- source context

### Failure Conditions
- no detection triggered
- no response applied

---

## SCN-SESSION-002

### Name
Session Token Reuse Attack

### Description
Simulates reuse of a valid session token from conflicting origins.

### Threats Addressed
- session hijacking
- token theft

### Preconditions
- valid session token exists

### Sequence of Actions
1. user logs in normally
2. same token used from a different source

### Expected Events
- session.token.issued
- authorization events

### Expected Detections
- DET-SESSION-003

### Expected Responses
- PB-SESSION-003

### Expected Incident Outcome
- session revoked
- incident candidate created

### Evidence Produced
- session ID
- source IP conflict
- timing data

### Failure Conditions
- token reuse not detected

---

## SCN-DOC-003

### Name
Bulk Document Access

### Description
Simulates high-volume document access within a short time window.

### Threats Addressed
- data harvesting
- reconnaissance

### Preconditions
- user has document access

### Sequence of Actions
1. user accesses many documents rapidly

### Expected Events
- document.read.success

### Expected Detections
- DET-DOC-005

### Expected Responses
- PB-DOC-005

### Expected Incident Outcome
- download restriction applied
- alert generated

### Evidence Produced
- document count
- access timing
- actor ID

### Failure Conditions
- threshold not detected
- no restriction applied

---

## SCN-DOC-004

### Name
Read-To-Download Exfiltration Pattern

### Description
Simulates staged data exfiltration through read and download activity.

### Threats Addressed
- data exfiltration

### Preconditions
- user can read and download documents

### Sequence of Actions
1. read multiple documents
2. initiate downloads shortly after

### Expected Events
- document.read.success
- document.download.success

### Expected Detections
- DET-DOC-006

### Expected Responses
- PB-DOC-006

### Expected Incident Outcome
- download blocked
- session potentially revoked
- incident created

### Evidence Produced
- overlapping documents
- read/download timing

### Failure Conditions
- correlation not detected
- no containment action

---

## SCN-SVC-005

### Name
Unauthorized Service Access

### Description
Simulates service identity attempting unauthorized routes.

### Threats Addressed
- service misuse
- lateral movement

### Preconditions
- service identity exists

### Sequence of Actions
1. service attempts restricted routes
2. repeated access failures occur

### Expected Events
- authorization failures

### Expected Detections
- DET-SVC-007

### Expected Responses
- PB-SVC-007

### Expected Incident Outcome
- service disabled
- routes blocked

### Evidence Produced
- route attempts
- failure count

### Failure Conditions
- no detection triggered

---

## SCN-CORR-006

### Name
Multi-Signal Compromise Sequence

### Description
Combines multiple behaviors into a single coordinated attack sequence.

### Threats Addressed
- full compromise chain

### Preconditions
- multiple scenario components available

### Sequence of Actions
1. credential abuse
2. suspicious login
3. bulk document access
4. download staging

### Expected Events
- full event chain across categories

### Expected Detections
- DET-AUTH-001
- DET-AUTH-002
- DET-DOC-005
- DET-DOC-006
- DET-CORR-010

### Expected Responses
- PB-AUTH-002
- PB-DOC-006
- PB-CORR-010

### Expected Incident Outcome
- incident created
- strongest containment applied

### Evidence Produced
- full timeline
- correlated detection chain

### Failure Conditions
- detections not correlated
- incident not created

---

## 5. Scenario Execution Requirements

Each scenario must:

- generate a unique scenario_run_id
- assign a shared correlation_id across all events
- emit scenario.step.executed events
- emit scenario.run.completed event

---

## 6. Validation Checklist

Each scenario must confirm:

- events match EVENT_SCHEMA.md
- detections trigger correctly
- responses execute correctly
- incidents are created when expected
- timeline is complete and ordered

---

## 7. Metrics

Track for each scenario:

- detection success rate
- response success rate
- time to detect
- time to contain
- false positives

---

## 8. Future Enhancements

- randomized timing variations
- role-based behavior differences
- multi-scenario chaining
- external signal simulation

---

## 9. Summary

Scenarios validate that AegisRange works as a system.

They demonstrate:

- detection accuracy
- response effectiveness
- incident completeness

Without scenarios, the system is theoretical.

With scenarios, the system is proven.
