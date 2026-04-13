"""AegisRange API — application entry point.

This module creates the FastAPI application, registers middleware,
exception handlers, and includes all route modules.  Business logic
lives in ``app/services/``, request schemas in ``app/schemas.py``,
and route handlers in ``app/routers/``.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.logging_config import setup_logging
from app.services import audit_service
from app.services.rate_limiter import EndpointSensitivity, rate_limiter
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

def reset_rate_limits() -> None:
    """Clear all rate-limit tracking data (called on store reset)."""
    rate_limiter.reset()


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

app = FastAPI(
    title="AegisRange API",
    version="0.7.0",
    description=(
        "Defensive security simulation and validation platform. "
        "Provides telemetry ingestion, deterministic detection, automated response, "
        "and auditable incident management."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Correlation-ID",
        settings.CSRF_HEADER_NAME,
    ],
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Request size limit
#
# Reject payloads over 1 MB to prevent abuse.  This is enforced before
# any parsing occurs so the body is never fully read into memory.
# ---------------------------------------------------------------------------

_MAX_REQUEST_BODY_BYTES = 1_048_576  # 1 MB


@app.middleware("http")
async def request_size_limit_middleware(request: Request, call_next):
    """Reject requests with bodies exceeding the size limit."""
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > _MAX_REQUEST_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large"},
                )
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid Content-Length header"},
            )
    return await call_next(request)


# ---------------------------------------------------------------------------
# CSRF protection
#
# State-changing requests (POST/PUT/PATCH/DELETE) that are authenticated
# via cookie must include a matching CSRF token.  The token is issued as
# a non-httpOnly cookie on login and must be echoed back via the
# X-CSRF-Token header.  Requests authenticated via Bearer header (API
# clients, tests) are exempt — they are not vulnerable to CSRF because
# the browser never attaches the Bearer header automatically.
# ---------------------------------------------------------------------------

_CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_CSRF_EXEMPT_PATHS = {"/auth/login", "/auth/logout", "/health"}


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """Enforce CSRF protection for cookie-authenticated state-changing requests."""
    if request.method in _CSRF_SAFE_METHODS:
        return await call_next(request)

    if request.url.path in _CSRF_EXEMPT_PATHS:
        return await call_next(request)

    # Requests using Bearer header are not vulnerable to CSRF
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return await call_next(request)

    # If a cookie-based auth token is present, enforce CSRF
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            client_ip = request.client.host if request.client else None
            audit_service.log_csrf_failure(
                request.url.path,
                request.method,
                client_ip=client_ip,
                correlation_id=getattr(request.state, "correlation_id", None),
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF validation failed"},
            )

    return await call_next(request)


# ---------------------------------------------------------------------------
# Security headers
#
# Applied to every response.  Content-Security-Policy is deliberately
# strict — no unsafe-inline, no wildcard sources.  The API serves JSON
# only, so the CSP can be locked down tightly.
# ---------------------------------------------------------------------------

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Cache-Control": "no-store",
}


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers[header] = value
    return response


_jti_prune_counter: int = 0
_JTI_PRUNE_INTERVAL: int = 100


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    """Propagate or generate a correlation ID; persist operational state after mutations.

    Entity persistence (events, alerts, responses, incidents, notes) is
    handled by domain transactions (``STORE.transaction()``).  This
    middleware only persists operational state (containment sets, risk
    profiles) after successful mutations.
    """
    global _jti_prune_counter
    correlation_id = request.headers.get("x-correlation-id") or f"corr-{uuid4()}"
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    # Persist operational state after successful mutations
    if request.method in ("POST", "PATCH", "DELETE") and response.status_code < 400:
        STORE.save()
    # Periodically prune expired JTI revocations
    _jti_prune_counter += 1
    if _jti_prune_counter >= _JTI_PRUNE_INTERVAL:
        _jti_prune_counter = 0
        STORE.prune_expired_revocations()
    return response


_AUTH_PATHS = {"/auth/login", "/identity/login"}
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Enforce per-IP, per-user, per-endpoint rate limiting.

    - AUTH endpoints: tightest limits (brute-force protection)
    - WRITE endpoints: moderate limits
    - READ endpoints: most permissive
    All tiers are enforced per-IP.  Authenticated write requests
    are additionally rate-limited per-user.
    """
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    # Determine sensitivity tier
    if path in _AUTH_PATHS and request.method == "POST":
        sensitivity = EndpointSensitivity.AUTH
    elif request.method in _WRITE_METHODS:
        sensitivity = EndpointSensitivity.WRITE
    else:
        sensitivity = EndpointSensitivity.READ

    # Per-IP check
    ip_key = f"ip:{client_ip}:{sensitivity.value}"
    if rate_limiter.is_limited(ip_key, sensitivity):
        audit_service.log_rate_limit_exceeded(
            client_ip, path, sensitivity.value,
            correlation_id=getattr(request.state, "correlation_id", None),
        )
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."},
            headers={"Retry-After": "60"},
        )

    # Per-user check on write requests (extract from cookie or header)
    if sensitivity in (EndpointSensitivity.AUTH, EndpointSensitivity.WRITE):
        auth_header = request.headers.get("authorization", "")
        cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
        user_id = None
        if auth_header.lower().startswith("bearer ") or cookie_token:
            from app.services.auth_service import _auth_service

            token = cookie_token or auth_header.split()[-1]
            payload = _auth_service.verify_token(token)
            if payload:
                user_id = payload.sub
        if user_id:
            user_key = f"user:{user_id}:{sensitivity.value}"
            if rate_limiter.is_limited(user_key, sensitivity):
                audit_service.log_rate_limit_exceeded(
                    client_ip, path, f"per-user:{sensitivity.value}",
                    correlation_id=getattr(request.state, "correlation_id", None),
                )
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Try again later."},
                    headers={"Retry-After": "60"},
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
