Phase 1 and Phase 2 are not complete yet. Rework them before moving on.

The following issues remain and must be fixed before Phase 3:

1. Frontend still stores auth tokens in localStorage in:
   - frontend/lib/api.ts
   - frontend/lib/auth-context.tsx

2. Protected document and identity flows still trust client-supplied actor identity/session context in:
   - backend/app/routers/documents.py
   - related request schemas and API client code

3. x_source_ip is still accepted from request headers and used directly in emitted events in:
   - backend/app/routers/identity.py
   - backend/app/routers/documents.py

4. Remaining datetime.utcnow deprecation usage still exists and warnings remain in test execution.

5. Shared mutable STORE is still too central. Tighten write-path discipline further where practical within the modular monolith.

Requirements:
- Stay in Phase 1/2 remediation only
- Fix the remaining trust-boundary and persistence-integrity gaps completely
- Show exact files changed
- Add or update tests proving each fix
- Re-run the full backend test suite
- Explain any tradeoffs clearly
- Do not start Phase 3