import type { TimelineRow } from './utils';
import { formatTimestamp, getTimelineStyle } from './utils';

interface IncidentTimelineProps {
  timelineRows: TimelineRow[];
}

export default function IncidentTimeline({ timelineRows }: IncidentTimelineProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-300">
        Timeline ({timelineRows.length} entries)
      </h2>

      {timelineRows.length === 0 ? (
        <p className="text-sm font-mono text-slate-400 dark:text-gray-600">
          No timeline entries available.
        </p>
      ) : (
        <div className="relative">
          <div className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200 dark:bg-gray-800" />
          <div className="space-y-4">
            {timelineRows.map((entry) => {
              const style = getTimelineStyle(entry.type);

              return (
                <div key={entry.id} className="relative flex gap-4">
                  <div
                    className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.dot} text-[10px] font-bold text-white`}
                  >
                    {style.icon}
                  </div>

                  <div className="flex-1 pb-2">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono uppercase text-slate-500 dark:text-gray-500">
                        {entry.type}
                      </span>
                      <span className="text-xs font-mono text-slate-400 dark:text-gray-600">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-gray-300">
                      {entry.summary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
