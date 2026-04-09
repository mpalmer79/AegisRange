You are acting as a principal engineer and security-focused staff architect. Your job is to harden, refactor, and productionize this repository in phases until it reaches an A-level evaluation standard for architecture, security posture, correctness, deployment readiness, and engineering discipline.

You are not here to make shallow fixes. You are here to identify and close every meaningful gap.

Context:
This repo is a cybersecurity simulation / incident response platform with:
- FastAPI backend
- Next.js frontend
- SQLite-based persistence
- Railway intended for deployment
- Existing Docker-based deployment support
- Existing automated backend tests

Your mission:
1. Analyze the current repo before making changes.
2. Build and execute a phased remediation plan.
3. Address ALL known weaknesses listed below.
4. Improve architecture, security, deployment, testing, operability, and documentation.
5. Set the repo up for clean Railway deployment.
6. Only make changes that are justified and production-oriented.
7. Preserve working functionality while improving correctness and rigor.
8. Do not over-engineer into microservices. Keep this a disciplined modular monolith.
9. At the end of each phase, summarize:
   - what changed
   - why it changed
   - risks addressed
   - tests added/updated
   - what remains

Execution rules:
- Work in phases exactly as defined below.
- Complete one phase fully before starting the next.
- After each phase, stop and present:
  - files changed
  - key architectural decisions
  - commands/tests run
  - whether phase passed or failed
- Do not skip tests.
- Do not remove existing features unless they are insecure, dead, or unjustified.
- Prefer explicitness over magic.
- Prefer secure defaults over convenience.
- Prefer config-driven behavior over hardcoded values.
- Keep code readable and maintainable.
- Avoid decorative refactors that do not materially improve quality.
- If you discover additional weaknesses, include and fix them.
- Keep comments minimal and natural. No AI-style commentary.
- Do not use placeholders unless absolutely necessary. Implement real changes.
- If a migration is needed, implement it cleanly.

Primary weaknesses that MUST be addressed:
1. Hardcoded default JWT secret is unacceptable.
2. Auth token storage in localStorage is insecure.
3. CORS origins are hardcoded instead of fully config-driven.
4. Some APIs trust client-provided actor identifiers / actor roles instead of authenticated server-side identity.
5. x_source_ip or equivalent source identity headers are spoofable and currently trusted too much.
6. Password/auth handling is simulation-grade and needs stronger discipline.
7. No rate limiting / abuse protection.
8. No formal transaction model for multi-step incident pipeline mutations.
9. Excessive mutable shared singleton/global store behavior.
10. SQLite + current persistence approach is fragile for durability and concurrency.
11. Naive/deprecated datetime usage harms auditability.
12. Weak negative-path/adversarial/security testing.
13. Frontend verification is weaker than backend verification.
14. Frontend API client/types have drift and dead methods.
15. Inconsistent frontend data-fetching/error-handling patterns.
16. Limited accessibility and UX consistency discipline.
17. Deployment/configuration posture is not production-ready.
18. Secrets/config handling is too weak.
19. Documentation overstates maturity in places and may be stale.
20. README / deployment docs / architecture docs need to align with reality.
21. Railway deployment must be first-class and reproducible.
22. Repo should move from “strong portfolio demo” toward “serious, defensible platform.”

End-state target:
Bring the repo to an A-level standard in these categories:
- architecture
- backend engineering quality
- security trust boundaries
- persistence/data integrity
- testing/verification
- frontend discipline
- deployment/operability
- documentation

Output format expectations:
For each phase:
- Phase name
- Objectives
- Findings
- Planned changes
- Changes completed
- Tests run
- Result
- Remaining risks

Now execute the work in the following phases.

========================
PHASE 0: REPO AUDIT AND PLAN
========================

Goals:
- Inspect the full repo first.
- Map architecture, runtime paths, deployment paths, persistence paths, auth flow, and frontend-backend integration.
- Identify current build/test/deploy commands.
- Identify exact files responsible for:
  - auth
  - JWT issuance/validation
  - password handling
  - CORS
  - source IP extraction
  - role/actor handling
  - persistence/store mutation
  - incident pipeline orchestration
  - frontend token persistence
  - frontend API client
  - deployment configuration
- Identify where Railway deployment is currently incomplete or missing.
- Produce a concise but serious remediation plan before editing code.

Required output:
- A repo audit summary
- A prioritized risk list
- A file-by-file target plan
- Confirmation of whether railway.toml at repo root is necessary and, if useful, implement a clean approach

Rules:
- Do not edit files yet unless necessary to unblock inspection.
- Be honest about uncertainties.

========================
PHASE 1: SECURITY BOUNDARIES AND AUTH HARDENING
========================

