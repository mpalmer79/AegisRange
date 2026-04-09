from __future__ import annotations

import asyncio
import json
import logging
from app.models import utc_now

from app.store import InMemoryStore

logger = logging.getLogger("aegisrange.stream")

VALID_EVENT_TYPES: set[str] = {
    "event",
    "alert",
    "incident",
    "response",
    "scenario_start",
    "scenario_complete",
}

KEEPALIVE_INTERVAL_SECONDS: int = 15


class StreamService:
    """Server-Sent Events (SSE) streaming service for real-time event delivery."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self.subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        """Create and return a new subscriber queue."""
        queue: asyncio.Queue = asyncio.Queue()
        self.subscribers.append(queue)
        logger.info("New SSE subscriber connected, total=%d", len(self.subscribers))
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue."""
        try:
            self.subscribers.remove(queue)
            logger.info("SSE subscriber disconnected, total=%d", len(self.subscribers))
        except ValueError:
            pass

    def publish(self, event_type: str, data: dict) -> None:
        """Push an event to all subscriber queues.

        Args:
            event_type: One of "event", "alert", "incident", "response",
                        "scenario_start", "scenario_complete".
            data: The event payload to serialize as JSON.
        """
        message = {
            "event_type": event_type,
            "data": data,
            "timestamp": utc_now().isoformat(),
        }

        disconnected: list[asyncio.Queue] = []
        for queue in self.subscribers:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("Subscriber queue full, dropping message")
            except Exception:
                disconnected.append(queue)

        for queue in disconnected:
            self.unsubscribe(queue)

    async def event_generator(self, queue: asyncio.Queue):
        """Async generator that yields SSE-formatted strings.

        Yields strings in the Server-Sent Events format:
            event: <type>
            data: <json>

        Sends keepalive pings every 15 seconds when idle.
        """
        try:
            while True:
                try:
                    message = await asyncio.wait_for(
                        queue.get(),
                        timeout=KEEPALIVE_INTERVAL_SECONDS,
                    )
                except asyncio.TimeoutError:
                    # Send keepalive ping
                    yield ":keepalive\n\n"
                    continue

                event_type = message.get("event_type", "event")
                data = message.get("data", {})

                json_data = json.dumps(data, default=str)
                yield f"event: {event_type}\ndata: {json_data}\n\n"
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("SSE event generator encountered an error")
        finally:
            self.unsubscribe(queue)
