import Link from 'next/link';
import { MissionRecord } from '@/lib/player-progress';
import { formatDate, formatDuration } from './shared';

function PerspectiveChip({ perspective }: { perspective: 'red' | 'blue' }) {
  const cls = perspective === 'red'
    ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
    : 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {perspective === 'red' ? 'Red Team' : 'Blue Team'}
    </span>
  );
}

function DifficultyChip({ difficulty }: { difficulty: MissionRecord['difficulty'] }) {
  const cls =
    difficulty === 'operator'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
      : difficulty === 'analyst'
      ? 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30'
      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {difficulty}
    </span>
  );
}

interface MissionHistoryProps {
  missions: MissionRecord[];
}

export default function MissionHistory({ missions }: MissionHistoryProps) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Mission History</h2>
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Your last {missions.length > 0 ? missions.length : 50} mission runs.
          </p>
        </div>
      </div>
      {missions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/70 p-8 text-center">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            No missions recorded yet. Launch a scenario from the{' '}
            <Link href="/scenarios" className="text-cyan-700 dark:text-cyan-300 hover:underline">briefing room</Link>{' '}
            to start earning XP.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none divide-y divide-slate-200 dark:divide-gray-800">
          {missions.map((m) => (
            <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/scenarios/${m.scenarioId}`}
                    className="text-sm font-semibold text-slate-800 dark:text-gray-100 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors truncate"
                  >
                    {m.scenarioName}
                  </Link>
                  <PerspectiveChip perspective={m.perspective} />
                  <DifficultyChip difficulty={m.difficulty} />
                  {m.flawless && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" /></svg>
                      Flawless
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500 mt-1">
                  {formatDate(m.completedAt)} · {formatDuration(m.durationSeconds)} ·{' '}
                  {m.objectivesHit}/{m.objectivesTotal} objectives
                  {m.correlationId && <> · {m.correlationId}</>}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">XP</p>
                  <p className="text-base font-mono font-bold text-cyan-600 dark:text-cyan-300">
                    +{m.xpEarned}
                    <span className="text-xs font-normal text-slate-500 dark:text-gray-500"> / {m.xpMax}</span>
                  </p>
                </div>
                {m.incidentId && (
                  <Link
                    href={`/incidents/${m.correlationId}`}
                    className="text-xs font-mono text-rose-600 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 transition-colors"
                  >
                    Incident &rarr;
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
