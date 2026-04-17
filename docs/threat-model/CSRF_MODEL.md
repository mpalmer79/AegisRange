# CSRF Model

This document defines how AegisRange protects state-changing requests
against Cross-Site Request Forgery (CSRF). It is a companion to
[THREAT_MODEL.md](./THREAT_MODEL.md) and should be consulted whenever a
new route is added or an existing exemption is reconsidered.

---

## 1. Why this matters

CSRF is only meaningful when the browser automatically attaches
credentials to an outbound request that the user did not consent to. In
AegisRange that credential is the `aegisrange_auth` httpOnly cookie. Any
route that trusts this cookie for authentication MUST therefore also
validate an accompanying CSRF token — otherwise an attacker can get the
victim's browser to perform state changes on their behalf by luring
them to a page that issues a cross-origin request.

Routes that never trust the cookie are not CSRF-vulnerable.

---

## 2. The three trust surfaces

AegisRange exposes three distinct authentication surfaces, and each has
a different relationship with CSRF.

### 2.1 Cookie surface (CSRF-protected)

Everything reached from the browser by an authenticated platform user:
dashboards, incidents, alerts, admin operations, scenario execution,
analytics, MITRE, kill chain, campaigns, reports.

- **Credential:** `aegisrange_auth` httpOnly cookie.
- **CSRF:** Enforced via the double-submit cookie pattern. The server
  issues a non-httpOnly `aegisrange_csrf` cookie on login; the client
  must echo the same value back via the `X-CSRF-Token` header on every
  state-changing (POST/PUT/PATCH/DELETE) request. The middleware
  compares the cookie and the header and rejects mismatches with 403.
- **Exemptions:** `/auth/login`, `/auth/logout`, `/health`. These are
  safe to exempt because `/auth/login` runs before the cookie exists,
  `/auth/logout` is idempotent teardown of the very cookie that CSRF
  would protect, and `/health` is unauthenticated.

### 2.2 Capability surface (not CSRF-protected)

The mission runtime under `/missions/*`. These routes are
anonymous-friendly: holding the `run_id` UUID in the URL IS the
capability. No cookie is trusted on this surface, so CSRF has nothing
to protect — the browser cannot forge a `run_id` it does not know.

- **Credential:** the `run_id` UUID embedded in the URL path.
- **CSRF:** Not applicable. The entire `/missions/*` prefix is exempt.
- **Why it's safe:** See `backend/app/routers/missions.py` — "No auth
  or role is required on `/missions/*`. Holding the `run_id` (a UUID)
  is the capability." Cookies are never consulted on these routes.

### 2.3 Bearer surface (not CSRF-protected)

CLI tools, test clients, and automated integrations that authenticate
via the `Authorization: Bearer <jwt>` header.

- **Credential:** JWT in the `Authorization` header.
- **CSRF:** Not applicable. Browsers never attach the `Authorization`
  header automatically; a cross-origin attacker cannot read the token
  from JS (it is not stored in a readable cookie or localStorage by
  the browser flow), so they cannot forge a request that carries it.
- **Exemption rule:** Any request whose `Authorization` header starts
  with `Bearer ` bypasses CSRF middleware, regardless of path.

---

## 3. Current exempt list (as of 0.9.0)

See `backend/app/main.py`:

```python
_CSRF_EXEMPT_PATHS = {
    "/auth/login",   # pre-auth: no cookie yet, CSRF model doesn't apply
    "/auth/logout",  # idempotent teardown of the cookie it depends on
    "/health",       # unauthenticated readiness probe
    "/missions",     # mission creation — capability-only surface
}
_CSRF_EXEMPT_PREFIXES = ("/missions/",)  # capability-based
```

Every entry is annotated in source with the reason for its exemption.

Prior to 0.9.0 the prefix list also contained `/scenarios/`. That
exemption was removed because `/scenarios/*` is a cookie-authed
surface (browser users with the `red_team` role run scenarios through
the UI), so it belongs on the cookie surface, not the capability
surface. See Section 1 of the 0.9.0 remediation pass.

---

## 4. Rule for adding a new exempt route

Adding a route to `_CSRF_EXEMPT_PATHS` or `_CSRF_EXEMPT_PREFIXES`
requires a threat-model review. The review must answer, in writing,
ALL THREE of the following:

1. **Does the route consult the `aegisrange_auth` cookie for
   authentication or authorization?** If yes, it cannot be exempt.
2. **Is there an alternative credential (capability token in URL,
   Bearer header, unauthenticated) that the route actually relies
   on?** If yes, name it.
3. **Can a cross-origin attacker forge a request that passes the
   alternative credential check?** If yes, the route must not be
   exempt.

If all three answers are "no / cookie-free / no," the exemption is
safe. Otherwise, the correct fix is usually one of:

- Accept the CSRF token on the existing surface (frontend sends it —
  this is already the default path in `frontend/lib/api.ts`).
- Move the route to a genuinely different surface (e.g. require
  Bearer auth for machine-to-machine callers and document that in
  the route's docstring).

**Do not** add a broad prefix exemption to unblock a single route.
Prefixes are dangerous precisely because they silently cover every
future route that shares the prefix.

---

## 5. Tests that pin this model

`backend/tests/test_security_hardening.py::TestCSRFProtection` contains
the executable form of this document:

- `test_cookie_auth_without_csrf_rejected` — cookie-authed POST to an
  admin route without a CSRF token returns 403.
- `test_cookie_auth_with_valid_csrf_accepted` — matching token passes.
- `test_csrf_mismatch_rejected` — wrong token returns 403.
- `test_cookie_auth_scenario_routes_require_csrf` — every
  `/scenarios/*` route enforces CSRF on the cookie surface.
- `test_cookie_auth_scenario_routes_accept_valid_csrf` — with a
  matching token, scenarios still run.
- `test_missions_prefix_remains_csrf_exempt` — `/missions/*` stays
  exempt under the capability model.
- `test_bearer_auth_bypasses_csrf_on_scenarios` — Bearer-authed
  requests are never blocked by CSRF regardless of path.

If any of these fail, the CSRF model has drifted and the fix belongs
in this document, not in the test.
