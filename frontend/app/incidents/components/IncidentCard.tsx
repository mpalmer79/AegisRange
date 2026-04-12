'use client';

import Link from 'next/link';
import { Incident } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  investigating: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  contained: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  closed: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
};

const SEVERITY_STYLES: Record<string, { text: string; border: string }> = {
  critical: {
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500/30',
  },
  high: {
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500/30',
  },
  medium: {
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-500/30',
  },
  low: {
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
  informational: {
    text: 'text-slate-600 dark:text-gray-400',
    border: 'border-slate-300 dark:border-gray-700',
  },
};

function formatTimestamp(ts?: string) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function getIncidentNarrative(incident: Incident) {
  const actor = incident.primary_actor_id || 'unknown actor';
  const detections = incident.detection_ids?.length ?? 0;
  const responses = incident.response_ids?.length ?? 0;
  const status = incident.status || 'open';

  return `Incident affecting ${actor}. Currently ${status} with ${detections} detection${detections === 1 ? '' : 's'} and ${responses} response${responses === 1 ? '' : 's'} attached.`;
}

interface IncidentCardProps {
  incident: Incident;
  index: number;
}

export default function IncidentCard({ incident, index }: IncidentCardProps) {
  const statusClass =
    STATUS_STYLES[incident.status?.toLowerCase()] ?? STATUS_STYLES.open;
  const severityStyle =
    SEVERITY_STYLES[incident.severity?.toLowerCase()] ?? SEVERITY_STYLES.low;
  const href = `/incidents/${incident.correlation_id}`;

  return (
    <Link
      key={incident.correlation_id || incident.incident_id || index}
      href={href}
      className={`group block rounded-2xl border ${severityStyle.border} bg-white p-5 shadow-sm transition-colors hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-900/80`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-mono font-medium text-slate-900 dark:text-gray-100">
              {incident.incident_id || incident.correlation_id || 'unknown_incident'}
            </span>

            <span
              className={`rounded border px-2 py-0.5 text-xs font-mono uppercase ${statusClass}`}
            >
              {incident.status || 'open'}
            </span>

            <span
              className={`text-xs font-mono uppercase ${severityStyle.text}`}
            >
              {incident.severity || 'low'}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Incident summary
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
              {getIncidentNarrative(incident)}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Actor
              </p>
              <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
                {incident.primary_actor_id || 'unknown'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Risk
              </p>
              <p className="mt-1 text-sm font-mono text-red-700 dark:text-red-400">
                {incident.risk_score != null ? incident.risk_score : 'n/a'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Detections
              </p>
              <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                {incident.detection_ids?.length ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Responses
              </p>
              <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                {incident.response_ids?.length ?? 0}
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
        </div>

        <div className="shrink-0 pt-1">
          <svg
            className="h-5 w-5 text-slate-400 transition-colors group-hover:text-cyan-500 dark:text-gray-600 dark:group-hover:text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
