import Link from 'next/link';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import { formatDate } from './shared';

export interface ScenarioEntry {
  red: boolean;
  blue: boolean;
  lastPlayed?: string;
}

interface ScenarioCoverageProps {
  perScenario: Record<string, ScenarioEntry>;
}

export default function ScenarioCoverage({ perScenario }: ScenarioCoverageProps) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Scenario Coverage</h2>
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Play every scenario from both sides to complete the library.
          </p>
        </div>
        <Link
          href="/scenarios"
          className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
        >
          VIEW ALL &rarr;
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-gray-800">
              <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Scenario</th>
              <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Red</th>
              <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Blue</th>
              <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Last Played</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {SCENARIO_DEFINITIONS.map((def) => {
              const entry = perScenario[def.id];
              return (
                <tr key={def.id} className="border-b border-slate-200 dark:border-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{def.name}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500">{def.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-mono ${entry?.red ? 'text-rose-600 dark:text-rose-300' : 'text-slate-400 dark:text-gray-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${entry?.red ? 'bg-rose-500' : 'bg-slate-300 dark:bg-gray-700'}`} />
                      {entry?.red ? 'Cleared' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-mono ${entry?.blue ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400 dark:text-gray-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${entry?.blue ? 'bg-sky-500' : 'bg-slate-300 dark:bg-gray-700'}`} />
                      {entry?.blue ? 'Cleared' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500">
                    {entry?.lastPlayed ? formatDate(entry.lastPlayed) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/scenarios/${def.id}`}
                      className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
                    >
                      Briefing &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
