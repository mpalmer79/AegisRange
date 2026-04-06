# DEPLOYMENT_ARCHITECTURE.md

## Project Title
AegisRange: Adversary Emulation and Defensive Control Validation Platform

---

## 1. Purpose

This document defines the runtime and infrastructure deployment architecture for AegisRange.

While ARCHITECTURE.md defines the logical design of the system, this document defines:

- how the system is deployed
- where components run
- how network boundaries are enforced
- how environments are separated
- how production concerns are handled

The goal is to demonstrate not only how the platform works, but how it operates in a realistic environment.

---

## 2. Deployment Principles

### 2.1 Separation of Concerns
Logical modules and infrastructure components must remain clearly separated.

### 2.2 Environment Isolation
Development, staging, and production environments must not share:
- databases
- secrets
- runtime identities
- telemetry stores

### 2.3 Least Privilege
Each deployed component must have:
- only the permissions it needs
- limited network access
- scoped credentials

### 2.4 Defense in Depth
Security is enforced at multiple layers:
- ingress
- application
- identity
- service communication
- data storage

### 2.5 Observability by Default
Every deployed component must emit:
- logs
- metrics
- events
- health signals

### 2.6 Stateless Service Preference
Where possible, services should be stateless so they can:
- scale horizontally
- restart safely
- fail independently

---

## 3. Deployment Scope

AegisRange is designed to evolve through two deployment phases:

### Phase 1
- modular monolith backend
- single frontend
- single relational database
- local or simple cloud deployment

### Phase 2
- service decomposition
- isolated internal services
- managed telemetry pipeline
- stronger network segmentation
- production-grade runtime controls

This document describes the target deployment model while remaining grounded in what can be built incrementally.

---

## 4. Environment Model

### 4.1 Local
Purpose:
- development
- debugging
- schema validation
- scenario testing

Characteristics:
- local frontend
- local backend
- local database
- simplified secrets handling
- development logging only

### 4.2 Staging
Purpose:
- pre-production validation
- integration testing
- deployment verification
- scenario demonstration

Characteristics:
- production-like configuration
- isolated staging database
- real deployment workflows
- test-only secrets
- constrained public exposure

### 4.3 Production
Purpose:
- final demonstration environment
- portfolio-grade hosted deployment
- controlled public presentation

Characteristics:
- strict secret separation
- network segmentation
- managed database
- controlled ingress
- monitored runtime behavior

---

## 5. High-Level Deployment Topology

The target deployment topology is:

Public User
   |
   v
Frontend Hosting Layer
   |
   v
Public API Entry Point
   |
   v
Application Runtime Layer
   ├── Identity Domain
   ├── Document Domain
   ├── Telemetry Domain
   ├── Detection Domain
   ├── Response Domain
   ├── Incident Domain
   └── Scenario Domain
   |
   v
Private Data Layer
   ├── Relational Database
   └── Optional Cache / Queue Layer

---

## 6. Infrastructure Components

### 6.1 Frontend Hosting Layer
Responsibilities:
- serve web UI
- authenticate users
- communicate with backend API
- render incident, scenario, and telemetry views

Requirements:
- HTTPS enabled
- environment-based API configuration
- no direct database access
- no secrets embedded in client code

Possible deployment targets:
- Vercel
- Netlify
- static host with secure API routing

### 6.2 API Entry Layer
Responsibilities:
- receive public requests
- terminate TLS
- enforce request routing
- attach correlation metadata
- protect backend from direct exposure

Requirements:
- HTTPS only
- request validation
- rate limiting
- request logging
- security headers

Possible deployment targets:
- reverse proxy
- cloud application gateway
- container ingress layer

### 6.3 Application Runtime Layer
Responsibilities:
- execute business logic
- issue and validate sessions
- serve documents
- normalize telemetry
- evaluate detections
- orchestrate responses
- manage incidents
- execute scenarios

Requirements:
- environment-specific configuration
- scoped service secrets
- strong internal logging
- health endpoints
- controlled outbound network access

Possible deployment targets:
- single FastAPI app in Phase 1
- container platform
- VM or PaaS runtime

### 6.4 Data Layer
Responsibilities:
- persist events
- persist alerts
- persist incidents
- persist documents and metadata
- persist scenario run records

Requirements:
- private network access only
- backup capability
- role-based database access
- encryption at rest where available

Possible deployment targets:
- managed PostgreSQL
- self-hosted PostgreSQL in private network

### 6.5 Optional Cache / Queue Layer
Responsibilities:
- short-lived state
- response throttling support
- background processing support
- future event queue support

Requirements:
- private access only
- no public exposure
- ephemeral storage acceptable depending on purpose

Possible deployment targets:
- Redis
- managed in-memory store

---

## 7. Network Zones

### 7.1 Public Zone
Contains:
- frontend
- public API endpoint

Allowed traffic:
- inbound HTTPS from users
- outbound HTTPS to backend API or API gateway

Denied traffic:
- direct database access
- unrestricted internal service communication

### 7.2 Application Zone
Contains:
- backend runtime
- internal logical modules or future services

Allowed traffic:
- inbound from API entry layer
- outbound to data layer
- outbound to telemetry and monitoring endpoints

Denied traffic:
- arbitrary inbound public access
- unnecessary east-west traffic

### 7.3 Data Zone
Contains:
- PostgreSQL
- optional cache

Allowed traffic:
- inbound only from application zone
- admin access only through controlled path

Denied traffic:
- direct public access
- direct frontend access

---

## 8. Trust Boundaries In Deployment

### Boundary 1: User to Frontend
Primary concerns:
- browser security
- session handling
- client-side tampering

