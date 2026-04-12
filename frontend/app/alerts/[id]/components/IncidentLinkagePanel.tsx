import Link from 'next/link';
import type { Incident } from '@/lib/types';
import { getSeverityStyle } from './utils';

interface IncidentLinkagePanelProps {
  incident: Incident | null;
}

export default function IncidentLinkagePanel({ incident }: IncidentLinkagePanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
        Incident linkage
      </p>
      <h2 className="mt-2 text-2xl font-bold">Escalation context</h2>

      {!incident ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
            No incident record was resolved from this alert&apos;s correlation id.
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-mono font-medium text-slate-900 dark:text-gray-100">
              {incident.incident_id || incident.correlation_id || 'unknown_incident'}
            </span>
            {incident.status && (
              <span className="rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-mono uppercase text-amber-700 dark:text-amber-400">
                {incident.status}
              </span>
            )}
            {incident.severity && (
              <span className={`text-xs font-mono uppercase ${getSeverityStyle(incident.severity).text}`}>
                {incident.severity}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Primary actor
              </p>
              <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                {incident.primary_actor_id || 'unknown'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Risk score
              </p>
              <p className="mt-1 text-sm font-mono text-red-700 dark:text-red-400">
                {incident.risk_score != null ? incident.risk_score : 'n/a'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href={`/incidents/${incident.correlation_id}`}
              className="text-xs font-mono uppercase tracking-wide text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              View linked incident
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
