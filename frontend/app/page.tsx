'use client';

import { useCallback, useMemo, useState } from 'react';
import { getMetrics, getHealth, runScenario, getRiskProfiles, getScenarioErrorMessage } from '@/lib/api';
import { Metrics, HealthStatus, ScenarioResult, RiskProfile } from '@/lib/types';
import { useApi } from '@/lib/hooks/useApi';
import DashboardHeader from '@/app/components/dashboard/DashboardHeader';
import MetricCards from '@/app/components/dashboard/MetricCards';
import ScenarioGrid from '@/app/components/dashboard/ScenarioGrid';
import ScenarioResultPanel from '@/app/components/dashboard/ScenarioResult';
import TopRiskActors from '@/app/components/dashboard/TopRiskActors';
import MetricsBreakdown from '@/app/components/dashboard/MetricsBreakdown';

export default function DashboardPage() {
  const { data: metrics, loading: mLoading, error: mError, refetch: refetchMetrics } = useApi<Metrics>(getMetrics);
  const { data: health, loading: hLoading, error: hError, refetch: refetchHealth } = useApi<HealthStatus>(getHealth);
  const { data: riskData, loading: rpLoading, refetch: refetchRisk } = useApi<RiskProfile[]>(getRiskProfiles);

  const loading = mLoading || hLoading || rpLoading;
  const error = !loading && mError && hError ? 'Failed to connect to API. Is the backend running?' : null;
  const topRiskActors = useMemo(
    () => riskData ? [...riskData].sort((a, b) => b.current_score - a.current_score).slice(0, 5) : [],
    [riskData]
  );

  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioResult | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    refetchMetrics();
    refetchHealth();
    refetchRisk();
  }, [refetchMetrics, refetchHealth, refetchRisk]);

  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    setScenarioError(null);
    try {
      const result = await runScenario(scenarioId);
      setLastResult(result);
      fetchData();
    } catch (err) {
      setLastResult(null);
      setScenarioError(getScenarioErrorMessage(err));
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

      {scenarioError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {scenarioError}
        </div>
      )}

      {lastResult && <ScenarioResultPanel lastResult={lastResult} />}

      <TopRiskActors topRiskActors={topRiskActors} />

      {metrics && <MetricsBreakdown metrics={metrics} />}
    </div>
  );
}
