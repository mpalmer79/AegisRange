'use client';

import { useState } from 'react';
import { generateReport } from '@/lib/api';
import { ExerciseReport } from '@/lib/types';

export default function ReportsPage() {
  const [report, setReport] = useState<ExerciseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('AegisRange Exercise Report');

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await generateReport(title);
      setReport(data);
    } catch {
      setError('Failed to generate report. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Exercise Reports</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
            Generate comprehensive purple team exercise reports
          </p>
        </div>
      </div>

      {/* Report Generation */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-5 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Generate Report</h2>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider block mb-1">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded text-sm text-slate-800 dark:text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100">{report.title}</h2>
              <span className="text-xs font-mono text-slate-500 dark:text-gray-500">{formatTimestamp(report.generated_at)}</span>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Events', value: report.summary.total_events, color: 'text-cyan-700 dark:text-cyan-400' },
                { label: 'Alerts', value: report.summary.total_alerts, color: 'text-amber-700 dark:text-amber-400' },
                { label: 'Incidents', value: report.summary.total_incidents, color: 'text-red-700 dark:text-red-400' },
                { label: 'Responses', value: report.summary.total_responses, color: 'text-orange-700 dark:text-orange-400' },
                { label: 'Scenarios', value: report.summary.scenarios_executed, color: 'text-green-700 dark:text-green-400' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 bg-slate-200 dark:bg-gray-800/50 rounded-lg">
                  <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detection Coverage */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Detection Coverage</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-3xl font-bold font-mono text-cyan-700 dark:text-cyan-400">
                {report.detection_coverage.rules_triggered}/{report.detection_coverage.rules_total}
              </div>
              <div className="text-sm text-slate-600 dark:text-gray-400">detection rules triggered</div>
            </div>
            <div className="w-full h-3 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{ width: `${(report.detection_coverage.rules_triggered / report.detection_coverage.rules_total) * 100}%` }}
              />
            </div>
            {report.detection_coverage.rules_list && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.detection_coverage.rules_list.map((rule: Record<string, unknown>) => (
                  <div key={String(rule.rule_id)} className="flex items-center justify-between px-3 py-2 bg-slate-200 dark:bg-gray-800/30 rounded">
                    <span className="text-xs font-mono text-slate-700 dark:text-gray-300">{String(rule.rule_id)}</span>
                    <span className={`text-xs font-mono font-bold ${Number(rule.trigger_count) > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {Number(rule.trigger_count) > 0 ? `${rule.trigger_count} triggers` : 'not triggered'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MITRE Coverage */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">MITRE ATT&CK Coverage</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-slate-200 dark:bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400">{report.mitre_coverage.tactics_covered.length}</div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">Tactics Covered</div>
              </div>
              <div className="text-center p-3 bg-slate-200 dark:bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400">{report.mitre_coverage.techniques_covered.length}</div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">Techniques Covered</div>
              </div>
              <div className="text-center p-3 bg-slate-200 dark:bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400">{Math.round(report.mitre_coverage.coverage_percentage)}%</div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">Coverage</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Recommendations</h3>
            <div className="space-y-3">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-200 dark:bg-gray-800/30 rounded">
                  <span className="flex-shrink-0 w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-xs font-mono text-cyan-700 dark:text-cyan-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-gray-300">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
