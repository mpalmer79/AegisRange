'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAlerts } from '@/lib/api';
import { Alert } from '@/lib/types';

const SEVERITY_STYLES: Record<string, { badge: string; border: string; accent: string }> = {
  critical: {
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    border: 'border-red-500/30',
    accent: 'text-red-700 dark:text-red-400',
  },
  high: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    border: 'border-orange-500/30',
    accent: 'text-orange-700 dark:text-orange-400',
  },
  medium: {
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/30',
    accent: 'text-yellow-700 dark:text-yellow-400',
  },
  low: {
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    accent: 'text-blue-700 dark:text-blue-400',
  },
  informational: {
    badge: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
    border: 'border-gray-500/30',
    accent: 'text-slate-600 dark:text-gray-400',
  },
};

function getSeverityStyle(severity: string) {
  return SEVERITY_STYLES[severity?.toLowerCase()] ?? SEVERITY_STYLES.low;
}

function getSeverityRank(severity: string) {
  const normalized = severity?.toLowerCase();
  if (normalized === 'critical') return 5;
  if (normalized === 'high') return 4;
  if (normalized === 'medium') return 3;
  if (normalized === 'low') return 2;
  return 1;
}

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatConfidence(confidence: string | number | null | undefined) {
  if (confidence === null || confidence === undefined || confidence === '') {
    return 'unknown';
  }

  if (typeof confidence === 'number') {
    return `${Math.round(confidence * 100)}%`;
  }

  return String(confidence);
}

function getWhyItMatters(alert: Alert) {
  if (alert.summary?.trim()) return alert.summary.trim();
  if (alert.rule_name?.trim()) return `Triggered by ${alert.rule_name}.`;
  return 'Detection generated without a detailed summary.';
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterRuleId, setFilterRuleId] = useState('');
  const [filterActorId, setFilterActorId] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterConfidence, setFilterConfidence] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (filterRuleId.trim()) params.rule_id = filterRuleId.trim();
      if (filterActorId.trim()) params.actor_id = filterActorId.trim();

      const data = await getAlerts(params);
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to fetch alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filterRuleId, filterActorId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = useMemo(() => {
    let next = [...alerts];

    if (filterSeverity !== 'all') {
      next = next.filter(
        (alert) => alert.severity?.toLowerCase() === filterSeverity.toLowerCase()
      );
    }

    if (filterConfidence !== 'all') {
      next = next.filter(
        (alert) =>
          String(alert.confidence ?? '').toLowerCase() === filterConfidence.toLowerCase()
      );
    }

    next.sort((a, b) => {
      if (sortBy === 'severity') {
        return getSeverityRank(b.severity) - getSeverityRank(a.severity);
      }

      if (sortBy === 'confidence') {
        return String(b.confidence ?? '').localeCompare(String(a.confidence ?? ''));
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return next;
  }, [alerts, filterSeverity, filterConfidence, sortBy]);

  const metrics = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity?.toLowerCase() === 'critical').length,
      high: alerts.filter((a) => a.severity?.toLowerCase() === 'high').length,
      actors: new Set(alerts.map((a) => a.actor_id).filter(Boolean)).size,
    };
  }, [alerts]);

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-rose-50 to-orange-50 px-6 py-8 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-red-950/20 dark:to-gray-900">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-400/15 blur-3xl dark:bg-red-500/10"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-red-700 dark:text-red-400">
              Detection Queue
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Alerts
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400 sm:text-base">
              Review detections generated by the rule engine, triage by severity,
              and identify which alerts need deeper investigation or incident linkage.
            </p>
          </div>

          <button
            onClick={fetchAlerts}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-mono uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Total alerts
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-gray-100">
            {metrics.total}
          </p>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-white p-5 shadow-sm dark:border-red-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Critical
          </p>
          <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
            {metrics.critical}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-white p-5 shadow-sm dark:border-orange-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            High
          </p>
          <p className="mt-2 text-3xl font-bold text-orange-700 dark:text-orange-400">
            {metrics.high}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Distinct actors
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-gray-100">
            {metrics.actors}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
            Triage controls
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">
            Narrow the queue by rule, actor, severity, confidence, or sort order.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="text"
            placeholder="Filter by rule_id"
            value={filterRuleId}
            onChange={(e) => setFilterRuleId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
          />

          <input
            type="text"
            placeholder="Filter by actor_id"
            value={filterActorId}
            onChange={(e) => setFilterActorId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
          />

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

          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          >
            <option value="all">All confidence</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          >
            <option value="recent">Sort by recent</option>
            <option value="severity">Sort by severity</option>
            <option value="confidence">Sort by confidence</option>
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
            Loading alerts...
          </div>
        </div>
      )}

      {!loading && filteredAlerts.length === 0 && !error && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-mono text-slate-500 dark:text-gray-500">
            No alerts found. Run a scenario or adjust your filters.
          </p>
        </div>
      )}

      {!loading && filteredAlerts.length > 0 && (
        <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredAlerts.map((alert, index) => {
            const style = getSeverityStyle(alert.severity);
            const content = (
              <div
                className={`rounded-2xl border ${style.border} bg-white p-5 shadow-sm transition-colors hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-900/80`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-gray-500">
                      {alert.rule_id || 'unknown_rule'}
                    </p>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">
                      {alert.rule_name || 'Unnamed detection rule'}
                    </h3>
                  </div>

                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs font-mono uppercase ${style.badge}`}
                  >
                    {alert.severity || 'low'}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Why this matters
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
                    {getWhyItMatters(alert)}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Actor
                    </p>
                    <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
                      {alert.actor_id || 'unknown'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Confidence
                    </p>
                    <p className={`mt-1 text-sm font-mono uppercase ${style.accent}`}>
                      {formatConfidence(alert.confidence)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                      {formatTimestamp(alert.created_at)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Correlation
                    </p>
                    <p className="mt-1 break-all text-sm font-mono text-cyan-700 dark:text-cyan-400">
                      {alert.correlation_id || 'not linked'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-gray-800">
                  <p className="text-xs text-slate-500 dark:text-gray-500">
                    Alert {index + 1} of {filteredAlerts.length}
                  </p>

                  {alert.alert_id ? (
                    <span className="text-xs font-mono uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                      View detail
                    </span>
                  ) : (
                    <span className="text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-gray-500">
                      List only
                    </span>
                  )}
                </div>
              </div>
            );

            if (alert.alert_id) {
              return (
                <Link key={alert.alert_id} href={`/alerts/${alert.alert_id}`} className="block">
                  {content}
                </Link>
              );
            }

            return <div key={`alert-${index}`}>{content}</div>;
          })}
        </section>
      )}
    </div>
  );
}