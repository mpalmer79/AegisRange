import type { Event } from '@/lib/types';
import { formatTimestamp } from './utils';

interface EvidenceEventsProps {
  events: Event[];
}

function getEventLabel(event: Event) {
  if (event.event_type) return event.event_type;

  if (event.payload && typeof event.payload === 'object') {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.event_type === 'string') {
      return payload.event_type;
    }
  }

  return 'unknown_event';
}

export default function EvidenceEvents({ events }: EvidenceEventsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
        Evidence Events ({events.length})
      </h2>

      {events.length === 0 ? (
        <p className="text-sm font-mono text-slate-400 dark:text-gray-600">None</p>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={event.event_id || `event-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                {getEventLabel(event)}
              </p>
              <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                {event.event_id || 'unknown_event_id'}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Actor
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {event.actor_id || 'unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Timestamp
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
