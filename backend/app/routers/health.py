"""Health check endpoint.

In 0.10.0 this gained a ``subsystems`` block that load balancers and
deploy-gate probes can parse before routing traffic to a new instance.
The block reports per-subsystem status for SQLite persistence, the
auth cache (in-memory or Redis), and JWT-secret configuration.
"""

from __future__ import annotations

import time

from fastapi import APIRouter

from app.config import settings
from app.models import utc_now
from app.schemas import HealthResponse
from app.services.auth_cache import InMemoryAuthCache
from app.store import STORE

router = APIRouter()

# Record the process start time so /health can report uptime. Imported
# modules-at-import time is close enough to "boot" for an observability
# signal; exact startup time would require a lifespan hook and adds no
# real accuracy.
_BOOT_MONOTONIC = time.monotonic()
_API_VERSION = "0.10.0"


def _subsystem_health() -> dict:
    """Derive per-subsystem reachability. Pure reads, no side effects."""
    persistence = STORE.get_persistence()
    sqlite_block = {
        "status": "disabled" if persistence is None else "ok",
        "enabled": persistence is not None,
        "db_path": settings.DB_PATH if persistence is not None else None,
    }

    # Auth cache: can we round-trip a probe key? Cheap on in-memory,
    # also cheap on Redis. We use a namespaced key that's deliberately
    # not a JTI so we don't ever accidentally revoke a real token.
    cache = STORE.auth_cache
    backend = "memory" if isinstance(cache, InMemoryAuthCache) else "redis"
    cache_status = "ok"
    try:
        probe = "__aegisrange_health_probe__"
        if cache.is_jti_revoked(probe):
            # Pre-existing probe — still indicates the cache is up.
            pass
    except Exception:  # pragma: no cover — defensive
        cache_status = "degraded"

    cache_block = {
        "status": cache_status,
        "backend": backend,
        "redis_url_configured": bool(settings.REDIS_URL),
    }

    # JWT secret: in production, a non-default secret must be set. In
    # development, the dev fallback is acceptable and reported as such.
    jwt_configured = bool(settings.JWT_SECRET) or settings.APP_ENV != "production"

    return {
        "persistence_sqlite": sqlite_block,
        "auth_cache": cache_block,
        "jwt_secret_configured": jwt_configured,
    }


@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    subsystems = _subsystem_health()
    # Overall status: ok unless any critical subsystem is degraded.
    overall = "ok"
    if subsystems["auth_cache"]["status"] == "degraded":
        overall = "degraded"
    return {
        "status": overall,
        "timestamp": utc_now().isoformat(),
        "stats": {
            "events": len(STORE.events),
            "alerts": len(STORE.alerts),
            "incidents": len(STORE.incidents_by_correlation),
            "responses": len(STORE.responses),
        },
        "containment": STORE.get_containment_counts(),
        "persistence": STORE.get_persistence() is not None,
        "subsystems": subsystems,
        "uptime_seconds": round(time.monotonic() - _BOOT_MONOTONIC, 3),
        "version": _API_VERSION,
    }
