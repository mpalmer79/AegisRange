import Link from 'next/link';
import { OpProgress } from '@/lib/ops-content';

interface TrainingOpsProgressProps {
  opProgressList: OpProgress[];
}

export default function TrainingOpsProgress({ opProgressList }: TrainingOpsProgressProps) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Training Ops</h2>
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Curated sequences of scenarios. Clear an op to unlock its achievement.
          </p>
        </div>
        <Link
          href="/ops"
          className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
        >
          ALL OPS &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {opProgressList.map(({ op, completedCount, totalCount, percentage, isComplete, currentIndex }) => {
          const currentMission = op.missions[currentIndex] ?? op.missions[op.missions.length - 1];
          return (
            <Link
              key={op.id}
              href={`/ops/${op.id}`}
              className={`rounded-xl border-2 p-4 bg-white dark:bg-gray-900 transition-colors block ${
                isComplete
                  ? 'border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500 dark:hover:border-emerald-400'
                  : 'border-slate-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-500/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-slate-500 dark:text-gray-500">
                  {op.codename}
                </p>
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Cleared
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-gray-500">
                    {completedCount} / {totalCount}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{op.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-gray-500 italic mt-0.5 line-clamp-2">
                {op.tagline}
              </p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-cyan-400 to-sky-500'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-gray-500 truncate">
                {isComplete ? 'Achievement unlocked' : `Next · ${currentMission?.title ?? 'Start'}`}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