Goals:
Close the most serious security and trust-boundary flaws first.

Required work:
1. Remove all insecure default JWT secret behavior.
   - In production, startup must fail if secret is missing or weak.
   - Development mode may allow a clearly-scoped local-only fallback if explicitly justified.
2. Refactor auth config to be environment-driven and centralized.
3. Stop trusting client-supplied actor identity, role, or privilege data in protected operations.
   - Derive actor/user identity from authenticated server context.
   - If actor metadata is needed for simulation scenarios, distinguish clearly between:
     - authenticated platform user identity
     - simulated entity metadata
4. Reduce trust in spoofable headers like x_source_ip.
   - Clarify what is trusted, what is observational only, and what cannot be security-authoritative.
5. Strengthen password/auth discipline.
   - Use sound password hashing and verification.
   - Review login/session logic for weak assumptions.
6. Add rate limiting or equivalent abuse protection to sensitive endpoints.
   - At minimum: login/auth endpoints and other high-risk routes.
7. Review RBAC enforcement paths and tighten where needed.
8. Validate and constrain incoming request models more aggressively.

Testing required:
- Auth success/failure tests
- Missing/weak secret startup behavior tests where appropriate
- RBAC enforcement tests
- Client-supplied role spoof attempt tests
- Source-IP spoofing negative tests
- Rate-limit tests or equivalent
- Invalid/malformed token tests

Success criteria:
- Trust boundary is materially stronger.
- No protected behavior depends on client-asserted privilege.
- Security config is no longer casual.

========================
PHASE 2: PERSISTENCE, TRANSACTIONS, AND DATA INTEGRITY
========================

Goals:
Make state mutation safer, more durable, and less fragile.

Required work:
1. Audit every production mutation path that changes:
   - incidents
   - alerts
   - events
   - notes
   - responses
   - risk scoring
   - timeline entries
2. Eliminate unsafe direct mutation patterns where persistence can be bypassed.
3. Introduce explicit write-path discipline.
   - Encapsulate mutations behind controlled store/service methods.
4. Design and implement a light transaction model for multi-step operations.
   - Example: event -> alert -> response -> incident chain
   - Ensure partial failures are handled consistently
5. Reduce shared mutable singleton/global behavior where reasonable.
   - Improve lifecycle and ownership of store/service state
6. Improve SQLite durability/concurrency posture within the repo’s current scope.
   - Stay pragmatic, but strengthen correctness
7. Normalize audit timestamps and persistence timestamps.
   - No naive/deprecated datetime usage
   - Use timezone-aware UTC
8. If schema/version handling is weak, introduce a simple migration/versioning approach.

Testing required:
- Durability tests
- Multi-step transaction consistency tests
- Failure injection tests for partial operations
- Timestamp correctness tests
- Concurrency-sensitive tests where practical
- Store boundary tests ensuring no mutation bypass

Success criteria:
- Persistence is no longer easy to accidentally bypass.
- Multi-step actions have explicit integrity behavior.
- Audit timestamps are reliable and consistent.

========================
PHASE 3: BACKEND ARCHITECTURE REFINEMENT
========================

Goals:
Improve code quality without breaking the modular monolith model.

Required work:
1. Reduce over-centralized orchestration where it creates brittleness.
2. Clarify service boundaries and domain responsibilities.
3. Improve dependency flow and remove unnecessary coupling.
4. Centralize configuration access patterns.
5. Tighten domain model consistency for:
   - incidents
   - telemetry/events
   - alerts
   - responses
   - users/auth
   - reports
6. Remove dead code, stale branches, and misleading abstractions.
7. Improve error handling consistency.
8. Ensure logs are structured enough to support debugging and ops.

Testing required:
- Existing tests must still pass
- New service-level tests for refactored paths
- Error-path tests

Success criteria:
- The backend becomes easier to reason about and safer to extend.
- Refactoring improves signal, not noise.

========================
PHASE 4: FRONTEND SECURITY, API DISCIPLINE, AND UX HARDENING
========================

Goals:
Bring the frontend up to the same engineering standard as the backend.

Required work:
1. Remove insecure localStorage-based auth token persistence if present.
   - Replace with a safer approach appropriate for this architecture.
   - If full cookie-based auth is too large a change, implement the safest realistic interim design and document tradeoffs.
2. Audit frontend API client layer.
   - Remove dead methods
   - Fix drift between frontend types and backend contracts
   - Standardize request/response handling
3. Standardize frontend error handling and data-fetching patterns.
4. Improve auth/session handling UX.
5. Improve accessibility basics:
   - labels
   - keyboard navigation
   - semantic structure
   - visible error states
