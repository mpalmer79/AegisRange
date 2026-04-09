Phase 1 and Phase 2 are still not complete. Do not move to Phase 3.

The following issues remain and must be fixed before proceeding:

1. Frontend still stores auth tokens in localStorage:
   - frontend/lib/api.ts
   - frontend/lib/auth-context.tsx

2. Protected document flows still trust client-supplied actor identity/session context:
   - backend/app/routers/documents.py
   - backend/app/schemas.py
   - any related frontend API payloads

3. x_source_ip is still accepted from request headers and passed directly into events:
   - backend/app/routers/documents.py
   - backend/app/routers/identity.py

4. Remaining datetime.utcnow deprecation usage still exists, as shown by test warnings:
   - tests/test_serializers.py::TestRiskProfileSerializer::test_fields
   - tests/test_serializers.py::TestAuthUserSerializer::test_fields

5. Shared mutable STORE is still too central. Tighten write-path discipline further where practical within the modular monolith.

Requirements:
- Stay in Phase 1/2 remediation only
- Fix these remaining trust-boundary and persistence-integrity gaps completely
- Show exact files changed
- Add or update tests proving each fix
- Re-run the full backend test suite
- Explain tradeoffs clearly
- Do not begin Phase 3
