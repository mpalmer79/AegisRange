# AegisRange

AegisRange is a cybersecurity simulation platform that models how modern systems detect, contain, and explain adversary behavior across identity, data, and service boundaries.

## Overview

This project is not a vulnerability demo or exploit toolkit.

It is a defensive security platform design that demonstrates how a distributed environment:

- generates normalized telemetry
- detects suspicious behavior with deterministic rules
- applies controlled response actions
- constructs traceable incident timelines
- validates behavior through structured adversary scenarios

The goal is to show system-level security thinking, not just tool building.

## Core Concept

AegisRange simulates a realistic environment where:

- users authenticate and interact with protected resources
- documents carry classification and sensitivity context
- telemetry is generated for every meaningful action
- detections evaluate those events for suspicious patterns
- responses contain risk with bounded, explainable actions
- incidents unify events, detections, and responses into a single operational view

## What This Project Demonstrates

This project is designed to demonstrate:

- distributed security architecture
- threat modeling
- event schema design
- detection engineering
- controlled response orchestration
- incident lifecycle modeling
- scenario-driven validation
- production-minded deployment thinking

## Documentation Map

### Architecture
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md)

### Threats
- [THREAT_MODEL.md](THREAT_MODEL.md)

### Events and Telemetry
- [EVENT_SCHEMA.md](EVENT_SCHEMA.md)

### Detection
- [DETECTION_RULES.md](DETECTION_RULES.md)

### Response
- [RESPONSE_PLAYBOOKS.md](RESPONSE_PLAYBOOKS.md)

### Incidents
- [INCIDENT_MODEL.md](INCIDENT_MODEL.md)

### Validation
- [SCENARIOS.md](SCENARIOS.md)

## System Flow

The platform follows this core flow:

1. A user or system action occurs
2. A normalized event is generated
3. Detection rules evaluate the event stream
4. One or more alerts may be produced
5. Response playbooks may enforce containment
6. An incident may be created or updated
7. A full timeline can be reconstructed from the underlying evidence

## Initial Detection Coverage

The current design includes detection patterns for:

- repeated authentication failures
- suspicious login success after failures
- token reuse from conflicting origins
- unauthorized document access
- abnormal bulk document access
- read-to-download staging behavior
- unauthorized service identity behavior
- multi-signal compromise correlation

## Initial Response Coverage

The current design includes response playbooks for:

- rate limiting abusive authentication behavior
- step-up authentication
- session revocation
- restricted document access enforcement
- bulk access constraints
- download restriction
- service identity containment
- incident promotion and escalation

## Incident-Centric Design

AegisRange treats the incident as the primary system output.

An incident is not just an alert. It is a structured object that links:

- source events
- detections
- response actions
- severity and confidence
- affected resources
- timeline evidence

This makes the system explainable and audit-friendly.

## Deployment Intent

The platform is designed to evolve in phases:

### Phase 1
- modular monolith backend
- single frontend
- relational database
- deterministic detections
- bounded response actions
- one end-to-end scenario

### Future Phases
- stronger environment separation
- service decomposition
- richer observability
- expanded scenario coverage
- more advanced production hardening

## Current Status

The current repository focuses on system design and documentation.

Implemented in documentation so far:

- logical architecture
- deployment architecture
- threat model
- canonical event schema
- detection rules
- response playbooks
- scenario definitions
- incident model

Next focus areas include:
- repository structure cleanup
- build implementation plan execution
- first working vertical slice
- recruiter-facing demo narrative

## Why This Matters

Most cybersecurity portfolio projects stop at scripts, scanners, or isolated demos.

AegisRange is intentionally different.

It is built to show how a security platform thinks and operates as a system, including:

- what to observe
- what to detect
- how to respond
- how to preserve evidence
- how to explain the final incident outcome

## Author Intent

This project was created to demonstrate principal-level security thinking through:

- clear architectural boundaries
- realistic defensive workflows
- explainable detection logic
- controlled containment strategy
- operationally meaningful incident modeling

## Summary

AegisRange is a security platform design that demonstrates how systems detect, contain, and explain adversary behavior across distributed environments.

It is structured to reflect real engineering concerns around observability, threat detection, response control, and incident traceability.
