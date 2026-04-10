'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMetrics, getHealth, runScenario, getRiskProfiles } from '@/lib/api';
import { Metrics, HealthStatus, SCENARIO_DEFINITIONS, ScenarioResult, RiskProfile } from '@/lib/types';
import ThemeToggle from '@/components/ThemeToggle';

// Color palette per scenario — each card gets its own accent so the grid stays
// lively in both light and dark modes. Keep this aligned with the scenario
// drill-down pages we ship in later phases.
const SCENARIO_ACCENTS: Record<
  string,
  {
    ring: string;       // border + hover
    glow: string;       // box shadow
    chip: string;       // id badge pill
    icon: string;       // icon bg
    title: string;      // title color
    gradient: string;   // faint gradient behind the card
  }
> = {
  'scn-auth-001': {
    ring: 'border-rose-300/70 dark:border-rose-500/30 hover:border-rose-500 dark:hover:border-rose-400',
    glow: 'hover:shadow-rose-400/30 dark:hover:shadow-rose-500/20',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    icon: 'from-rose-500 to-red-600',
    title: 'text-rose-700 dark:text-rose-300',
    gradient: 'from-rose-100/60 via-white to-white dark:from-rose-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-session-002': {
    ring: 'border-amber-300/70 dark:border-amber-500/30 hover:border-amber-500 dark:hover:border-amber-400',
    glow: 'hover:shadow-amber-400/30 dark:hover:shadow-amber-500/20',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    icon: 'from-amber-500 to-orange-600',
    title: 'text-amber-700 dark:text-amber-300',
    gradient: 'from-amber-100/60 via-white to-white dark:from-amber-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-doc-003': {
    ring: 'border-emerald-300/70 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400',
    glow: 'hover:shadow-emerald-400/30 dark:hover:shadow-emerald-500/20',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: 'from-emerald-500 to-teal-600',
    title: 'text-emerald-700 dark:text-emerald-300',
    gradient: 'from-emerald-100/60 via-white to-white dark:from-emerald-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-doc-004': {
    ring: 'border-violet-300/70 dark:border-violet-500/30 hover:border-violet-500 dark:hover:border-violet-400',
    glow: 'hover:shadow-violet-400/30 dark:hover:shadow-violet-500/20',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    icon: 'from-violet-500 to-purple-600',
    title: 'text-violet-700 dark:text-violet-300',
    gradient: 'from-violet-100/60 via-white to-white dark:from-violet-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-svc-005': {
    ring: 'border-sky-300/70 dark:border-sky-500/30 hover:border-sky-500 dark:hover:border-sky-400',
    glow: 'hover:shadow-sky-400/30 dark:hover:shadow-sky-500/20',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    icon: 'from-sky-500 to-blue-600',
    title: 'text-sky-700 dark:text-sky-300',
    gradient: 'from-sky-100/60 via-white to-white dark:from-sky-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-corr-006': {
    ring: 'border-fuchsia-300/70 dark:border-fuchsia-500/30 hover:border-fuchsia-500 dark:hover:border-fuchsia-400',
    glow: 'hover:shadow-fuchsia-400/30 dark:hover:shadow-fuchsia-500/20',
    chip: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
    icon: 'from-fuchsia-500 via-pink-500 to-rose-600',
    title: 'text-fuchsia-700 dark:text-fuchsia-300',
    gradient: 'from-fuchsia-100/60 via-white to-white dark:from-fuchsia-500/5 dark:via-gray-900 dark:to-gray-900',
  },
};

const DEFAULT_ACCENT = SCENARIO_ACCENTS['scn-auth-001'];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioResult | null>(null);
  const [topRiskActors, setTopRiskActors] = useState<RiskProfile[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, h, rp] = await Promise.allSettled([getMetrics(), getHealth(), getRiskProfiles()]);
      if (m.status === 'fulfilled') setMetrics(m.value);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (rp.status === 'fulfilled') {
        const sorted = [...rp.value].sort((a, b) => b.current_score - a.current_score).slice(0, 5);
        setTopRiskActors(sorted);
      }
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
      color: 'text-cyan-700 dark:text-cyan-300',
      bg: 'bg-gradient-to-br from-cyan-50 to-sky-100 dark:from-cyan-500/10 dark:to-sky-500/10',
      border: 'border-cyan-300/70 dark:border-cyan-500/30',
      href: '/events',
    },
    {
      label: 'Alerts',
      value: metrics?.total_alerts ?? '-',
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-500/10 dark:to-orange-500/10',
      border: 'border-amber-300/70 dark:border-amber-500/30',
      href: '/alerts',
    },
    {
      label: 'Incidents',
      value: metrics?.total_incidents ?? '-',
      color: 'text-rose-700 dark:text-rose-300',
      bg: 'bg-gradient-to-br from-rose-50 to-red-100 dark:from-rose-500/10 dark:to-red-500/10',
      border: 'border-rose-300/70 dark:border-rose-500/30',
      href: '/incidents',
    },
    {
      label: 'Active Containments',
      value: metrics?.active_containments ?? '-',
      color: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-500/10 dark:to-teal-500/10',
      border: 'border-emerald-300/70 dark:border-emerald-500/30',
      href: '/incidents',
    },
  ];

  return (
    <div className="text-slate-800 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 ar-fade-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="ar-gradient-text">Dashboard</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Security Operations Overview</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
            health?.status === 'healthy' || health?.status === 'ok'
              ? 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : health
              ? 'bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
              : 'bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-slate-500 dark:text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              health?.status === 'healthy' || health?.status === 'ok'
                ? 'bg-emerald-500 animate-pulse'
                : health
                ? 'bg-rose-500'
                : 'bg-slate-400 dark:bg-gray-600'
            }`} />
            {health ? health.status.toUpperCase() : 'UNKNOWN'}
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-mono bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-300 dark:border-gray-700 rounded text-slate-700 dark:text-gray-300 transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Prominent theme toggle banner */}
      <section
        aria-label="Appearance settings"
        className="relative overflow-hidden mb-8 ar-slide-up rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-gradient-to-br from-white via-sky-50 to-indigo-50 dark:from-gray-900 dark:via-indigo-950/40 dark:to-gray-900 p-5 sm:p-6 shadow-lg shadow-slate-200/60 dark:shadow-black/40"
      >
        {/* Decorative orbs */}
        <div aria-hidden className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-amber-300/40 via-orange-300/30 to-transparent blur-3xl" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-gradient-to-tr from-indigo-500/30 via-violet-500/20 to-transparent blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-[11px] font-mono tracking-[0.2em] text-slate-500 dark:text-gray-500 uppercase mb-1">
              Appearance
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-gray-100">
              Pick your visual mode
            </h2>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 max-w-md">
              Toggle between a bright daylight UI and the classic SOC dark theme. Your choice is remembered across sessions.
            </p>
          </div>
          <div className="flex-shrink-0">
            <ThemeToggle size="lg" />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !metrics && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-600 dark:text-cyan-400 font-mono text-sm animate-pulse">Loading dashboard...</div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 ar-stagger">
        {metricCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`${card.bg} border ${card.border} rounded-xl p-5 ar-card-hover shadow-sm dark:shadow-none`}
          >
            <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider font-mono mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color} font-[family-name:var(--font-geist-mono)]`}>{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick Scenarios */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Quick Scenarios</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
              Click a card to enter the interactive mission briefing.
            </p>
          </div>
          <Link
            href="/scenarios"
            className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
          >
            VIEW ALL &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ar-stagger">
          {SCENARIO_DEFINITIONS.map((s) => {
            const accent = SCENARIO_ACCENTS[s.id] ?? DEFAULT_ACCENT;
            const isRunning = runningScenario === s.id;
            return (
              <div key={s.id} className="relative group">
                <Link
                  href={`/scenarios/${s.id}`}
                  aria-label={`Open ${s.name} briefing`}
                  className={`block p-5 rounded-xl border-2 bg-gradient-to-br ${accent.gradient} ${accent.ring} shadow-sm hover:shadow-lg dark:shadow-none ${accent.glow} ar-card-hover`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent.icon} flex items-center justify-center shadow-md`}>
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l9 4-9 18-9-18 9-4z" />
                      </svg>
                    </div>
                    <span className={`inline-flex items-center text-[10px] font-mono tracking-wider px-2 py-1 rounded-full ${accent.chip}`}>
                      {s.id.toUpperCase()}
                    </span>
                  </div>
                  <p className={`text-base font-semibold ${accent.title} mb-1.5`}>{s.name}</p>
                  <p className="text-xs text-slate-600 dark:text-gray-400 line-clamp-2 mb-3">
                    {s.description}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-gray-800/80">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
                      Open briefing
                    </span>
                    <span className={`text-sm ar-arrow ${accent.title}`}>&rarr;</span>
                  </div>
                </Link>
                {/* Small Run-in-place button — does not navigate */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRunScenario(s.id);
                  }}
                  disabled={runningScenario !== null}
                  aria-label={`Run ${s.name} scenario in place`}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-white/90 dark:bg-gray-950/90 backdrop-blur border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isRunning ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-300 animate-pulse" />
                      RUNNING
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      RUN
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="p-5 bg-white dark:bg-gray-900 border-2 border-cyan-300 dark:border-cyan-500/30 rounded-xl shadow-md dark:shadow-none ar-bounce-in">
          <h3 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 mb-3 font-mono">LAST SCENARIO RESULT</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Scenario</p>
              <p className="font-mono text-slate-800 dark:text-gray-200">{lastResult.scenario_id}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Correlation ID</p>
              <p className="font-mono text-cyan-700 dark:text-cyan-300 text-xs break-all">{lastResult.correlation_id}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Events / Alerts</p>
              <p className="font-mono text-slate-800 dark:text-gray-200">
                {lastResult.events_generated ?? 0} / {lastResult.alerts_generated ?? 0}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Incident</p>
              {lastResult.incident_id ? (
                <Link href={`/incidents/${lastResult.correlation_id}`} className="font-mono text-rose-600 dark:text-rose-400 hover:underline text-xs">
                  {lastResult.incident_id}
                </Link>
              ) : (
                <p className="font-mono text-slate-500 dark:text-gray-500">None</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Risk Actors */}
      {topRiskActors.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200">Top Risk Actors</h2>
            <Link href="/analytics" className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors">
              View All &rarr;
            </Link>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
            <div className="space-y-3">
              {topRiskActors.map((actor) => {
                const color =
                  actor.current_score >= 81 ? 'bg-rose-500' :
                  actor.current_score >= 51 ? 'bg-orange-500' :
                  actor.current_score >= 21 ? 'bg-amber-500' : 'bg-emerald-500';
                const textColor =
                  actor.current_score >= 81 ? 'text-rose-600 dark:text-rose-300' :
                  actor.current_score >= 51 ? 'text-orange-600 dark:text-orange-300' :
                  actor.current_score >= 21 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300';
                return (
                  <div key={actor.actor_id} className="flex items-center gap-4">
                    <span className="text-sm font-mono text-cyan-700 dark:text-cyan-300 w-32 truncate">{actor.actor_id}</span>
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} ar-bar-grow transition-all`}
                        style={{ width: `${Math.min(actor.current_score, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono font-bold w-8 text-right ${textColor}`}>
                      {actor.current_score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Additional metrics breakdown */}
      {metrics && (Object.keys(metrics.events_by_category).length > 0 || Object.keys(metrics.alerts_by_severity).length > 0 || Object.keys(metrics.incidents_by_status).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {Object.keys(metrics.events_by_category).length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
              <h3 className="text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3">Events by Category</h3>
              <div className="space-y-2">
                {Object.entries(metrics.events_by_category).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-gray-400">{cat}</span>
                    <span className="text-sm font-mono text-cyan-700 dark:text-cyan-300">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(metrics.alerts_by_severity).length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
              <h3 className="text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3">Alerts by Severity</h3>
              <div className="space-y-2">
                {Object.entries(metrics.alerts_by_severity).map(([sev, count]) => {
                  const color =
                    sev === 'critical' ? 'text-rose-600 dark:text-rose-300' :
                    sev === 'high' ? 'text-orange-600 dark:text-orange-300' :
                    sev === 'medium' ? 'text-amber-600 dark:text-amber-300' : 'text-sky-600 dark:text-sky-300';
                  return (
                    <div key={sev} className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-gray-400 capitalize">{sev}</span>
                      <span className={`text-sm font-mono ${color}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {Object.keys(metrics.incidents_by_status).length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
              <h3 className="text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3">Incidents by Status</h3>
              <div className="space-y-2">
                {Object.entries(metrics.incidents_by_status).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-gray-400 capitalize">{status}</span>
                    <span className="text-sm font-mono text-rose-600 dark:text-rose-300">{count}</span>
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
