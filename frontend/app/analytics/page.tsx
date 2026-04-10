'use client';

import { useEffect, useState } from 'react';
import { getRiskProfiles, getRuleEffectiveness, getScenarioHistory } from '@/lib/api';
import { RiskProfile, RuleEffectiveness, ScenarioHistoryEntry } from '@/lib/types';
import Link from 'next/link';

function riskScoreColor(score: number): string {
  if (score >= 81) return 'bg-red-500';
  if (score >= 51) return 'bg-orange-500';
  if (score >= 21) return 'bg-amber-500';
  return 'bg-green-500';
}

function riskScoreTextColor(score: number): string {
  if (score >= 81) return 'text-red-700 dark:text-red-400';
  if (score >= 51) return 'text-orange-700 dark:text-orange-400';
  if (score >= 21) return 'text-amber-700 dark:text-amber-400';
  return 'text-green-700 dark:text-green-400';
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-700 dark:text-red-400 bg-red-500/20 border-red-500/30',
  high: 'text-orange-700 dark:text-orange-400 bg-orange-500/20 border-orange-500/30',
  medium: 'text-yellow-700 dark:text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  low: 'text-blue-700 dark:text-blue-400 bg-blue-500/20 border-blue-500/30',
  informational: 'text-slate-600 dark:text-gray-400 bg-gray-500/20 border-gray-500/30',
};

export default function AnalyticsPage() {
  const [riskProfiles, setRiskProfiles] = useState<RiskProfile[]>([]);
  const [ruleEffectiveness, setRuleEffectiveness] = useState<RuleEffectiveness[]>([]);
  const [scenarioHistory, setScenarioHistory] = useState<ScenarioHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [profiles, rules, history] = await Promise.allSettled([
          getRiskProfiles(),
          getRuleEffectiveness(),
          getScenarioHistory(),
        ]);
        if (profiles.status === 'fulfilled') setRiskProfiles(profiles.value);
        if (rules.status === 'fulfilled') setRuleEffectiveness(rules.value);
        if (history.status === 'fulfilled') setScenarioHistory(history.value);
        if (
          profiles.status === 'rejected' &&
          rules.status === 'rejected' &&
          history.status === 'rejected'
        ) {
          setError('Failed to fetch analytics data. Is the backend running?');
        }
      } catch {
        setError('Failed to fetch analytics data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const sortedProfiles = [...riskProfiles].sort((a, b) => b.current_score - a.current_score);
  const sortedRules = [...ruleEffectiveness].sort((a, b) => b.trigger_count - a.trigger_count);

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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Risk profiles, rule effectiveness, and scenario history</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-700 dark:text-cyan-400 font-mono text-sm animate-pulse">Loading analytics...</div>
        </div>
      )}

      {!loading && (
        <>
          {/* Risk Profiles Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Risk Profiles</h2>
            {sortedProfiles.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-8 text-center">
                <p className="text-slate-500 dark:text-gray-500 font-mono text-sm">No risk profile data available</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Actor ID</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Current Score</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Peak Score</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Contributing Rules</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProfiles.map((profile) => (
                      <tr key={profile.actor_id} className="border-b border-slate-200 dark:border-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-cyan-700 dark:text-cyan-400">{profile.actor_id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`font-mono font-bold ${riskScoreTextColor(profile.current_score)}`}>
                              {profile.current_score}
                            </span>
                            <div className="w-24 h-2 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${riskScoreColor(profile.current_score)} transition-all`}
                                style={{ width: `${Math.min(profile.current_score, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono ${riskScoreTextColor(profile.peak_score)}`}>
                            {profile.peak_score}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {profile.contributing_rules.map((rule) => (
                              <span
                                key={rule}
                                className="px-2 py-0.5 text-xs font-mono bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded text-slate-600 dark:text-gray-400"
                              >
                                {rule}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500">
                          {formatTimestamp(profile.last_updated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rule Effectiveness Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Rule Effectiveness</h2>
            {sortedRules.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-8 text-center">
                <p className="text-slate-500 dark:text-gray-500 font-mono text-sm">No rule effectiveness data available</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Rule ID</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Rule Name</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Trigger Count</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Severity</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Actors Affected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRules.map((rule) => (
                      <tr key={rule.rule_id} className="border-b border-slate-200 dark:border-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-cyan-700 dark:text-cyan-400 text-xs">{rule.rule_id}</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-gray-200">{rule.rule_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-gray-200 font-bold">{rule.trigger_count}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-mono uppercase border rounded ${
                              SEVERITY_COLORS[rule.severity] ?? 'text-slate-600 dark:text-gray-400 bg-gray-500/20 border-gray-500/30'
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-gray-300">{rule.actors_affected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scenario History Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Scenario History</h2>
            {scenarioHistory.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-8 text-center">
                <p className="text-slate-500 dark:text-gray-500 font-mono text-sm">No scenario history available</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Scenario ID</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Correlation ID</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Events</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Alerts</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Responses</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Incident ID</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Executed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioHistory.map((entry) => (
                      <tr key={entry.correlation_id} className="border-b border-slate-200 dark:border-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-gray-200 text-xs">{entry.scenario_id}</td>
                        <td className="px-4 py-3 font-mono text-cyan-700 dark:text-cyan-400 text-xs break-all">{entry.correlation_id}</td>
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-gray-300">{entry.events_total}</td>
                        <td className="px-4 py-3 font-mono text-amber-700 dark:text-amber-400">{entry.alerts_total}</td>
                        <td className="px-4 py-3 font-mono text-orange-700 dark:text-orange-400">{entry.responses_total}</td>
                        <td className="px-4 py-3">
                          {entry.incident_id ? (
                            <Link
                              href={`/incidents/${entry.correlation_id}`}
                              className="font-mono text-red-700 dark:text-red-400 hover:underline text-xs"
                            >
                              {entry.incident_id}
                            </Link>
                          ) : (
                            <span className="font-mono text-slate-400 dark:text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500">
                          {formatTimestamp(entry.executed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
