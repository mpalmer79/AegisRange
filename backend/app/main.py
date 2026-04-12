"""AegisRange API — application entry point.

This module creates the FastAPI application, registers middleware,
exception handlers, and includes all route modules.  Business logic
lives in ``app/services/``, request schemas in ``app/schemas.py``,
and route handlers in ``app/routers/``.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.logging_config import setup_logging
from app.routers import (
    admin,
    alerts,
    analytics,
    auth,
    campaigns,
    documents,
    events,
    health,
    identity,
    incidents,
    killchain,
    metrics,
    mitre,
    reports,
    scenarios,
    stream,
)
from app.store import STORE

setup_logging(settings.LOG_LEVEL, settings.LOG_FORMAT)
logger = logging.getLogger("aegisrange")

# ---------------------------------------------------------------------------
# Rate limiting (in-memory, per-IP)
#
# NOTE: This rate limiter is process-local and in-memory only.
# It is only correct when the application runs with a single worker.
# See Dockerfile CMD and ARCHITECTURE.md section "Scaling Constraints".
# To support multiple workers, replace with a shared limiter (e.g. Redis).
# ---------------------------------------------------------------------------

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX_REQUESTS = 20  # max auth attempts per window


def _is_rate_limited(client_ip: str) -> bool:
    """Return True if *client_ip* has exceeded the auth rate limit."""
    now = time.monotonic()
    # Prune entries older than the window
    timestamps = _rate_limit_store[client_ip]
    _rate_limit_store[client_ip] = [
        t for t in timestamps if now - t < _RATE_LIMIT_WINDOW
    ]
    if len(_rate_limit_store[client_ip]) >= _RATE_LIMIT_MAX_REQUESTS:
        return True
    _rate_limit_store[client_ip].append(now)
    return False


def reset_rate_limits() -> None:
    """Clear all rate-limit tracking data (called on store reset)."""
    _rate_limit_store.clear()


# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated on_event("startup"))
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    if settings.APP_ENV != "test":
        STORE.enable_persistence(db_path=settings.DB_PATH)
        logger.info(
            "SQLite persistence enabled",
            extra={"env": settings.APP_ENV, "db_path": settings.DB_PATH},
        )
    logger.info("AegisRange API started", extra={"env": settings.APP_ENV})
    yield
    # --- shutdown ---
    logger.info("AegisRange API shutting down")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="AegisRange API", version="0.7.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


_jti_prune_counter: int = 0
_JTI_PRUNE_INTERVAL: int = 100


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    """Propagate or generate a correlation ID, and auto-save after mutations."""
    global _jti_prune_counter
    correlation_id = request.headers.get("x-correlation-id") or f"corr-{uuid4()}"
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    # Auto-save to SQLite after mutating requests
    if request.method in ("POST", "PATCH", "DELETE") and response.status_code < 400:
        STORE.save()
    # Periodically prune expired JTI revocations
    _jti_prune_counter += 1
    if _jti_prune_counter >= _JTI_PRUNE_INTERVAL:
        _jti_prune_counter = 0
        STORE.prune_expired_revocations()
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Enforce rate limiting on authentication endpoints."""
    auth_paths = {"/auth/login", "/identity/login"}
    if request.url.path in auth_paths and request.method == "POST":
        client_ip = request.client.host if request.client else "unknown"
        if _is_rate_limited(client_ip):
            logger.warning(
                "Rate limit exceeded",
                extra={"client_ip": client_ip, "path": request.url.path},
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Try again later."},
                headers={"Retry-After": str(_RATE_LIMIT_WINDOW)},
            )
    return await call_next(request)


@app.middleware("http")
async def latency_middleware(request: Request, call_next):
    """Record and log request latency."""
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = (time.monotonic() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
    logger.debug(
        "Request completed",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "elapsed_ms": round(elapsed_ms, 1),
        },
    )
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all handler that prevents stack traces from leaking to clients."""
    logger.exception(
        "Unhandled exception",
        extra={
            "path": request.url.path,
            "method": request.method,
            "correlation_id": getattr(request.state, "correlation_id", None),
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(identity.router)
app.include_router(documents.router)
app.include_router(scenarios.router)
app.include_router(events.router)
app.include_router(alerts.router)
app.include_router(incidents.router)
app.include_router(metrics.router)
app.include_router(analytics.router)
app.include_router(mitre.router)
app.include_router(killchain.router)
app.include_router(campaigns.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(stream.router)
