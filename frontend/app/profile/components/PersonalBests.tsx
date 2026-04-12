import Link from 'next/link';
import { PersonalBest, personalBestKey } from '@/lib/player-progress';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import { formatDate } from './shared';

interface PersonalBestsProps {
  personalBests: Record<string, PersonalBest>;
  personalBestBeats: number;
}

export default function PersonalBests({ personalBests, personalBestBeats }: PersonalBestsProps) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Personal Bests</h2>
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Your highest XP run on each scenario and perspective. Beat a best to unlock the Personal Best achievement.
          </p>
        </div>
        <p className="text-xs font-mono text-slate-500 dark:text-gray-500">
          {Object.keys(personalBests).length} tracked · {personalBestBeats} beaten
        </p>
      </div>
      {Object.keys(personalBests).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/70 p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            No personal bests yet. Complete a mission to set your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIO_DEFINITIONS.flatMap((def) =>
            (['blue', 'red'] as const).map((perspective) => {
              const key = personalBestKey(def.id, perspective);
              const pb: PersonalBest | undefined = personalBests[key];
              if (!pb) return null;
              const perspectiveColor =
                perspective === 'red'
                  ? 'text-rose-600 dark:text-rose-300'
                  : 'text-sky-600 dark:text-sky-300';
              const perspectiveChip =
                perspective === 'red'
                  ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                  : 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';
              return (
                <Link
                  key={key}
                  href={`/scenarios/${def.id}`}
                  className="rounded-xl border-2 border-amber-300 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/5 dark:to-gray-950 p-4 shadow-sm dark:shadow-none hover:border-amber-500 dark:hover:border-amber-400 transition-all block"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
                        <path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" />
                      </svg>
                      Personal Best
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${perspectiveChip}`}>
                      {perspective === 'red' ? 'Red' : 'Blue'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 truncate">
                    {def.name}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className={`text-2xl font-bold font-[family-name:var(--font-geist-mono)] ${perspectiveColor}`}>
                      {pb.xpEarned}
                      <span className="text-xs font-normal text-slate-500 dark:text-gray-500"> XP</span>
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-gray-500 capitalize">
                      {pb.difficulty}
                    </p>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500 mt-1">
                    {pb.objectivesHit}/{pb.objectivesTotal} objectives · {formatDate(pb.recordedAt)}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
