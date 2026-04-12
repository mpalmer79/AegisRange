import type { IncidentResponse } from '@/lib/types';
import { formatTimestamp, getResponseLabel } from './utils';

interface RelatedResponsesPanelProps {
  responses: IncidentResponse[];
}

export default function RelatedResponsesPanel({ responses }: RelatedResponsesPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Response trace
          </p>
          <h2 className="mt-2 text-2xl font-bold">Related responses</h2>
        </div>
        <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-mono uppercase text-slate-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
          {responses.length} response{responses.length === 1 ? '' : 's'}
        </span>
      </div>

      {responses.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
            No related response actions were resolved for this alert.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {responses.map((response, index) => (
            <div
              key={response.response_id || `response-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {getResponseLabel(response)}
                  </p>
                  <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                    {response.response_id || 'unknown_response_id'}
                  </p>
                </div>

                <span className="text-xs font-mono text-slate-500 dark:text-gray-500">
                  {formatTimestamp(response.triggered_at)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {response.status || 'unknown'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Target
                  </p>
                  <p className="mt-1 break-all text-sm font-mono text-slate-700 dark:text-gray-300">
                    {response.target || 'n/a'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Operator
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {response.operator || 'system'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Executed
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {formatTimestamp(response.executed_at ?? undefined)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                  Summary
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
                  {response.summary || 'No response summary provided.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
