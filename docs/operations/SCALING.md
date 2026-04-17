# SCALING.md — horizontal scalability design

**Status:** Phase 1 **shipped in 0.10.0**. Phases 2–5 remain design. This document records the original 0.9.0 decision and tracks progress against it.

---

## 1. Where we are today

As of 0.9.0, AegisRange runs as a single Uvicorn worker backed by SQLite in WAL mode. The in-memory `STORE` singleton is the authoritative runtime data source; SQLite is the durable backing store.

Specifically:
- Every state-mutating request runs through a `STORE.transaction()` context (see `ARCHITECTURE.md` §11).
- After each successful mutation, the request middleware in `main.py` calls `STORE.save()` to snapshot operational state (containment sets, risk profiles, blocked routes).
- Every 100 requests, the middleware calls `STORE.prune_expired_revocations()` to bound the JTI deny-list.
- Mission runs have their own table and are upserted inside `MissionStore.put()`.

This is correct for one worker. It is not safe for two.

- **Concurrent writers on one SQLite file:** WAL handles short transactions well, but our "snapshot operational state after every write" pattern rewrites whole sets on every mutation. Under two workers this produces a flap: worker A writes its view of `revoked_sessions`; worker B overwrites it with its (possibly stale) view. Whichever worker committed last wins.
- **Forked in-memory state:** Each worker keeps its own `InMemoryStore`. If worker A revokes a JWT (adds to `revoked_jtis`) and worker B handles the next request carrying that JWT, B has no record of the revocation and will accept the token.
- **TOTP enrollment:** A TOTP secret written by worker A is not visible to worker B until it restarts and reloads from SQLite.
- **Rate limiter:** `InMemoryRateLimiter` is explicitly documented as process-local. Two workers effectively double the rate limit.

Upshot: we cannot meaningfully run two workers today, and the Dockerfile enforces one.

---

## 2. What must be answered

Three questions, in order:

1. **Where does authoritative state live?**
2. **How does in-memory state stay consistent across workers?**
3. **What is the migration path from the current design?**

---

## 3. Option survey

### 3.1 Stay on SQLite, serialize all writes

- **Authoritative state:** SQLite, single writer.
- **Consistency:** Every worker reads through the DB on every read that depends on operational state (revocations, containment).
- **Pros:** Smallest change; keeps the file-based demo story intact.
- **Cons:** SQLite writes are a global lock. With N workers, write throughput is effectively one-at-a-time. The current pattern of "rewrite the whole containment set on every mutation" becomes the bottleneck. The in-memory cache becomes a read-through cache that has to be invalidated on every write — equivalent to not having a cache.
- **Verdict:** Adequate up to very low concurrency (single-digit RPS). Not a real multi-worker story.

### 3.2 Postgres as authoritative, Redis for fast auth lookups

- **Authoritative state:** Postgres for entities (events, alerts, incidents, notes, scenario_history) and for the user / TOTP tables.
- **Consistency:** Redis for JTI revocations and rate limits — anything that must be checked on every request path. TTLs are native in Redis, which matches how the JTI deny-list already works.
- **Pros:** Real multi-worker story. Postgres gives us row-level locking, transactions, and `LISTEN/NOTIFY` if we ever want cache invalidation. Redis is the right tool for ephemeral-but-shared state.
- **Cons:** Two new runtime dependencies. Railway can provision both, so deployment complexity is acceptable, but local dev gets a compose file. Migration from SQLite is one-shot but real work.
- **Verdict:** The target. This is the direction we choose.

### 3.3 Event-sourced rebuild per worker

- **Authoritative state:** An append-only log (SQLite `events` table already exists).
- **Consistency:** Each worker replays the log to rebuild its in-memory state on startup, and subscribes to subsequent appends.
- **Pros:** Matches the existing "events are authoritative, everything else is derived" data model (see `ARCHITECTURE.md` §12).
- **Cons:** Derived state reconstruction is slow for a cold worker. The JTI deny-list and rate limiter still need a shared store. This gives us scalability of read-only derived views, not of writes.
- **Verdict:** Not chosen as the primary path, but overlaps with 3.2 because our entity model is already event-sourced in spirit. We'll lean on it for derived views if we need to.

---

## 4. Decision

**Chosen direction: Postgres for authoritative state, Redis for ephemeral shared cache.**

The phased plan below is additive: at no point does the system stop working, and every phase is a single ship-ready PR.

---

## 5. Migration plan

### Phase 1 — Abstract the auth/rate-limit cache (**shipped in 0.10.0**)

Currently `InMemoryStore` holds three things that are checked on every request: `revoked_jtis`, `totp_secrets`, `totp_enabled`. Plus the rate limiter already has a swappable interface.