6. Review route guards and protected UI flows.
7. Tighten environment/config usage on frontend.
8. Clean up dashboard/runtime inconsistencies.

Testing required:
- Frontend unit/component tests where present
- Add tests for auth/session behavior
- Add tests for API client behavior
- Add tests for error states
- Verify frontend build

Success criteria:
- Frontend is no longer the weak side of the platform.
- Auth flow, API integration, and UX behavior are more defensible.

========================
PHASE 5: DEPLOYMENT AND RAILWAY PRODUCTIONIZATION
========================

Goals:
Make deployment reproducible, realistic, and aligned with Railway.

Required work:
1. Audit current Dockerfiles and deployment assumptions.
2. Implement a clear Railway deployment model for this repo.
3. Determine whether repo should use:
   - one Railway project with separate frontend and backend services
   - root railway.toml
   - service-specific configuration
4. If railway.toml at root is helpful and valid for this architecture, create it.
   - Only do this if it improves reproducibility.
   - Do not add cargo-cult config.
5. Ensure backend deployment supports persistent storage for SQLite.
   - Railway volume strategy must be documented
   - DB path must be configurable
6. Ensure frontend/backend env vars are correct and documented.
7. Ensure CORS is aligned with Railway deployment model.
8. Add/startup health checks where useful.
9. Verify production startup behavior.
10. Improve operational readiness:
   - health endpoint validation
   - startup validation
   - secret/config checks
   - environment-specific behavior
11. If needed, add root-level deployment docs and service runbooks.

Railway-specific deliverables:
- Clean deployment instructions
- Required env vars list
- Volume/storage instructions for backend
- Frontend/backend service setup guidance
- Any railway.toml or service config files needed
- Explanation of tradeoffs

Testing/verification required:
- Verify backend container build
- Verify frontend build
- Verify service start commands
- Verify env-driven config works
- Verify health endpoints
- Verify Railway-specific instructions are accurate to repo structure

Success criteria:
- Someone can deploy this repo to Railway without guessing.
- Deployment guidance matches actual code.

========================
PHASE 6: TESTING EXPANSION AND QUALITY GATES
========================

Goals:
Raise confidence significantly.

Required work:
1. Expand negative-path tests across backend and frontend.
2. Add abuse-case and malformed-input coverage.
3. Add regression coverage for every important weakness fixed in earlier phases.
4. Strengthen CI assumptions if the repo includes CI.
5. Ensure frontend build/test verification is not secondary.
6. Add smoke-level deployment verification guidance where appropriate.

Focus areas:
- auth bypass attempts
- bad tokens
- invalid roles
- spoofed headers
- malformed payloads
- oversized params
- persistence failures
- transaction partial failures
- frontend auth edge cases
- API client contract mismatches

Success criteria:
- Test suite better reflects real failure modes.
- Security and integrity changes are protected against regression.

========================
PHASE 7: DOCUMENTATION TRUTHFULNESS AND A-GRADE FINISH
========================

Goals:
Make the repo honest, professional, and aligned with its real maturity.

Required work:
1. Rewrite README where necessary to match actual implementation.
2. Remove stale metrics and stale claims.
3. Clearly distinguish:
   - current production-readiness level
   - simulation capabilities
   - security posture
   - deployment assumptions
4. Update architecture docs to reflect final structure.
5. Add a “security posture and known limitations” section if warranted.
6. Add Railway deployment section.
7. Add local development section if missing/inaccurate.
8. Ensure repo tells the truth without underselling quality.
9. Produce a final grading self-assessment against these categories:
   - architecture
   - backend quality
   - security
   - persistence
   - testing
   - frontend
   - deployment
   - documentation

Success criteria:
- Documentation is accurate, current, and credible.
- Repo reads like serious engineering work, not inflated marketing.

========================
FINAL DELIVERABLES
========================

At the very end, provide all of the following:

1. Executive summary of what was improved
2. Complete list of weaknesses addressed
3. Files changed by phase
4. Important architectural decisions and tradeoffs
5. Railway deployment summary
6. Whether railway.toml was added and why
7. Remaining limitations
8. Final estimated grade by category
9. Final overall grade
10. Suggested next-phase roadmap after this remediation

Important constraints:
- Keep the platform a modular monolith.
- Do not turn this into a distributed system.
- Keep changes practical and portfolio-realistic.
- Favor robust implementation over cosmetic refactoring.
- Do not claim security guarantees you did not actually implement.
- Be skeptical and thorough.
- Raise concerns if any earlier design assumption is flawed.
- Where a decision involves tradeoffs, explain them clearly.

Begin with PHASE 0 only.