"""Rate limiting abstraction for AegisRange.

Provides per-IP, per-user, and per-endpoint rate limiting via an
abstract ``RateLimiter`` interface.  The default ``InMemoryRateLimiter``
is process-local; swap with a Redis-backed implementation to support
multiple workers.

NOTE: This rate limiter is process-local and in-memory only.
It is only correct when the application runs with a single worker.
See Dockerfile CMD and ARCHITECTURE.md section "Scaling Constraints".
To support multiple workers, subclass ``RateLimiter`` with a
Redis-backed implementation.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from collections import defaultdict
from enum import Enum


class EndpointSensitivity(Enum):
    """Sensitivity tiers control how many requests are allowed per window."""

    AUTH = "auth"  # Login / identity endpoints — tightest limits
    WRITE = "write"  # State-changing endpoints (POST/PATCH/DELETE)
    READ = "read"  # Read-only endpoints — most permissive


# Requests-per-window for each sensitivity tier
_TIER_LIMITS: dict[EndpointSensitivity, int] = {
    EndpointSensitivity.AUTH: 20,
    EndpointSensitivity.WRITE: 60,
    EndpointSensitivity.READ: 200,
}

_WINDOW_SECONDS = 60


class RateLimiter(ABC):
    """Abstract rate limiter interface.

    Subclass and implement ``is_limited`` and ``reset`` to provide
    a distributed rate limiter (e.g. Redis sliding window).
    """

    @abstractmethod
    def is_limited(
        self,
        key: str,
        sensitivity: EndpointSensitivity = EndpointSensitivity.READ,
    ) -> bool:
        """Return True if *key* has exceeded the limit for *sensitivity*."""
        ...

    @abstractmethod
    def reset(self) -> None:
        """Clear all rate-limit tracking data."""
        ...


class InMemoryRateLimiter(RateLimiter):
    """Process-local in-memory sliding-window rate limiter.

    Keys can encode IP, user, or IP+endpoint to support per-IP,
    per-user, and per-endpoint limiting.
    """

    def __init__(self) -> None:
        self._store: dict[str, list[float]] = defaultdict(list)

    def is_limited(
        self,
        key: str,
        sensitivity: EndpointSensitivity = EndpointSensitivity.READ,
    ) -> bool:
        now = time.monotonic()
        timestamps = self._store[key]
        self._store[key] = [t for t in timestamps if now - t < _WINDOW_SECONDS]
        max_requests = _TIER_LIMITS[sensitivity]
        if len(self._store[key]) >= max_requests:
            return True
        self._store[key].append(now)
        return False

    def reset(self) -> None:
        self._store.clear()


# Module-level singleton
rate_limiter = InMemoryRateLimiter()