- ✅ `AuthCache` protocol defined in `app/services/auth_cache.py` with `is_jti_revoked`, `revoke_jti`, `prune_expired_revocations`, `totp_secret_for`, `set_totp_secret`, `clear_totp_secret`, `is_totp_enabled`, `enable_totp`, `disable_totp`, `all_revoked_jtis` / `load_revoked_jtis`, `all_totp_secrets` / `all_totp_enabled` / `load_totp_state`.
- ✅ `InMemoryAuthCache` — default implementation. Accepts optional backing dict/set references so `InMemoryStore` can share state with the cache (legacy direct-attribute access stays coherent with cache reads).
- ✅ `RedisAuthCache` — opt-in via the `REDIS_URL` env var. JTI revocations use Redis's native TTL (`SET ... EX`) so pruning is automatic.
- ✅ `build_auth_cache(redis_url)` factory with graceful fallback to in-memory when Redis is unreachable.
- ✅ `InMemoryStore.revoke_jti`, `is_jti_revoked`, `prune_expired_revocations` now delegate through the configured cache.
- ✅ `PersistenceLayer.load()` routes TOTP + JTI restore through `auth_cache.load_revoked_jtis` / `load_totp_state`.
- ✅ `tests/test_auth_cache.py` — 18 in-memory contract cases plus an opt-in Redis suite (`AEGISRANGE_TEST_REDIS_URL=redis://…` to run).

Test gate: met — `test_auth_hardening.py::TestJTIRevocation` and `test_totp.py` pass unchanged, and the new contract tests exercise both implementations against the same protocol.

Still single-worker by default. Two-worker deployments can opt in by setting `REDIS_URL`. The remaining rate-limiter flip to Redis is Phase 4.

### Phase 2 — Dual-write entities to Postgres (0.10.0 or 0.11.0)

- Add `DATABASE_URL` env var. If unset, fall back to SQLite (current behavior preserved).
- Implement `PostgresPersistenceLayer` with the same write interface as `PersistenceLayer` (events, alerts, responses, incidents, notes, scenario history, mission runs). Use SQLAlchemy Core or asyncpg — no ORM, stay close to the SQL.
- During a transition window, writes go to both layers; reads still come from SQLite. This lets us validate the Postgres writes against a known-good baseline.

Test gate: `test_persistence.py` round-trip suite runs against both backends.

### Phase 3 — Cut reads over to Postgres

- Flip reads to Postgres for the entity tables. Remove the dual-write after one release.
- Retire SQLite as a runtime dependency. (Keep the layer code for local dev — a developer can still point at SQLite if they don't want Postgres.)

### Phase 4 — Drop the in-memory singleton for multi-worker data

- The `InMemoryStore` becomes a per-worker *index* (secondary `_events_by_actor` etc.) over Postgres. It is still rebuilt from the DB on startup. It is NOT authoritative.
- All writes go through Postgres transactions. The "snapshot operational state after every write" middleware hook goes away: containment sets become regular tables with row-level inserts.
- The rate limiter flips from `InMemoryRateLimiter` to `RedisRateLimiter` in production. Dev stays on in-memory.

Test gate: integration test that brings up two workers behind a tiny reverse proxy and asserts a JWT revoked by worker A is rejected by worker B on the very next request.

### Phase 5 — Delete single-worker guardrails

- Dockerfile no longer enforces `--workers 1`.
- `ARCHITECTURE.md` §14 (scaling constraints) rewritten to reflect the new topology.

---

## 6. Non-decisions

These are explicitly out of scope for 0.9.0–0.11.0:

- **Sharding.** One Postgres instance is enough for the target load (interactive SOC demos + CI runs). If we ever approach 100k events per hour per tenant, revisit.
- **Cross-region replication.** Same reason. No stated requirement.
- **Distributed tracing.** Listed as "future" in `ARCHITECTURE.md` §16. It will land after Phase 4 so we have meaningful multi-worker hops to trace.
- **Event-sourced rebuild for ALL derived views.** Option 3.3 stays on the shelf as a technique for specific views that benefit from it (e.g. campaign detection), not as the top-level architecture.

---

## 7. What this document commits to

Read this as a contract for the next two releases:

- 0.9.0 shipped this document. No code changes.
- **0.10.0 shipped Phase 1** (AuthCache abstraction + Redis implementation). Opt-in via env.
- 0.11.0 ships Phases 2–3 (Postgres authoritative). Fallback to SQLite for dev.
- 0.12.0 ships Phase 4 (multi-worker) and deletes the single-worker guardrails.

Deviation from this plan is allowed, but only by editing this document in the same PR that breaks from it. Drift without documentation is how architectures die.
