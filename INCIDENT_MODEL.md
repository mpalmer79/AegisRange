# INCIDENT_MODEL.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines the incident model for AegisRange.

The incident model is the unifying layer of the system. It transforms:

- events
- detections
- response actions

into a structured, traceable, and explainable representation of a security event.

The incident is the primary output of the system.

---

## 2. Design Principles

### 2.1 Incident as a First-Class Object
An incident is not a log or alert. It is a structured entity that represents a security-relevant situation.

---

### 2.2 Event-Centric Construction
All incidents are built from events defined in EVENT_SCHEMA.md.

No derived state may exist without reference to source events.

---

### 2.3 Full Traceability
Every incident must allow reconstruction of:
- what happened
- when it happened
- why it was flagged
- how the system responded

---

### 2.4 Immutability of Evidence
Events linked to an incident must remain immutable.

Derived fields may evolve, but evidence must not change.

---

### 2.5 Deterministic Assembly
Incident creation and updates must follow explicit, repeatable rules.

---

## 3. Incident Definition

An incident is a structured aggregation of:

- correlated events
- triggered detections
- executed responses
- contextual metadata

It represents a bounded sequence of activity associated with a potential or confirmed threat.

---

## 4. Core Incident Schema

Each incident must include:

### 4.1 Identification
- incident_id: unique identifier (UUID)
- incident_type: classification of incident
- status: open, investigating, contained, resolved

---

### 4.2 Timing
- created_at: timestamp of incident creation
- updated_at: last update timestamp
- closed_at: optional resolution timestamp

---

### 4.3 Actor Context
- primary_actor_id: main entity associated with incident
- actor_type: user, service, system
- actor_role: privilege level

---

### 4.4 Correlation Context
- correlation_id: shared identifier across related events
- related_correlation_ids: optional additional groupings

---

### 4.5 Severity and Confidence
- severity: low, medium, high, critical
- confidence: low, medium, high
- risk_score: numeric aggregate value

---

### 4.6 Detection Data
- detection_ids: list of triggered detection rule IDs
- detection_summary: human-readable explanation

---

### 4.7 Response Data
- response_ids: executed response actions
- containment_status: none, partial, full

---

### 4.8 Evidence
- event_ids: all contributing event IDs
- timeline: ordered sequence of events and actions

---

### 4.9 Affected Resources
- affected_documents
- affected_sessions
- affected_services

---

## 5. Incident Lifecycle

### 5.1 Creation
An incident is created when:
- a high severity detection occurs
OR
- multiple correlated detections occur

---

### 5.2 Enrichment
The incident is updated as:
- new events are linked
- additional detections occur
- responses are executed

---

### 5.3 Escalation
Incident severity may increase when:
- additional detections are triggered
- sensitive assets are involved
- adversary behavior persists

---

### 5.4 Containment
Incident enters containment when:
- response actions restrict activity
- sessions are revoked or limited

---

### 5.5 Resolution
Incident is resolved when:
- threat activity stops
- risk is mitigated
- no further suspicious events occur

---

### 5.6 Closure
Incident is closed after:
- review is complete
- evidence is preserved
- final state is recorded

---

## 6. Timeline Model

Each incident contains a timeline composed of:

- source_event entries
- detection entries
- response entries
- state_transition entries

Each timeline entry includes:
- timestamp
- type
- reference_id
- summary

---

## 7. Correlation Logic

Events are linked to an incident through:

- matching correlation_id
- shared actor_id
- detection rule relationships
- temporal proximity

---

## 8. Incident Creation Rules

An incident must be created when:

- severity = critical
OR
- multiple high severity detections share correlation_id
OR
- detection rule explicitly requires incident creation

---

## 9. Incident Update Rules

An existing incident is updated when:

- new events match correlation criteria
- new detections reference existing incident context
- response actions are executed on related entities

---

## 10. Severity Model

Severity is determined by:

- detection severity
- asset sensitivity
- scope of activity
- number of affected resources

---

## 11. Confidence Model

Confidence reflects certainty of threat:

- low: weak signal or incomplete data
- medium: multiple indicators
- high: strong correlated evidence

---

## 12. Evidence Model

Evidence includes:

- raw events (immutable)
- detection outputs
- response actions

All evidence must:
- be linked by ID
- remain unchanged
- support replay and analysis

---

## 13. Incident Types

Examples include:

- credential_compromise
- session_hijack
- data_exfiltration
- policy_violation
- service_abuse

---

## 14. Anti-Patterns

The system must avoid:

- incidents without source events
- mutable evidence
- unbounded incident scope
- missing timeline entries
- orphan detections not linked to incidents

---

## 15. Future Enhancements

- cross-incident correlation
- automated incident merging
- analyst annotation support
- incident scoring refinement
- integration with external systems

---

## 16. Summary

The incident model is the central output of AegisRange.

It provides:

- a complete view of system activity
- traceability from event to response
- structured representation of threats

Without the incident model:
- detections are isolated
- responses lack context
- the system lacks cohesion

With the incident model:
- the system becomes a unified, explainable security platform
