'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAlerts } from '@/lib/api';
import { Alert } from '@/lib/types';
import AlertsHeader from './components/AlertsHeader';
import AlertsMetrics from './components/AlertsMetrics';
import AlertsFilters from './components/AlertsFilters';
import AlertCard from './components/AlertCard';
import { getSeverityRank } from './components/alertUtils';

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
      <AlertsHeader onRefresh={fetchAlerts} />

      <AlertsMetrics metrics={metrics} />

      <AlertsFilters
        filterRuleId={filterRuleId}
        filterActorId={filterActorId}
        filterSeverity={filterSeverity}
        filterConfidence={filterConfidence}
        sortBy={sortBy}
        onFilterRuleIdChange={setFilterRuleId}
        onFilterActorIdChange={setFilterActorId}
        onFilterSeverityChange={setFilterSeverity}
        onFilterConfidenceChange={setFilterConfidence}
        onSortByChange={setSortBy}
      />

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
          {filteredAlerts.map((alert, index) => (
            <AlertCard
              key={alert.alert_id || `alert-${index}`}
              alert={alert}
              index={index}
              total={filteredAlerts.length}
            />
          ))}
        </section>
      )}
    </div>
  );
}
