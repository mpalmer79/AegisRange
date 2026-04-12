import type { Incident, IncidentStatus } from '@/lib/types';
import { STATUS_STYLES, SEVERITY_STYLES, formatTimestamp } from './utils';

interface IncidentHeaderProps {
  incident: Incident;
  validTransitions: IncidentStatus[];
  updating: boolean;
  onStatusChange: (status: IncidentStatus) => void;
}

export default function IncidentHeader({
  incident,
  validTransitions,
  updating,
  onStatusChange,
}: IncidentHeaderProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Incident Detail
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-gray-100 sm:text-2xl">
            {incident.incident_id || 'Incident'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400">
            Aggregated investigation record tied to correlation id {incident.correlation_id}.
            This page shows how alerts, events, responses, notes, and status transitions
            accumulated into the current case state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded border px-3 py-1 text-xs font-mono uppercase ${STATUS_STYLES[incident.status] ?? STATUS_STYLES.open}`}
          >
            {incident.status}
          </span>
          <span
            className={`rounded border px-3 py-1 text-xs font-mono uppercase ${SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.low}`}
          >
            {incident.severity}
          </span>
        </div>
      </div>

      {validTransitions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-gray-800">
          <span className="mr-2 text-xs font-mono text-slate-500 dark:text-gray-500">
            TRANSITION TO:
          </span>
          {validTransitions.map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              disabled={updating}
              className={`rounded border px-3 py-1.5 text-xs font-mono uppercase transition-all disabled:opacity-50 ${
                STATUS_STYLES[status] ??
                'border-slate-400 bg-slate-300 text-slate-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
              } hover:brightness-110`}
            >
              {updating ? '...' : status}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Primary actor
          </p>
          <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
            {incident.primary_actor_id || 'unknown'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Confidence
          </p>
          <p className="mt-1 text-sm font-mono uppercase text-slate-700 dark:text-gray-300">
            {incident.confidence ?? '-'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Risk score
          </p>
          <p className="mt-1 text-sm font-mono font-bold text-red-700 dark:text-red-400">
            {incident.risk_score ?? 'n/a'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Correlation
          </p>
          <p className="mt-1 break-all text-xs font-mono text-cyan-700 dark:text-cyan-400">
            {incident.correlation_id}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Created
          </p>
          <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
            {formatTimestamp(incident.created_at)}
          </p>
        </div>
      </div>
    </section>
  );
}
