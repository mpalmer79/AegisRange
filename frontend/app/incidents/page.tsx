'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { getIncidents } from '@/lib/api';
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

function getSeverityRank(severity?: string) {
  const normalized = severity?.toLowerCase();
  if (normalized === 'critical') return 5;
  if (normalized === 'high') return 4;
  if (normalized === 'medium') return 3;
  if (normalized === 'low') return 2;
  return 1;
}

function getStatusRank(status?: string) {
  const normalized = status?.toLowerCase();
  if (normalized === 'open') return 5;
  if (normalized === 'investigating') return 4;
  if (normalized === 'contained') return 3;
  if (normalized === 'resolved') return 2;
  return 1;
}

function getIncidentNarrative(incident: Incident) {
  const actor = incident.primary_actor_id || 'unknown actor';
  const detections = incident.detection_ids?.length ?? 0;
  const responses = incident.response_ids?.length ?? 0;
  const status = incident.status || 'open';

  return `Incident affecting ${actor}. Currently ${status} with ${detections} detection${detections === 1 ? '' : 's'} and ${responses} response${responses === 1 ? '' : 's'} attached.`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterActor, setFilterActor] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getIncidents();
      setIncidents(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to fetch incidents');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = useMemo(() => {
    let next = [...incidents];

    if (filterStatus !== 'all') {
      next = next.filter(
        (incident) => incident.status?.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    if (filterSeverity !== 'all') {
      next = next.filter(
        (incident) => incident.severity?.toLowerCase() === filterSeverity.toLowerCase()
      );
    }

    if (filterActor.trim()) {
      const actorQuery = filterActor.trim().toLowerCase();
      next = next.filter((incident) =>
        String(incident.primary_actor_id ?? '').toLowerCase().includes(actorQuery)
      );
    }

    next.sort((a, b) => {
      if (sortBy === 'severity') {
        return getSeverityRank(b.severity) - getSeverityRank(a.severity);
      }

      if (sortBy === 'status') {
        return getStatusRank(b.status) - getStatusRank(a.status);
      }

      if (sortBy === 'risk') {
        return Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0);
      }

      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return next;
  }, [incidents, filterStatus, filterSeverity, filterActor, sortBy]);

  const metrics = useMemo(() => {
    return {
      total: incidents.length,
      open: incidents.filter((incident) => incident.status?.toLowerCase() === 'open').length,
      investigating: incidents.filter(
        (incident) => incident.status?.toLowerCase() === 'investigating'
      ).length,
      contained: incidents.filter(
        (incident) => incident.status?.toLowerCase() === 'contained'
      ).length,
      critical: incidents.filter(
        (incident) => incident.severity?.toLowerCase() === 'critical'
      ).length,
    };
  }, [incidents]);

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-amber-50 to-red-50 px-6 py-8 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-amber-950/20 dark:to-gray-900">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
              Investigations
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Incidents
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400 sm:text-base">
              Review aggregated incident records, monitor active investigations,
              and trace how detections and responses accumulated into durable cases.
            </p>
          </div>

          <button
            onClick={fetchIncidents}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-mono uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Total incidents
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-gray-100">
            {metrics.total}
          </p>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-white p-5 shadow-sm dark:border-red-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Open
          </p>
          <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
            {metrics.open}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-white p-5 shadow-sm dark:border-amber-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Investigating
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-400">
            {metrics.investigating}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-white p-5 shadow-sm dark:border-orange-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Contained
          </p>
          <p className="mt-2 text-3xl font-bold text-orange-700 dark:text-orange-400">
            {metrics.contained}
          </p>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-white p-5 shadow-sm dark:border-red-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Critical severity
          </p>
          <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
            {metrics.critical}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
            Investigation controls
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">
            Filter incidents by status, severity, actor, or sort by operational priority.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="contained">Contained</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="informational">Informational</option>
          </select>

          <input
            type="text"
            placeholder="Filter by actor"
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          >
            <option value="recent">Sort by recent</option>
            <option value="severity">Sort by severity</option>
            <option value="status">Sort by status</option>
            <option value="risk">Sort by risk</option>
          </select>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm font-mono text-cyan-700 animate-pulse dark:text-cyan-400">
            Loading incidents...
          </div>
        </div>
      )}

      {!loading && filteredIncidents.length === 0 && !error && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-mono text-slate-500 dark:text-gray-500">
            No incidents found. Run a scenario or adjust your filters.
          </p>
        </div>
      )}

      {!loading && filteredIncidents.length > 0 && (
        <section className="mt-6 space-y-4">
          {filteredIncidents.map((incident, index) => {
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
          })}
        </section>
      )}
    </div>
  );
}