import type { PersonalBest } from '@/lib/player-progress';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface MissionHUDProps {
  earnedXp: number;
  maxXp: number;
  xpPct: number;
  elapsedSec: number;
  completedCount: number;
  totalObjectives: number;
  difficultyLabel: string;
  timeBudgetSeconds: number;
  isRunning: boolean;
  personalBest: PersonalBest | null;
}

export default function MissionHUD({
  earnedXp,
  maxXp,
  xpPct,
  elapsedSec,
  completedCount,
  totalObjectives,
  difficultyLabel,
  timeBudgetSeconds,
  isRunning,
  personalBest,
}: MissionHUDProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 shadow-sm dark:shadow-none ar-fade-in">
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-3">
        Mission HUD
      </p>

      {/* XP meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-mono text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
            XP
            {personalBest && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-wider bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                title={`Personal best: ${personalBest.xpEarned} XP at ${personalBest.difficulty}`}
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
                </svg>
                PB {personalBest.xpEarned}
              </span>
            )}
          </span>
          <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">
            {earnedXp} / {maxXp}
          </span>
        </div>
        <div className="h-2 w-full bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 transition-all duration-700"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/80 dark:bg-gray-900/60">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">
            Timer
          </p>
          <p className={`text-xl font-mono font-bold ${isRunning ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-gray-100'}`}>
            {formatElapsed(elapsedSec)}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/80 dark:bg-gray-900/60">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">
            Objectives
          </p>
          <p className="text-xl font-mono font-bold text-slate-800 dark:text-gray-100">
            {completedCount}/{totalObjectives}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] font-mono text-slate-400 dark:text-gray-600">
        Budget: {formatElapsed(timeBudgetSeconds)} &middot; {difficultyLabel}
      </p>
    </div>
  );
}
