import type { Alert } from '@/lib/types';
import { safeJson } from './utils';

interface DetectionPayloadPanelProps {
  alert: Alert;
}

export default function DetectionPayloadPanel({ alert }: DetectionPayloadPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
        Raw alert context
      </p>
      <h2 className="mt-2 text-2xl font-bold">Detection payload</h2>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Summary
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
            {alert.summary || 'No summary provided.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Contributing event IDs
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(alert.contributing_event_ids ?? []).length > 0 ? (
              alert.contributing_event_ids.map((id) => (
                <span
                  key={id}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {id}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500 dark:text-gray-500">
                No contributing event ids recorded.
              </span>
            )}
          </div>
        </div>

        {alert.payload !== undefined && (
          <details className="rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-800 dark:bg-gray-950">
            <summary className="cursor-pointer px-4 py-3 text-xs font-mono uppercase tracking-wide text-slate-600 dark:text-gray-400">
              View alert payload
            </summary>
            <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 text-xs leading-6 text-slate-700 dark:border-gray-800 dark:text-gray-300">
              {safeJson(alert.payload)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
