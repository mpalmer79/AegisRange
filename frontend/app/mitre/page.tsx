'use client';

import { useEffect, useState } from 'react';
import { getMitreMappings, getMitreCoverageMatrix, getMitreTacticCoverage } from '@/lib/api';
import { TTPMapping, MitreCoverageEntry, TacticCoverage } from '@/lib/types';

const TACTIC_ORDER = [
  'TA0001', 'TA0003', 'TA0004', 'TA0005', 'TA0006', 'TA0008', 'TA0009', 'TA0010',
];

const TACTIC_NAMES: Record<string, string> = {
  TA0001: 'Initial Access',
  TA0003: 'Persistence',
  TA0004: 'Privilege Escalation',
  TA0005: 'Defense Evasion',
  TA0006: 'Credential Access',
  TA0008: 'Lateral Movement',
  TA0009: 'Collection',
  TA0010: 'Exfiltration',
};

function coverageColor(percentage: number): string {
  if (percentage >= 75) return 'text-green-700 dark:text-green-400';
  if (percentage >= 50) return 'text-amber-700 dark:text-amber-400';
  if (percentage >= 25) return 'text-orange-700 dark:text-orange-400';
  return 'text-red-700 dark:text-red-400';
}

function coverageBg(percentage: number): string {
  if (percentage >= 75) return 'bg-green-500';
  if (percentage >= 50) return 'bg-amber-500';
  if (percentage >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function MitrePage() {
  const [mappings, setMappings] = useState<TTPMapping[]>([]);
  const [coverage, setCoverage] = useState<MitreCoverageEntry[]>([]);
  const [tacticCoverage, setTacticCoverage] = useState<TacticCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [m, c, t] = await Promise.allSettled([
          getMitreMappings(),
          getMitreCoverageMatrix(),
          getMitreTacticCoverage(),
        ]);
        if (m.status === 'fulfilled') setMappings(m.value);
        if (c.status === 'fulfilled') setCoverage(c.value);
        if (t.status === 'fulfilled') setTacticCoverage(t.value);
        if (m.status === 'rejected' && c.status === 'rejected' && t.status === 'rejected') {
          setError('Failed to fetch MITRE ATT&CK data. Is the backend running?');
        }
      } catch {
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const sortedTactics = [...tacticCoverage].sort(
    (a, b) => TACTIC_ORDER.indexOf(a.tactic_id) - TACTIC_ORDER.indexOf(b.tactic_id)
  );

  const overallCovered = coverage.filter((c) => c.covered).length;
  const overallTotal = coverage.length;
  const overallPct = overallTotal > 0 ? Math.round((overallCovered / overallTotal) * 100) : 0;

  // Group coverage entries by tactic
  const coverageByTactic: Record<string, MitreCoverageEntry[]> = {};
  for (const entry of coverage) {
    if (!coverageByTactic[entry.tactic_id]) coverageByTactic[entry.tactic_id] = [];
    coverageByTactic[entry.tactic_id].push(entry);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">MITRE ATT&CK Matrix</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
            Detection rule mapping to MITRE ATT&CK tactics and techniques
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold font-mono ${coverageColor(overallPct)}`}>{overallPct}%</div>
          <div className="text-xs text-slate-500 dark:text-gray-500">Overall Coverage</div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-700 dark:text-cyan-400 font-mono text-sm animate-pulse">Loading ATT&CK data...</div>
        </div>
      )}

      {!loading && (
        <>
          {/* Tactic Coverage Overview */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Tactic Coverage</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sortedTactics.map((t) => (
                <div key={t.tactic_id} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-slate-500 dark:text-gray-500">{t.tactic_id}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-3">{t.tactic_name}</div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xl font-bold font-mono ${coverageColor(t.percentage)}`}>
                      {Math.round(t.percentage)}%
                    </span>
                    <span className="text-xs text-slate-500 dark:text-gray-500">
                      {t.covered_techniques}/{t.total_techniques}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${coverageBg(t.percentage)} transition-all`}
                      style={{ width: `${t.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ATT&CK Heatmap Grid */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Coverage Matrix</h2>
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {TACTIC_ORDER.map((tacticId) => {
                const entries = coverageByTactic[tacticId] || [];
                const tacticName = TACTIC_NAMES[tacticId] || tacticId;
                return (
                  <div key={tacticId} className="border-b border-slate-200 dark:border-gray-800 last:border-b-0">
                    <div className="px-4 py-3 bg-slate-100 dark:bg-gray-950/50">
                      <span className="text-xs font-mono text-slate-500 dark:text-gray-500 mr-2">{tacticId}</span>
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{tacticName}</span>
                    </div>
                    <div className="px-4 py-3 flex flex-wrap gap-2">
                      {entries.length === 0 ? (
                        <span className="text-xs text-slate-400 dark:text-gray-600 font-mono">No techniques mapped</span>
                      ) : (
                        entries.map((entry) => (
                          <div
                            key={`${entry.tactic_id}-${entry.technique_id}`}
                            className={`px-3 py-2 rounded border text-xs font-mono ${
                              entry.covered
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-400'
                                : 'bg-slate-200 dark:bg-gray-800/50 border-slate-300 dark:border-gray-700/50 text-slate-500 dark:text-gray-500'
                            }`}
                          >
                            <div className="font-bold">{entry.technique_id}</div>
                            <div className="text-[10px] mt-0.5 opacity-80">{entry.technique_name}</div>
                            {entry.covered && entry.rule_ids.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {entry.rule_ids.map((r) => (
                                  <span key={r} className="px-1 py-0.5 bg-cyan-500/20 rounded text-[9px]">{r}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rule-to-TTP Mapping Table */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Detection Rule Mappings</h2>
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Rule ID</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">ATT&CK Techniques</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Tactics</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Kill Chain Phase</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.rule_id} className="border-b border-slate-200 dark:border-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-mono text-cyan-700 dark:text-cyan-400 text-xs">{m.rule_id}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.technique_ids.map((t) => (
                            <span key={t} className="px-2 py-0.5 text-xs font-mono bg-purple-500/20 border border-purple-500/30 rounded text-purple-700 dark:text-purple-400">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.tactic_ids.map((t) => (
                            <span key={t} className="px-2 py-0.5 text-xs font-mono bg-blue-500/20 border border-blue-500/30 rounded text-blue-700 dark:text-blue-400">
                              {TACTIC_NAMES[t] || t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.kill_chain_phases.map((p) => (
                            <span key={p} className="px-2 py-0.5 text-xs font-mono bg-amber-500/20 border border-amber-500/30 rounded text-amber-700 dark:text-amber-400">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
