"""Pluggable cache for ephemeral auth state.

0.9.0's ``docs/operations/SCALING.md`` identified three data points that
must be consistent across workers before AegisRange can run with more
than one Uvicorn worker:

- JWT revocations (``jti`` deny-list with TTL)
- TOTP secrets (per-user)
- TOTP enrollment state (per-user boolean)

All three currently live inside :class:`~app.store.InMemoryStore`, which
is process-local. This module introduces the :class:`AuthCache`
protocol and two implementations so the storage backend can be swapped
without touching the call sites:

- :class:`InMemoryAuthCache` — current behavior, zero new dependencies.
  Used by default in development / test and single-worker production.
- :class:`RedisAuthCache` — opt-in, gated on the ``REDIS_URL`` env var.
  Enables multi-worker deployments to share the same ephemeral state.

Phase 1 of the scaling plan: introduce the abstraction and ship the
Redis implementation as opt-in. Phase 4 will flip the rate limiter and
related surfaces to a shared backend by default. This module is the
foundation.
"""

from __future__ import annotations

import logging
import time
from typing import Protocol

logger = logging.getLogger("aegisrange.auth.cache")


class AuthCache(Protocol):
    """Abstract interface for ephemeral auth state shared across workers."""

    # -- JTI revocations -----------------------------------------------------

    def is_jti_revoked(self, jti: str) -> bool:
        """Return True iff the JWT ID is in the deny-list."""

    def revoke_jti(self, jti: str) -> None:
        """Add a JWT ID to the deny-list with the current timestamp."""

    def prune_expired_revocations(self, max_age_seconds: int) -> int:
        """Remove revocations older than ``max_age_seconds``.

        Returns the number pruned. In-memory: explicit sweep. Redis:
        implemented via per-key TTL, so pruning is a no-op.
        """

    def all_revoked_jtis(self) -> dict[str, float]:
        """Return a snapshot dict of jti → revocation-timestamp.

        Used by the SQLite persistence layer to checkpoint revocations
        across restarts. The in-memory cache returns a copy of its
        backing dict; the Redis cache returns a dict assembled from a
        SCAN, which is acceptable because the persistence layer only
        calls this on shutdown or periodic save.
        """

    def load_revoked_jtis(self, revocations: dict[str, float]) -> None:
        """Replace the current revocation set with ``revocations``.

        Called by the persistence layer on startup when restoring state
        from SQLite. The implementation is free to use monotonic or
        wall-clock time — the timestamps are only used to decide when
        an entry has expired.
        """

    # -- TOTP state ----------------------------------------------------------

    def totp_secret_for(self, username: str) -> str | None:
        """Return the stored base32 TOTP secret, or None if unset."""

    def set_totp_secret(self, username: str, secret: str) -> None:
        """Persist the TOTP secret for ``username``."""

    def clear_totp_secret(self, username: str) -> None:
        """Remove the stored TOTP secret for ``username``."""

    def is_totp_enabled(self, username: str) -> bool:
        """Return True iff ``username`` has completed TOTP enrollment."""

    def enable_totp(self, username: str) -> None:
        """Mark ``username`` as TOTP-enrolled."""

    def disable_totp(self, username: str) -> None:
        """Mark ``username`` as not TOTP-enrolled."""

    def all_totp_secrets(self) -> dict[str, str]:
        """Snapshot dict of username → secret, used by the persistence layer."""

    def all_totp_enabled(self) -> set[str]:
        """Snapshot set of enrolled usernames, used by the persistence layer."""

    def load_totp_state(self, secrets: dict[str, str], enabled: set[str]) -> None:
        """Replace current TOTP state with the restored values."""


# ---------------------------------------------------------------------------
# In-memory implementation (default)
# ---------------------------------------------------------------------------


