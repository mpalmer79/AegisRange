import { Rank } from '@/lib/player-progress';
import { ACCENT_GRADIENTS, ACCENT_TEXT, ACCENT_BAR } from './shared';

interface RankHeroCardProps {
  rank: Rank;
  nextRank: Rank | null;
  xpIntoRank: number;
  xpToNextRank: number | null;
  rankProgressPct: number;
  totalXp: number;
  hydrated: boolean;
}

export default function RankHeroCard({
  rank,
  nextRank,
  xpIntoRank,
  xpToNextRank,
  rankProgressPct,
  totalXp,
  hydrated,
}: RankHeroCardProps) {
  const accentGradient = ACCENT_GRADIENTS[rank.accent];
  const accentText = ACCENT_TEXT[rank.accent];
  const accentBar = ACCENT_BAR[rank.accent];

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-gray-800 bg-gradient-to-br ${accentGradient} p-6 sm:p-8 mb-8 shadow-lg dark:shadow-none ar-slide-up`}
    >
      <div aria-hidden className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/40 dark:bg-white/5 blur-3xl ar-drift-slow" />
      <div aria-hidden className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/30 dark:bg-white/5 blur-3xl ar-drift-reverse" />

      <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-slate-500 dark:text-gray-500 mb-1">
            Career Profile
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className={accentText}>{rank.name}</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 max-w-md">
            {rank.tagline}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
            Total XP
          </p>
          <p className={`text-4xl sm:text-5xl font-bold font-[family-name:var(--font-geist-mono)] ${accentText}`}>
            {hydrated ? totalXp : '—'}
          </p>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-gray-500 mb-1.5">
          <span>{rank.name} · {rank.minXp} XP</span>
          <span>
            {nextRank
              ? `${nextRank.name} · ${nextRank.minXp} XP`
              : 'Max rank reached'}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-white/50 dark:bg-gray-800 overflow-hidden border border-slate-200 dark:border-gray-800">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${accentBar} ar-bar-grow transition-all`}
            style={{ width: `${rankProgressPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-gray-500">
          {nextRank && xpToNextRank != null
            ? `${xpIntoRank} XP into ${rank.name} · ${xpToNextRank} XP to ${nextRank.name}`
            : `${totalXp} XP lifetime`}
        </p>
      </div>
    </section>
  );
}
