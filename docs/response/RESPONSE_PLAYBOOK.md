# RESPONSE_PLAYBOOKS.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines the response playbooks for AegisRange.

Response playbooks translate detections into controlled, auditable actions that:

- reduce risk
- limit adversary movement
- preserve evidence
- maintain system stability

The objective is not immediate disruption. The objective is **controlled containment with traceability**.

---

## 2. Response Design Principles

### 2.1 Contain Before Destroy
Prefer:
- session restriction
- step-up authentication
- temporary access control

Avoid irreversible actions unless confidence is high.

---

### 2.2 Proportional Response
Response strength must align with:
- detection severity
- detection confidence
- asset sensitivity

---

### 2.3 Reversibility
Whenever possible, actions must be:
- temporary
- auditable
- reversible

---

### 2.4 Evidence Preservation
No response should:
- overwrite source events
- destroy audit trails
- remove visibility

---

### 2.5 Deterministic Execution
Each response must:
- have defined triggers
- follow explicit logic
- produce consistent outcomes

---

## 3. Response Categories

- session control
- identity control
- data control
- service control
- observability actions

---

## 4. Response Structure

Each playbook includes:

- playbook_id
- playbook_name
- description
- triggering_rules
- preconditions
- actions
- escalation_conditions
- reversal_conditions
- audit_requirements

---

## 5. Response Playbooks

---

## PB-AUTH-001

### Name
Authentication Failure Containment

### Description
Limits repeated login attempts to reduce credential abuse.

### Triggering Rules
- DET-AUTH-001

### Preconditions
- failure threshold met
- no successful authentication yet

### Actions
- apply rate limiting to source
- increase actor risk score
- generate alert

### Escalation Conditions
- failures continue past secondary threshold
- multiple actors affected from same source

### Reversal Conditions
- rate limit expires after time window

### Audit Requirements
- log failure count
- log applied rate limit
- record source context

---

## PB-AUTH-002

### Name
Suspicious Login Containment

### Description
Responds to successful login following suspicious failure pattern.

### Triggering Rules
- DET-AUTH-002

### Preconditions
- successful authentication event
- prior failures detected

### Actions
- require step-up authentication
- mark session as elevated risk
- increase monitoring

### Escalation Conditions
- abnormal document access follows
- step-up authentication fails
- multiple suspicious sessions detected

### Reversal Conditions
- risk cleared after successful verification

### Audit Requirements
- log authentication sequence
- log challenge outcome
- record session state changes

---

## PB-SESSION-003

### Name
Session Hijack Containment

### Description
Responds to session token reuse across conflicting contexts.

### Triggering Rules
- DET-SESSION-003

### Preconditions
- session conflict detected
- high confidence signal

### Actions
- revoke session token
- require re-authentication
- generate incident candidate

### Escalation Conditions
- privileged session involved
- follow-on activity detected

### Reversal Conditions
- new session created through verified authentication

### Audit Requirements
- log session ID
- log source IPs
- record revocation action

---

## PB-DOC-004

### Name
Restricted Access Enforcement

### Description
Handles unauthorized attempts to access sensitive documents.

### Triggering Rules
- DET-DOC-004

### Preconditions
- classification mismatch detected

### Actions
- deny access
- generate alert
- increase monitoring

### Escalation Conditions
- repeated attempts
- multiple restricted resources targeted

### Reversal Conditions
- none (policy-based denial)

### Audit Requirements
- log document classification
- log actor role
- record access decision

---

## PB-DOC-005

### Name
Bulk Access Constraint

### Description
Limits excessive document access indicative of data harvesting.

### Triggering Rules
- DET-DOC-005

### Preconditions
- threshold exceeded

### Actions
- restrict download capability
- require step-up authentication
- increase telemetry collection

### Escalation Conditions
- continued access after restriction
- progression to download behavior

### Reversal Conditions
- restriction expires after defined interval

### Audit Requirements
- log access count
- record restriction duration
- track affected resources

---

## PB-DOC-006

### Name
Data Exfiltration Containment

### Description
Responds to read-to-download staging patterns.

### Triggering Rules
- DET-DOC-006

### Preconditions
- correlated read and download activity
- high confidence detection

### Actions
- block further downloads
- revoke session if necessary
- create incident immediately

### Escalation Conditions
- sensitive data involved
- repeated staging behavior

### Reversal Conditions
- analyst approval required

### Audit Requirements
- log document overlap
- record bytes transferred
- preserve event chain

---

## PB-SVC-007

### Name
Service Identity Containment

### Description
Handles unauthorized service-to-service access attempts.

### Triggering Rules
- DET-SVC-007

### Preconditions
- actor_type = service
- repeated unauthorized access

### Actions
- disable service identity
- block affected routes
- generate incident candidate

### Escalation Conditions
- multiple services targeted
- persistence after restriction

### Reversal Conditions
- manual review and re-enablement

### Audit Requirements
- log service identity
- log route attempts
- record enforcement action

---

## PB-ART-008

### Name
Artifact Quarantine

### Description
Prevents invalid or suspicious artifacts from propagating.

### Triggering Rules
- DET-ART-008

### Preconditions
- validation failure detected

### Actions
- quarantine artifact
- block processing
- increase supplier risk score

### Escalation Conditions
- repeated failures
- integrity mismatch patterns

### Reversal Conditions
- manual approval required

### Audit Requirements
- log artifact ID
- record validation results
- track submission attempts

---

## PB-POL-009

### Name
Privileged Change Control

### Description
Restricts high-risk configuration changes under suspicious conditions.

### Triggering Rules
- DET-POL-009

### Preconditions
- privileged change detected
- elevated risk context present

### Actions
- require re-authentication
- restrict further changes
- generate incident

### Escalation Conditions
- multiple changes
- sensitive policy modifications

### Reversal Conditions
- rollback after review

### Audit Requirements
- log previous and new values
- record actor context
- track change history

---

## PB-CORR-010

### Name
Multi-Signal Incident Containment

### Description
Aggregates multiple detections into a single incident and applies containment.

### Triggering Rules
- DET-CORR-010

### Preconditions
- multiple detections correlated

### Actions
- create incident
- apply strongest reversible containment
- escalate severity

### Escalation Conditions
- continued activity
- multiple assets affected

### Reversal Conditions
- analyst-driven resolution

### Audit Requirements
- log detection chain
- record incident creation
- preserve full timeline

---

## 6. Response Execution Model

When a detection triggers:

1. Identify matching playbook
2. Validate preconditions
3. Execute defined actions
4. Emit response events
5. Update incident if applicable

---

## 7. Response Event Output

Each action must generate an event containing:

- action_id
- playbook_id
- rule_id
- target_id
- status
- reason
- correlation_id
- timestamp

---

## 8. Anti-Patterns

The system must avoid:

- irreversible actions without high confidence
- silent response execution
- missing audit logs
- inconsistent enforcement logic
- overreaction to single weak signals

---

## 9. Future Enhancements

- adaptive response strategies
- policy-driven response tuning
- automated rollback validation
- cross-service containment coordination

---

## 10. Summary

Response playbooks convert detection into action.

They ensure that:

- threats are contained
- systems remain stable
- evidence is preserved
- decisions are traceable

A strong response layer transforms detection into a complete defensive system.
