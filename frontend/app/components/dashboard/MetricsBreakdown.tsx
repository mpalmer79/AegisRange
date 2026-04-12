'use client';

import { Metrics } from '@/lib/types';

interface MetricsBreakdownProps {
  metrics: Metrics;
}

export default function MetricsBreakdown({ metrics }: MetricsBreakdownProps) {
  const hasEvents = Object.keys(metrics.events_by_category).length > 0;
  const hasAlerts = Object.keys(metrics.alerts_by_severity).length > 0;
  const hasIncidents = Object.keys(metrics.incidents_by_status).length > 0;

  if (!hasEvents && !hasAlerts && !hasIncidents) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      {hasEvents && (
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
      {hasAlerts && (
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
      {hasIncidents && (
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
  );
}
