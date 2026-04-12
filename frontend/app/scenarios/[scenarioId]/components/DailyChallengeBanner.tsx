interface DailyChallengeBannerProps {
  dailyReady: boolean;
  isDailyMatch: boolean;
  dailyBonus: number;
}

export default function DailyChallengeBanner({
  dailyReady,
  isDailyMatch,
  dailyBonus,
}: DailyChallengeBannerProps) {
  if (!dailyReady || !isDailyMatch) return null;

  return (
    <div className="mb-4 rounded-xl border-2 border-fuchsia-300 dark:border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-50 via-violet-50 to-purple-50 dark:from-fuchsia-500/10 dark:via-violet-500/10 dark:to-purple-500/10 px-4 py-3 ar-fade-in flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-purple-600 flex items-center justify-center text-white shadow">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="M9 15l2 2 4-4" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fuchsia-700 dark:text-fuchsia-300">
            Today&apos;s Daily Challenge
          </p>
          <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 truncate">
            Bonus XP active · {dailyBonus}&times; multiplier
          </p>
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
        </svg>
        {dailyBonus}&times; XP
      </span>
    </div>
  );
}
