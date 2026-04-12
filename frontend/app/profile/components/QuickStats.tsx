import { MissionRecord, StreakState, ACHIEVEMENTS } from '@/lib/player-progress';

interface QuickStatsProps {
  missionsCompleted: number;
  flawlessCount: number;
  earnedAchievementsCount: number;
  bestRun: MissionRecord | null;
  streak: StreakState;
  dailyCompletionsCount: number;
}

export default function QuickStats({
  missionsCompleted,
  flawlessCount,
  earnedAchievementsCount,
  bestRun,
  streak,
  dailyCompletionsCount,
}: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 ar-stagger">
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Missions</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-gray-100 mt-1">{missionsCompleted}</p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Flawless</p>
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-1">{flawlessCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Achievements</p>
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1">
          {earnedAchievementsCount}
          <span className="text-sm font-normal text-slate-500 dark:text-gray-500"> / {ACHIEVEMENTS.length}</span>
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Best Run</p>
        <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mt-1">
          {bestRun ? `${bestRun.xpEarned} XP` : '—'}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Streak</p>
        <p className="text-2xl font-bold text-orange-600 dark:text-orange-300 mt-1 flex items-baseline gap-1">
          {streak.current}
          <span className="text-[11px] font-normal text-slate-500 dark:text-gray-500">
            {streak.best > streak.current ? `best ${streak.best}` : streak.current === 1 ? 'day' : 'days'}
          </span>
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Dailies</p>
        <p className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-300 mt-1">
          {dailyCompletionsCount}
        </p>
      </div>
    </div>
  );
}
