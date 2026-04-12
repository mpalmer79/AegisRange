'use client';

import { useEffect, useState } from 'react';
import { getMetrics, getHealth, runScenario, getRiskProfiles } from '@/lib/api';
import { Metrics, HealthStatus, ScenarioResult, RiskProfile } from '@/lib/types';
import DashboardHeader from '@/app/components/dashboard/DashboardHeader';
import MetricCards from '@/app/components/dashboard/MetricCards';
import ScenarioGrid from '@/app/components/dashboard/ScenarioGrid';
import ScenarioResultPanel from '@/app/components/dashboard/ScenarioResult';
import TopRiskActors from '@/app/components/dashboard/TopRiskActors';
import MetricsBreakdown from '@/app/components/dashboard/MetricsBreakdown';

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

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <DashboardHeader health={health} onRefresh={fetchData} />

      {error && (
        <div className="mb-6 p-4 bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {loading && !metrics && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-600 dark:text-cyan-400 font-mono text-sm animate-pulse">Loading dashboard...</div>
        </div>
      )}

      <MetricCards metrics={metrics} />

      <ScenarioGrid runningScenario={runningScenario} onRunScenario={handleRunScenario} />

      {lastResult && <ScenarioResultPanel lastResult={lastResult} />}

      <TopRiskActors topRiskActors={topRiskActors} />

      {metrics && <MetricsBreakdown metrics={metrics} />}
    </div>
  );
}
