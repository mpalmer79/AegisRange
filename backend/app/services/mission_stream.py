"""Per-run SSE fan-out for mission playback.

Each mission is a separate channel, keyed by ``run_id``. Consumers
subscribe to receive world updates — ``mission_started``, ``beat``,
``timer_tick``, ``mission_complete`` — and unsubscribe when the client
disconnects.

The hub is intentionally minimal: an in-process dict of per-run queues.
Multi-worker deployments would need a shared bus (Redis pub/sub, NATS)
— that's a Phase 2+N concern.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("aegisrange.mission_stream")


class MissionStreamHub:
    """In-process fan-out keyed by ``run_id``.

    Subscribers read from an :class:`asyncio.Queue`. ``publish`` delivers
    to all current subscribers for that run; closed/slow subscribers are
    detected and dropped on best effort.

    Because the SSE subscription is opened by the client *after* the
    mission has already been queued for playback, the hub keeps a
    bounded replay buffer per run. New subscribers receive every event
    published so far (up to the buffer limit) before live updates —
    guaranteeing they see ``mission_started`` and any beats that fired
    in the sub-second window between ``POST /missions`` returning and
    the ``GET /stream`` request connecting.
    """

    # When a mission finishes we emit a sentinel so subscribers can stop
    # their generators cleanly. Clients should unsubscribe after seeing a
    # terminal event.
    CLOSE_SENTINEL = "__mission_stream_close__"

    def __init__(
        self, *, max_queue_size: int = 256, replay_buffer_size: int = 256
    ) -> None:
        self._max_queue_size = max_queue_size
        self._replay_buffer_size = replay_buffer_size
        self._subscribers: dict[str, list[asyncio.Queue[dict[str, Any] | str]]] = {}
        self._replay: dict[str, list[dict[str, Any]]] = {}
        self._closed: set[str] = set()
        # We use a simple threading.Lock-compatible asyncio Lock so
        # the scheduler and the SSE endpoint can register/unregister
        # concurrently under the same event loop.
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> asyncio.Queue[dict[str, Any] | str]:
        queue: asyncio.Queue[dict[str, Any] | str] = asyncio.Queue(
            maxsize=self._max_queue_size
        )
        async with self._lock:
            # Backfill any buffered events first so late subscribers
            # catch up on already-published beats.
            for ev in self._replay.get(run_id, []):
                try:
                    queue.put_nowait(ev)
                except asyncio.QueueFull:
                    break
            if run_id in self._closed:
                # Mission already finished; don't register — just signal
                # end of stream after backfill.
                queue.put_nowait(self.CLOSE_SENTINEL)
                return queue
            self._subscribers.setdefault(run_id, []).append(queue)
        return queue

    async def unsubscribe(
        self, run_id: str, queue: asyncio.Queue[dict[str, Any] | str]
    ) -> None:
        async with self._lock:
            subs = self._subscribers.get(run_id)
            if not subs:
                return
            self._subscribers[run_id] = [q for q in subs if q is not queue]
            if not self._subscribers[run_id]:
                self._subscribers.pop(run_id, None)

    async def publish(self, run_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(run_id, []))
            buf = self._replay.setdefault(run_id, [])
            buf.append(event)
            if len(buf) > self._replay_buffer_size:
                # Trim oldest; we tolerate losing very old events from
                # the replay buffer — live subscribers already have them.
                del buf[: len(buf) - self._replay_buffer_size]
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Slow consumer — drop the update rather than block the
                # scheduler. Log once per overflow; clients that miss an
                # update can always GET /missions/{run_id} to resync.
                logger.warning(
                    "Mission stream queue full; dropping event",
                    extra={"run_id": run_id, "event_type": event.get("type")},
                )

    async def close(self, run_id: str) -> None:
        """Send the close sentinel to every subscriber for this run and
        mark the run closed so late subscribers see the backfill then
        terminate. Idempotent."""
        async with self._lock:
            queues = self._subscribers.pop(run_id, [])
            self._closed.add(run_id)
        for q in queues:
            try:
                q.put_nowait(self.CLOSE_SENTINEL)
            except asyncio.QueueFull:
                pass

    async def forget(self, run_id: str) -> None:
        """Drop all retained state for a run (replay buffer, closed
        marker). Optional housekeeping — not required for correctness."""
        async with self._lock:
            self._replay.pop(run_id, None)
            self._closed.discard(run_id)
            self._subscribers.pop(run_id, None)

    def subscriber_count(self, run_id: str) -> int:
        """Non-locking count, good enough for diagnostics."""
        return len(self._subscribers.get(run_id, []))
