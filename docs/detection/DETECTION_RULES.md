# DETECTION_RULES.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines the detection logic used by AegisRange.

Detection rules convert normalized telemetry into actionable signals by:

- identifying suspicious patterns
- applying deterministic logic
- producing alerts with severity and confidence
- enabling downstream response actions

The goal is not anomaly guessing. The goal is **explicit, explainable detection**.

---

## 2. Design Principles

### 2.1 Deterministic Logic
All rules must:
- use explicit conditions
- avoid black-box or opaque logic
- be reproducible

---

### 2.2 Event-Driven Evaluation
Rules operate on:
- normalized events from EVENT_SCHEMA.md
- bounded time windows
- correlation-aware inputs

---

### 2.3 Explainability
Every rule must produce:
- reason for trigger
- contributing event IDs
- matched conditions

---

### 2.4 Bounded Scope
Rules must:
- define time windows
- define actor or session scope
- avoid unbounded aggregation

---

### 2.5 Severity and Confidence Separation
- severity reflects potential impact
- confidence reflects likelihood of correctness

---

## 3. Rule Structure

Each detection rule must include:

- rule_id
- rule_name
- description
- category
- required_event_types
- evaluation_window
- conditions
- severity
- confidence
- output_payload

---

## 4. Detection Categories

- authentication
- session
- document
- correlation
- system

---

## 5. Rule Definitions

---

## DET-AUTH-001

### Rule Name
Repeated Authentication Failure Burst

### Description
Detects multiple failed login attempts within a short time window.

### Category
authentication

### Required Events
- authentication.login.failure

### Evaluation Window
2 minutes

### Conditions
- number of failures ≥ 5
- same actor_id OR same source_ip

### Severity
medium

### Confidence
medium

### Output
- failure_count
- actor_id
- source_ip
- contributing_event_ids

---

## DET-AUTH-002

### Rule Name
Suspicious Success After Failure Sequence

### Description
Detects a successful login following repeated failures.

### Category
authentication

### Required Events
- authentication.login.failure
- authentication.login.success

### Evaluation Window
5 minutes

### Conditions
- ≥ 3 failures
- followed by 1 success
- same actor_id
- same or similar source context

### Severity
high

### Confidence
high

### Output
- failure_count
- success_event_id
- time_delta
- contributing_event_ids

---

## DET-SESSION-003

### Rule Name
Token Reuse From Conflicting Origins

### Description
Detects the same session token used from different locations within an unrealistic time window.

### Category
session

### Required Events
- session.token.issued
- authorization events

### Evaluation Window
5 minutes

### Conditions
- same session_id
- different source_ip or geographic context
- time difference below realistic travel threshold

### Severity
high

### Confidence
high

### Output
- session_id
- source_ip_list
- time_deltas
- contributing_event_ids

---

## DET-DOC-004

### Rule Name
Restricted Document Access Outside Role Scope

### Description
Detects access attempts to documents outside user authorization scope.

### Category
document

### Required Events
- document.read.success OR failure

### Evaluation Window
real-time

### Conditions
- document classification exceeds allowed role level

### Severity
high

### Confidence
high

### Output
- document_id
- classification
- actor_role
- contributing_event_ids

---

## DET-DOC-005

### Rule Name
Abnormal Bulk Document Access

### Description
Detects high-volume document access within a short time period.

### Category
document

### Required Events
- document.read.success

### Evaluation Window
5 minutes

### Conditions
- document read count ≥ 20
- same actor_id

### Severity
high

### Confidence
medium

### Output
- document_count
- actor_id
- time_window
- contributing_event_ids

---

## DET-DOC-006

### Rule Name
Read-To-Download Staging Pattern

### Description
Detects pattern where documents are read and then downloaded in sequence.

### Category
document

### Required Events
- document.read.success
- document.download.success

### Evaluation Window
10 minutes

### Conditions
- read count ≥ threshold
- followed by download count ≥ threshold
- overlapping document set

### Severity
critical

### Confidence
high

### Output
- read_count
- download_count
- overlapping_documents
- contributing_event_ids

---

## DET-SVC-007

### Rule Name
Unauthorized Service Identity Route Access

### Description
Detects service identity attempting unauthorized internal routes.

### Category
system

### Required Events
- authorization failures

### Evaluation Window
2 minutes

### Conditions
- repeated unauthorized attempts ≥ threshold
- actor_type = service

### Severity
high

### Confidence
medium

### Output
- service_id
- route_list
- failure_count
- contributing_event_ids

---

## DET-ART-008

### Rule Name
Artifact Validation Failure Pattern

### Description
Detects repeated submission of invalid artifacts.

### Category
system

### Required Events
- artifact.validation.failed

### Evaluation Window
10 minutes

### Conditions
- repeated failures ≥ threshold
- same actor or supplier

### Severity
medium

### Confidence
medium

### Output
- artifact_ids
- failure_count
- contributing_event_ids

---

## DET-POL-009

### Rule Name
Privileged Policy Change With Elevated Risk Context

### Description
Detects sensitive configuration changes under suspicious conditions.

### Category
system

### Required Events
- policy.change
- elevated risk indicators

### Evaluation Window
real-time

### Conditions
- privileged change
- actor has elevated risk score OR suspicious context

### Severity
critical

### Confidence
high

### Output
- policy_id
- previous_value
- new_value
- contributing_event_ids

---

## DET-CORR-010

### Rule Name
Multi-Signal Compromise Sequence

### Description
Correlates multiple detections into a single high-confidence compromise indicator.

### Category
correlation

### Required Events
- detection.rule.triggered (multiple types)

### Evaluation Window
15 minutes

### Conditions
- ≥ 3 distinct high or medium detections
- shared actor_id OR correlation_id

### Severity
critical

### Confidence
high

### Output
- detection_ids
- actor_id
- timeline_summary
- contributing_event_ids

---

## 6. Rule Execution Model

When an event is received:

1. Event is normalized
2. Relevant rules are selected
3. Conditions are evaluated
4. If matched:
   - alert is created
   - response orchestrator is notified
   - incident service may be triggered

---

## 7. Alert Output Model

Each detection produces:

- alert_id
- rule_id
- rule_name
- severity
- confidence
- correlation_id
- contributing_event_ids
- summary

---

## 8. Anti-Patterns

The system must avoid:

- vague rule definitions
- missing thresholds
- unbounded time windows
- relying solely on single events
- hidden or implicit logic

---

## 9. Future Enhancements

- dynamic thresholds
- baseline-aware detection
- cross-tenant correlation
- risk scoring refinement
- rule chaining optimization

---

## 10. Summary

Detection rules are the decision layer of AegisRange.

They transform telemetry into actionable signals by:

- applying explicit logic
- maintaining traceability
- enabling controlled response

Strong detection design ensures:
- accurate alerts
- explainable incidents
- reliable system behavior