class InMemoryAuthCache:
    """Process-local auth cache backed by plain dicts / sets.

    This is the default implementation — matches the behavior
    :class:`~app.store.InMemoryStore` has shipped with since 0.4.0, just
    extracted behind the :class:`AuthCache` interface so the Redis
    variant is a drop-in swap.

    The constructor accepts optional existing dict / set objects. When
    :class:`~app.store.InMemoryStore` wires up its cache it hands in
    the same ``revoked_jtis`` / ``totp_secrets`` / ``totp_enabled``
    containers the store has always exposed as attributes, so legacy
    direct-attribute access (``STORE.totp_enabled.add(...)``) stays
    consistent with cache reads. New code should go through the cache
    API; old code continues to work unchanged.
    """

    def __init__(
        self,
        *,
        revoked_jtis: dict[str, float] | None = None,
        totp_secrets: dict[str, str] | None = None,
        totp_enabled: set[str] | None = None,
    ) -> None:
        # jti -> monotonic timestamp of revocation. Monotonic time is
        # used so pruning is not affected by wall-clock adjustments.
        self._revoked_jtis: dict[str, float] = (
            revoked_jtis if revoked_jtis is not None else {}
        )
        self._totp_secrets: dict[str, str] = (
            totp_secrets if totp_secrets is not None else {}
        )
        self._totp_enabled: set[str] = (
            totp_enabled if totp_enabled is not None else set()
        )

    # -- JTI revocations -----------------------------------------------------

    def is_jti_revoked(self, jti: str) -> bool:
        return jti in self._revoked_jtis

    def revoke_jti(self, jti: str) -> None:
        self._revoked_jtis[jti] = time.monotonic()

    def prune_expired_revocations(self, max_age_seconds: int = 86400) -> int:
        now = time.monotonic()
        expired = [
            j for j, ts in self._revoked_jtis.items() if now - ts > max_age_seconds
        ]
        for j in expired:
            del self._revoked_jtis[j]
        return len(expired)

    def all_revoked_jtis(self) -> dict[str, float]:
        return dict(self._revoked_jtis)

    def load_revoked_jtis(self, revocations: dict[str, float]) -> None:
        # Mutate in place so callers that hold a reference to the same
        # dict (e.g. InMemoryStore.revoked_jtis) see the restored state.
        self._revoked_jtis.clear()
        self._revoked_jtis.update(revocations)

    # -- TOTP state ----------------------------------------------------------

    def totp_secret_for(self, username: str) -> str | None:
        return self._totp_secrets.get(username)

    def set_totp_secret(self, username: str, secret: str) -> None:
        self._totp_secrets[username] = secret

    def clear_totp_secret(self, username: str) -> None:
        self._totp_secrets.pop(username, None)

    def is_totp_enabled(self, username: str) -> bool:
        return username in self._totp_enabled

    def enable_totp(self, username: str) -> None:
        self._totp_enabled.add(username)

    def disable_totp(self, username: str) -> None:
        self._totp_enabled.discard(username)

    def all_totp_secrets(self) -> dict[str, str]:
        return dict(self._totp_secrets)

    def all_totp_enabled(self) -> set[str]:
        return set(self._totp_enabled)

    def load_totp_state(self, secrets: dict[str, str], enabled: set[str]) -> None:
        # Mutate in place so shared references stay consistent.
        self._totp_secrets.clear()
        self._totp_secrets.update(secrets)
        self._totp_enabled.clear()
        self._totp_enabled.update(enabled)


# ---------------------------------------------------------------------------
# Redis implementation (opt-in, gated on REDIS_URL)
# ---------------------------------------------------------------------------

# Key naming convention — all keys are namespaced under ``aegisrange:``
# so the same Redis instance can be shared with other apps without
# collision. Keys:
#   aegisrange:jti:<jti>                   EX=JTI_TTL_SECONDS     value=1
#   aegisrange:totp:secret:<username>      (no TTL)               value=<base32>
#   aegisrange:totp:enabled:<username>     (no TTL)               value=1

_NS_JTI = "aegisrange:jti:"
_NS_TOTP_SECRET = "aegisrange:totp:secret:"
_NS_TOTP_ENABLED = "aegisrange:totp:enabled:"


