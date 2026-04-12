import type { Event } from '@/lib/types';
import { formatTimestamp, getEventLabel, safeJson } from './utils';

interface ContributingEventsSectionProps {
  events: Event[];
}

export default function ContributingEventsSection({ events }: ContributingEventsSectionProps) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Evidence
          </p>
          <h2 className="mt-2 text-2xl font-bold">Contributing events</h2>
        </div>
        <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-mono uppercase text-slate-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
            No event evidence was resolved for this alert.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {events.map((event, index) => (
            <div
              key={event.event_id || `event-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {getEventLabel(event)}
                  </p>
                  <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                    {event.event_id || 'unknown_event_id'}
                  </p>
                </div>

                <span className="text-xs font-mono text-slate-500 dark:text-gray-500">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Actor
                  </p>
                  <p className="mt-1 break-all text-sm font-mono text-slate-700 dark:text-gray-300">
                    {event.actor_id || 'unknown'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Correlation
                  </p>
                  <p className="mt-1 break-all text-sm font-mono text-slate-700 dark:text-gray-300">
                    {event.correlation_id || 'n/a'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {event.status || 'unknown'}
                  </p>
                </div>
              </div>

              {event.payload !== undefined && (
                <details className="mt-4 rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-mono uppercase tracking-wide text-slate-600 dark:text-gray-400">
                    View event payload
                  </summary>
                  <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 text-xs leading-6 text-slate-700 dark:border-gray-800 dark:text-gray-300">
                    {safeJson(event.payload)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