### Boundary 2: Frontend to API
Primary concerns:
- HTTPS enforcement
- request integrity
- authentication context

### Boundary 3: API Layer to Application Runtime
Primary concerns:
- origin trust
- request normalization
- throttling and abuse control

### Boundary 4: Application Runtime to Data Layer
Primary concerns:
- least-privilege database access
- query integrity
- data confidentiality

### Boundary 5: Internal Domain Boundaries
Primary concerns:
- future service identity
- internal access restrictions
- telemetry integrity

---

## 9. Environment Separation Requirements

Each environment must have separate:

- database instance or schema
- environment variables
- service credentials
- API endpoints
- scenario data
- logs and monitoring views

No staging environment may reuse production secrets.
No local environment may connect to production data.

---

## 10. Secret Management

### 10.1 Secret Types
- database credentials
- application signing secrets
- session encryption keys
- API tokens
- admin bootstrap credentials

### 10.2 Secret Handling Rules
- never commit secrets to source control
- never place secrets in frontend bundles
- rotate secrets when environments are rebuilt
- use environment variable injection or secret manager

### 10.3 Minimum Requirements
- separate secrets by environment
- separate secrets by service role
- revoke unused secrets immediately

---

## 11. Identity and Access Model

### 11.1 User Access
Users authenticate through the application identity domain and are granted scoped access according to role.

### 11.2 Administrative Access
Administrative access must be:
- restricted to designated roles
- protected by stronger authentication
- logged explicitly

### 11.3 Service Access
Future service decomposition should use:
- service-specific identities
- scoped credentials
- explicit trust relationships

---

## 12. Ingress and Egress Controls

### 12.1 Ingress Controls
Enforce:
- HTTPS only
- allowed hostnames
- rate limiting
- request size limits
- request validation

### 12.2 Egress Controls
Restrict outbound access from backend to:
- database
- monitoring endpoints
- optional trusted infrastructure services

The backend should not have unrestricted outbound internet access in a hardened deployment model.

---

## 13. Runtime Security Controls

### 13.1 Application Controls
- input validation
- session validation
- authorization enforcement
- structured error handling

### 13.2 Infrastructure Controls
- TLS termination
- network segmentation
- least-privilege runtime identities
- deployment artifact integrity

### 13.3 Data Controls
- private data access
- event immutability
- controlled admin paths
- incident evidence preservation

---

## 14. Availability and Failure Handling

### 14.1 Frontend Failure
Effect:
- UI unavailable
- backend may still function

Mitigation:
- static hosting reliability
- health checks
- redeployable frontend artifact

### 14.2 Backend Failure
Effect:
- detection, response, and UI APIs unavailable

Mitigation:
- restartable stateless runtime
- health probes
- isolated failure domains

### 14.3 Database Failure
Effect:
- event persistence stops
- incident and alert retrieval unavailable

Mitigation:
- backups
- connection retry logic
- graceful degradation for non-critical views

### 14.4 Partial Domain Failure
Effect:
- one subsystem, such as scenario execution or response orchestration, may degrade while others continue

Mitigation:
- modular boundaries
- isolated error handling
- explicit failure events

---

## 15. Scaling Model

### 15.1 Frontend Scaling
Frontend should be stateless and horizontally scalable.

### 15.2 Backend Scaling
Phase 1:
- single runtime instance acceptable

Future:
- multiple stateless backend instances behind load balancer
- shared database
- optional queue-backed asynchronous processing

### 15.3 Data Scaling
Initial deployment:
- single PostgreSQL instance

Future:
- read replicas
- archival event storage
- partitioned event tables

---

## 16. Deployment Pipeline Expectations

A mature deployment workflow should include:

- source control driven deployment
- environment-specific configuration
- automated tests before deployment
- schema migration handling
- rollback capability

Minimum CI expectations:
- markdown and documentation validation
- backend linting and tests
- frontend linting and tests
- environment variable validation

---

## 17. Logging, Metrics, and Health Signals

Every deployed component should expose:

### 17.1 Logs
- structured application logs
- error logs
- security-relevant state transitions

### 17.2 Metrics
- request count
- error rate
- detection count
- incident count
- response execution count

### 17.3 Health Signals
- liveness check
- readiness check
- dependency status

---

## 18. Portfolio-Grade Deployment Recommendation

For a realistic but manageable deployment, use:

### Frontend
- Vercel or Netlify

### Backend
- FastAPI deployed to a simple container or app platform

### Database
- managed PostgreSQL

### Secrets
- environment variables managed per environment

### Networking
- HTTPS only
- backend separated from database
- no direct public database access

This approach is strong enough to demonstrate production thinking without introducing unnecessary platform complexity.

---

## 19. Anti-Patterns

The deployment model must avoid:

- public database exposure
- shared secrets across environments
- frontend access to backend internals
- storing secrets in repository files
- assuming internal traffic is trusted
- deploying all components without environment isolation
- over-engineering microservices before runtime controls exist

---

## 20. Future Enhancements

Future deployment improvements may include:

- service decomposition into separate deployable units
- message queue for asynchronous event handling
- internal service mesh or identity layer
- dedicated telemetry pipeline
- managed secret store
- formal backup and recovery strategy
- zero trust service-to-service authentication

---

## 21. Summary

DEPLOYMENT_ARCHITECTURE.md defines how AegisRange runs in a realistic environment.

It extends the logical design into runtime reality by defining:

- environment separation
- network zones
- infrastructure boundaries
- secret handling
- availability expectations
- operational controls

Without deployment architecture, the project explains how the system works.

With deployment architecture, the project demonstrates how the system survives and operates like a real platform.