class RedisAuthCache:
    """Redis-backed auth cache. Opt-in via the ``REDIS_URL`` env var.

    JTI revocations use Redis's native key TTL (set via ``SET ... EX``)
    so ``prune_expired_revocations`` is a no-op — Redis drops expired
    entries automatically. The TTL defaults to 24 hours, matching the
    in-memory pruning window.

    This class deliberately imports ``redis`` lazily so callers that
    never construct it don't pay the import cost, and CI without the
    Redis package can still run the in-memory path.
    """

    DEFAULT_JTI_TTL_SECONDS = 86400  # 24 hours, matches in-memory prune cycle

    def __init__(
        self,
        url: str,
        *,
        jti_ttl_seconds: int | None = None,
    ) -> None:
        try:
            import redis  # type: ignore[import-untyped]
        except ImportError as exc:  # pragma: no cover — optional dep
            raise RuntimeError(
                "RedisAuthCache requires the 'redis' package. "
                "Install via: pip install redis>=5.0"
            ) from exc

        self._client = redis.Redis.from_url(url, decode_responses=True)
        self._jti_ttl = jti_ttl_seconds or self.DEFAULT_JTI_TTL_SECONDS
        logger.info(
            "RedisAuthCache initialised",
            extra={"jti_ttl_seconds": self._jti_ttl},
        )

    # -- JTI revocations -----------------------------------------------------

    def is_jti_revoked(self, jti: str) -> bool:
        return bool(self._client.exists(f"{_NS_JTI}{jti}"))

    def revoke_jti(self, jti: str) -> None:
        self._client.set(f"{_NS_JTI}{jti}", 1, ex=self._jti_ttl)

    def prune_expired_revocations(self, max_age_seconds: int = 86400) -> int:
        # No-op: Redis TTL drops expired keys automatically.
        return 0

    def all_revoked_jtis(self) -> dict[str, float]:
        revocations: dict[str, float] = {}
        now = time.monotonic()
        for key in self._client.scan_iter(match=f"{_NS_JTI}*"):
            jti = key[len(_NS_JTI) :]
            # Approximate the revocation time from the remaining TTL.
            # Absolute accuracy doesn't matter — callers only use this
            # dict to drive pruning, and Redis handles that itself.
            ttl = self._client.ttl(key)
            if isinstance(ttl, int) and ttl > 0:
                revocations[jti] = now - (self._jti_ttl - ttl)
            else:
                revocations[jti] = now
        return revocations

    def load_revoked_jtis(self, revocations: dict[str, float]) -> None:
        now = time.monotonic()
        pipe = self._client.pipeline()
        for jti, ts in revocations.items():
            remaining = int(max(0, self._jti_ttl - (now - ts)))
            if remaining > 0:
                pipe.set(f"{_NS_JTI}{jti}", 1, ex=remaining)
        pipe.execute()

    # -- TOTP state ----------------------------------------------------------

    def totp_secret_for(self, username: str) -> str | None:
        return self._client.get(f"{_NS_TOTP_SECRET}{username}")

    def set_totp_secret(self, username: str, secret: str) -> None:
        self._client.set(f"{_NS_TOTP_SECRET}{username}", secret)

    def clear_totp_secret(self, username: str) -> None:
        self._client.delete(f"{_NS_TOTP_SECRET}{username}")

    def is_totp_enabled(self, username: str) -> bool:
        return bool(self._client.exists(f"{_NS_TOTP_ENABLED}{username}"))

    def enable_totp(self, username: str) -> None:
        self._client.set(f"{_NS_TOTP_ENABLED}{username}", 1)

    def disable_totp(self, username: str) -> None:
        self._client.delete(f"{_NS_TOTP_ENABLED}{username}")

    def all_totp_secrets(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for key in self._client.scan_iter(match=f"{_NS_TOTP_SECRET}*"):
            username = key[len(_NS_TOTP_SECRET) :]
            value = self._client.get(key)
            if value is not None:
                out[username] = value
        return out

    def all_totp_enabled(self) -> set[str]:
        enabled: set[str] = set()
        for key in self._client.scan_iter(match=f"{_NS_TOTP_ENABLED}*"):
            enabled.add(key[len(_NS_TOTP_ENABLED) :])
        return enabled

    def load_totp_state(self, secrets: dict[str, str], enabled: set[str]) -> None:
        pipe = self._client.pipeline()
        for username, secret in secrets.items():
            pipe.set(f"{_NS_TOTP_SECRET}{username}", secret)
        for username in enabled:
            pipe.set(f"{_NS_TOTP_ENABLED}{username}", 1)
        pipe.execute()


def build_auth_cache(redis_url: str | None = None) -> AuthCache:
    """Factory: return the configured cache backend.

    Returns :class:`RedisAuthCache` when ``redis_url`` is set and the
    ``redis`` library is importable; otherwise returns
    :class:`InMemoryAuthCache`. A logged warning is emitted if a URL
    was provided but the Redis backend could not be built — we fall
    back to in-memory rather than failing startup, because a broken
    Redis shouldn't take the app down on boot.
    """
    if not redis_url:
        return InMemoryAuthCache()
    try:
        return RedisAuthCache(redis_url)
    except Exception as exc:  # pragma: no cover — defensive fallback
        logger.warning(
            "Falling back to InMemoryAuthCache — RedisAuthCache init failed",
            extra={"error": str(exc)},
        )
        return InMemoryAuthCache()
