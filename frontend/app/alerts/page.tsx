'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAlerts } from '@/lib/api';
import { Alert } from '@/lib/types';

const SEVERITY_STYLES: Record<string, { badge: string; border: string }> = {
  critical: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    border: 'border-red-500/30',
  },
  high: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    border: 'border-orange-500/30',
  },
  medium: {
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/30',
  },
  low: {
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
  },
  informational: {
    badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    border: 'border-gray-500/30',
  },
};

function getSeverityStyle(severity: string) {
  return SEVERITY_STYLES[severity?.toLowerCase()] ?? SEVERITY_STYLES.low;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterRuleId, setFilterRuleId] = useState('');
  const [filterActorId, setFilterActorId] = useState('');

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

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Security alerts ({alerts.length} total)
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="px-3 py-1.5 text-xs font-mono bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Filter by rule_id"
          value={filterRuleId}
          onChange={(e) => setFilterRuleId(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/50 w-48"
        />
        <input
          type="text"
          placeholder="Filter by actor_id"
          value={filterActorId}
          onChange={(e) => setFilterActorId(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/50 w-48"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-400 font-mono text-sm animate-pulse">Loading alerts...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && alerts.length === 0 && !error && (
        <div className="text-center py-20 text-gray-500 font-mono text-sm">
          No alerts found. Run a scenario to generate alerts.
        </div>
      )}

      {/* Alert Cards */}
      {!loading && alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert, i) => {
            const style = getSeverityStyle(alert.severity);
            return (
              <div
                key={alert.alert_id || i}
                className={`bg-gray-900 border ${style.border} rounded-lg p-5`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-mono text-gray-500 block mb-1">
                      {alert.rule_id}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-100">
                      {alert.rule_name}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-medium uppercase border ${style.badge}`}
                  >
                    {alert.severity}
                  </span>
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  {alert.summary}
                </p>

                {/* Details row */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-600 font-mono">ACTOR </span>
                    <span className="text-gray-300 font-mono">{alert.actor_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-mono">CONFIDENCE </span>
                    <span className="text-gray-300 font-mono uppercase">
                      {alert.confidence}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-mono">TIME </span>
                    <span className="text-gray-400 font-mono">
                      {formatTimestamp(alert.created_at)}
                    </span>
                  </div>
                </div>

                {alert.correlation_id && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <span className="text-gray-600 text-xs font-mono">CORR </span>
                    <span className="text-cyan-500/70 text-xs font-mono break-all">
                      {alert.correlation_id}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
