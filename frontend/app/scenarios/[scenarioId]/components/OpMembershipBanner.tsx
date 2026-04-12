import Link from 'next/link';
import type { TrainingOp, OpMission } from '@/lib/ops-content';

interface OpContext {
  op: TrainingOp;
  opProgress: { completedCount: number; totalCount: number };
  missionIndex: number;
  mission: OpMission | null;
  cleared: boolean;
}

interface OpMembershipBannerProps {
  opContexts: OpContext[];
}

export default function OpMembershipBanner({ opContexts }: OpMembershipBannerProps) {
  if (opContexts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2 ar-fade-in">
      {opContexts.map(({ op, opProgress, missionIndex, mission, cleared }) => (
        <Link
          key={op.id}
          href={`/ops/${op.id}`}
          className="group flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 dark:border-gray-800 bg-gradient-to-r from-white via-slate-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 px-4 py-3 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                Part of {op.codename}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 truncate">
                {op.name}
                {mission && (
                  <span className="ml-2 text-xs font-mono font-normal text-slate-500 dark:text-gray-500">
                    · {mission.title}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {cleared ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Cleared
              </span>
            ) : (
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
                Step {missionIndex + 1}/{op.missions.length}
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-500 dark:text-gray-500 hidden sm:inline">
              {opProgress.completedCount}/{opProgress.totalCount}
            </span>
            <span className="text-sm text-cyan-600 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
