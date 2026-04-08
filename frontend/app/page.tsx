'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMetrics, getHealth, runScenario } from '@/lib/api';
import { Metrics, HealthStatus, SCENARIO_DEFINITIONS, ScenarioResult } from '@/lib/types';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioResult | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, h] = await Promise.allSettled([getMetrics(), getHealth()]);
      if (m.status === 'fulfilled') setMetrics(m.value);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (m.status === 'rejected' && h.status === 'rejected') {
        setError('Failed to connect to API. Is the backend running?');
      }
    } catch {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    try {
      const result = await runScenario(scenarioId);
      setLastResult(result);
      fetchData();
    } catch {
      setLastResult(null);
    } finally {
      setRunningScenario(null);
    }
  };

  const metricCards = [
    {
      label: 'Total Events',
      value: metrics?.total_events ?? '-',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      href: '/events',
    },
    {
      label: 'Alerts',
      value: metrics?.total_alerts ?? '-',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      href: '/alerts',
    },
    {
      label: 'Incidents',
      value: metrics?.total_incidents ?? '-',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      href: '/incidents',
    },
    {
      label: 'Active Containments',
      value: metrics?.active_containments ?? '-',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      href: '/incidents',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Security Operations Overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
            health?.status === 'healthy' || health?.status === 'ok'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : health
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-gray-800 border-gray-700 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              health?.status === 'healthy' || health?.status === 'ok'
                ? 'bg-green-400 animate-pulse'
                : health
                ? 'bg-red-400'
                : 'bg-gray-600'
            }`} />
            {health ? health.status.toUpperCase() : 'UNKNOWN'}
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-mono bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !metrics && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-400 font-mono text-sm animate-pulse">Loading dashboard...</div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metricCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`${card.bg} border ${card.border} rounded-lg p-5 hover:brightness-125 transition-all`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color} font-[family-name:var(--font-geist-mono)]`}>{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick Scenarios */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Quick Scenarios</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIO_DEFINITIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleRunScenario(s.id)}
              disabled={runningScenario !== null}
              className="text-left p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-cyan-500/40 hover:bg-gray-900/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-cyan-500">{s.id.toUpperCase()}</span>
                {runningScenario === s.id && (
                  <span className="text-xs text-cyan-400 animate-pulse font-mono">RUNNING...</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-200">{s.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="p-5 bg-gray-900 border border-cyan-500/30 rounded-lg">
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 font-mono">LAST SCENARIO RESULT</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-1">Scenario</p>
              <p className="font-mono text-gray-200">{lastResult.scenario_id}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Correlation ID</p>
              <p className="font-mono text-cyan-400 text-xs break-all">{lastResult.correlation_id}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Events / Alerts</p>
              <p className="font-mono text-gray-200">
                {lastResult.events_generated ?? 0} / {lastResult.alerts_generated ?? 0}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Incident</p>
              {lastResult.incident_id ? (
                <Link href={`/incidents/${lastResult.correlation_id}`} className="font-mono text-red-400 hover:underline text-xs">
                  {lastResult.incident_id}
                </Link>
              ) : (
                <p className="font-mono text-gray-500">None</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional metrics breakdown */}
      {metrics && (metrics.events_by_category || metrics.alerts_by_severity || metrics.incidents_by_status) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {metrics.events_by_category && Object.keys(metrics.events_by_category).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Events by Category</h3>
              <div className="space-y-2">
                {Object.entries(metrics.events_by_category).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">{cat}</span>
                    <span className="text-sm font-mono text-cyan-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {metrics.alerts_by_severity && Object.keys(metrics.alerts_by_severity).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Alerts by Severity</h3>
              <div className="space-y-2">
                {Object.entries(metrics.alerts_by_severity).map(([sev, count]) => {
                  const color = sev === 'critical' ? 'text-red-400' : sev === 'high' ? 'text-orange-400' : sev === 'medium' ? 'text-yellow-400' : 'text-blue-400';
                  return (
                    <div key={sev} className="flex justify-between items-center">
                      <span className="text-sm text-gray-400 capitalize">{sev}</span>
                      <span className={`text-sm font-mono ${color}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {metrics.incidents_by_status && Object.keys(metrics.incidents_by_status).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Incidents by Status</h3>
              <div className="space-y-2">
                {Object.entries(metrics.incidents_by_status).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 capitalize">{status}</span>
                    <span className="text-sm font-mono text-red-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
