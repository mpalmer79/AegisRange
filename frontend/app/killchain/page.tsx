'use client';

import { useEffect, useState } from 'react';
import { getAllKillChainAnalyses } from '@/lib/api';
import { KillChainAnalysis } from '@/lib/types';
import Link from 'next/link';

const STAGE_COLORS: Record<string, string> = {
  reconnaissance: 'bg-blue-500',
  weaponization: 'bg-indigo-500',
  delivery: 'bg-violet-500',
  exploitation: 'bg-purple-500',
  installation: 'bg-fuchsia-500',
  command_and_control: 'bg-rose-500',
  actions_on_objectives: 'bg-red-500',
};

const STAGE_LABELS: Record<string, string> = {
  reconnaissance: 'Recon',
  weaponization: 'Weaponize',
  delivery: 'Deliver',
  exploitation: 'Exploit',
  installation: 'Install',
  command_and_control: 'C2',
  actions_on_objectives: 'Actions',
};

function progressionColor(pct: number): string {
  if (pct >= 80) return 'text-red-400';
  if (pct >= 60) return 'text-orange-400';
  if (pct >= 40) return 'text-amber-400';
  if (pct >= 20) return 'text-yellow-400';
  return 'text-green-400';
}

export default function KillChainPage() {
  const [analyses, setAnalyses] = useState<KillChainAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getAllKillChainAnalyses();
        setAnalyses(data);
      } catch {
        setError('Failed to fetch kill chain data. Is the backend running?');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const sortedAnalyses = [...analyses].sort((a, b) => b.progression_percentage - a.progression_percentage);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Cyber Kill Chain</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lockheed Martin kill chain analysis per incident
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-400 font-mono text-sm animate-pulse">Loading kill chain data...</div>
        </div>
      )}

      {!loading && analyses.length === 0 && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-500 font-mono text-sm">No kill chain data available. Run scenarios to generate incidents.</p>
        </div>
      )}

      {!loading && sortedAnalyses.length > 0 && (
        <div className="space-y-6">
          {/* Kill Chain Stage Legend */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-1 overflow-x-auto">
              {Object.entries(STAGE_LABELS).map(([key, label], i) => (
                <div key={key} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`w-3 h-3 rounded-sm ${STAGE_COLORS[key]}`} />
                  <span className="text-xs font-mono text-gray-400">{label}</span>
                  {i < Object.keys(STAGE_LABELS).length - 1 && (
                    <svg className="w-3 h-3 text-gray-600 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Kill Chain Analysis Cards */}
          {sortedAnalyses.map((analysis) => (
            <div key={analysis.correlation_id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <Link
                    href={`/incidents/${analysis.correlation_id}`}
                    className="font-mono text-cyan-400 hover:underline text-sm"
                  >
                    {analysis.correlation_id.slice(0, 16)}...
                  </Link>
                  <span className="text-xs font-mono text-gray-500">Actor: {analysis.actor_id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold font-mono ${progressionColor(analysis.progression_percentage)}`}>
                    {Math.round(analysis.progression_percentage)}%
                  </span>
                  <span className="text-xs text-gray-500">progression</span>
                </div>
              </div>

              {/* Kill Chain Stages */}
              <div className="p-4">
                <div className="flex flex-wrap sm:flex-nowrap gap-1">
                  {analysis.stages.map((stage) => (
                    <div
                      key={stage.name}
                      className={`flex-1 p-3 rounded border transition-all ${
                        stage.detected
                          ? `${STAGE_COLORS[stage.name]}/20 border-gray-600`
                          : 'bg-gray-800/30 border-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className={`w-2 h-2 rounded-full ${stage.detected ? STAGE_COLORS[stage.name] : 'bg-gray-700'}`} />
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${stage.detected ? 'text-gray-200' : 'text-gray-600'}`}>
                          {stage.display_name}
                        </span>
                      </div>
                      {stage.detected && stage.detection_rule_ids.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {stage.detection_rule_ids.map((r) => (
                            <div key={r} className="text-[9px] font-mono text-gray-400">{r}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-gray-800/50 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-gray-500">
                  Highest stage: <span className="text-gray-300">{STAGE_LABELS[analysis.highest_stage] || analysis.highest_stage}</span>
                </span>
                <span className="text-xs font-mono text-gray-500">
                  {analysis.stages.filter((s) => s.detected).length} / {analysis.stages.length} stages detected
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
