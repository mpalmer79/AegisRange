'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIncidents } from '@/lib/api';
import { Incident } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  investigating: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  contained: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  closed: 'bg-gray-500/20 text-slate-600 dark:text-gray-400 border-gray-500/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-700 dark:text-red-400',
  high: 'text-orange-700 dark:text-orange-400',
  medium: 'text-yellow-700 dark:text-yellow-400',
  low: 'text-blue-700 dark:text-blue-400',
  informational: 'text-slate-600 dark:text-gray-400',
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = async () => {
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
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '-';
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Incidents</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
            Security incidents ({incidents.length} total)
          </p>
        </div>
        <button
          onClick={fetchIncidents}
          className="px-3 py-1.5 text-xs font-mono bg-slate-200 dark:bg-gray-800 hover:bg-gray-700 border border-slate-300 dark:border-gray-700 rounded text-slate-700 dark:text-gray-300 transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-700 dark:text-cyan-400 font-mono text-sm animate-pulse">Loading incidents...</div>
        </div>
      )}

      {/* Empty */}
      {!loading && incidents.length === 0 && !error && (
        <div className="text-center py-20 text-slate-500 dark:text-gray-500 font-mono text-sm">
          No incidents found. Run a scenario to generate incidents.
        </div>
      )}

      {/* Incident List */}
      {!loading && incidents.length > 0 && (
        <div className="space-y-3">
          {incidents.map((incident, i) => (
            <Link
              key={incident.correlation_id || i}
              href={`/incidents/${incident.correlation_id}`}
              className="block bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-5 hover:border-cyan-500/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm text-slate-800 dark:text-gray-200 font-medium">
                      {incident.incident_id || incident.correlation_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono uppercase border ${
                        STATUS_STYLES[incident.status] ?? STATUS_STYLES.open
                      }`}
                    >
                      {incident.status}
                    </span>
                    <span
                      className={`text-xs font-mono uppercase ${
                        SEVERITY_COLORS[incident.severity] ?? 'text-slate-600 dark:text-gray-400'
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>



                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs">
                    {incident.primary_actor_id && (
                      <div>
                        <span className="text-slate-400 dark:text-gray-600 font-mono">ACTOR </span>
                        <span className="text-slate-600 dark:text-gray-400 font-mono">{incident.primary_actor_id}</span>
                      </div>
                    )}
                    {incident.risk_score != null && (
                      <div>
                        <span className="text-slate-400 dark:text-gray-600 font-mono">RISK </span>
                        <span className="text-red-700 dark:text-red-400 font-mono">{incident.risk_score}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 dark:text-gray-600 font-mono">DETECTIONS </span>
                      <span className="text-slate-600 dark:text-gray-400 font-mono">
                        {incident.detection_ids?.length ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-gray-600 font-mono">RESPONSES </span>
                      <span className="text-slate-600 dark:text-gray-400 font-mono">
                        {incident.response_ids?.length ?? 0}
                      </span>
                    </div>
                    {incident.created_at && (
                      <div>
                        <span className="text-slate-400 dark:text-gray-600 font-mono">CREATED </span>
                        <span className="text-slate-600 dark:text-gray-400 font-mono">
                          {formatTimestamp(incident.created_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <svg
                  className="w-5 h-5 text-slate-400 dark:text-gray-600 group-hover:text-cyan-400 transition-colors shrink-0 mt-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
