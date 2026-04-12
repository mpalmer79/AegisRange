import type { IncidentResponse } from '@/lib/types';
import { formatTimestamp } from './utils';

interface IncidentResponsesProps {
  responses: IncidentResponse[];
}

function getResponseLabel(response: IncidentResponse) {
  return response.response_type || response.summary || 'unknown_response';
}

export default function IncidentResponses({ responses }: IncidentResponsesProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
        Responses ({responses.length})
      </h2>

      {responses.length === 0 ? (
        <p className="text-sm font-mono text-slate-400 dark:text-gray-600">None</p>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => (
            <div
              key={response.response_id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                {getResponseLabel(response)}
              </p>
              <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                {response.response_id}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Target
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {response.target || 'n/a'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Triggered
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {formatTimestamp(response.triggered_at)}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                  Summary
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-gray-300">
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
