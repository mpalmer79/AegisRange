'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getDailyChallenge, DailyChallenge } from '@/lib/daily-challenge';
import { usePlayerProgress } from '@/lib/player-progress';

/**
 * DailyChallengeCard — Phase 5
 *
 * Home dashboard card showing today's rotating Daily Challenge. The
 * same (scenario, perspective, difficulty) triple is shown to every
 * player on a given UTC day. Deep-links into the Phase 2 briefing.
 *
 * The client-only `today` state prevents SSR/CSR hydration mismatch:
 * the initial render uses a placeholder dateKey and the real daily
 * is computed in a useEffect after mount.
 */

const PERSPECTIVE_STYLE = {
  red: {
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    gradient: 'from-rose-500 via-red-500 to-orange-500',
  },
  blue: {
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
  },
} as const;

const DIFFICULTY_LABEL: Record<string, string> = {
  recruit: 'Recruit',
  analyst: 'Analyst',
  operator: 'Operator',
};

export default function DailyChallengeCard() {
  // `daily` is derived from Date() which differs between SSR and CSR
  // renders. Compute it lazily inside useEffect so first paint uses
  // the skeleton branch and no hydration mismatch occurs.
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  useEffect(() => {
    setDaily(getDailyChallenge());
  }, []);

  const { progress, hydrated } = usePlayerProgress();

  const completedToday = useMemo(() => {
    if (!daily) return false;
    return progress.dailyCompletions.includes(daily.dateKey);
  }, [daily, progress.dailyCompletions]);

  if (!daily) {
    return (
      <div
        aria-hidden
        className="w-full sm:w-[20rem] min-h-[128px] rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 animate-pulse"
      />
    );
  }

  const perspectiveStyle = PERSPECTIVE_STYLE[daily.perspective];
  const difficultyLabel = DIFFICULTY_LABEL[daily.difficulty] ?? daily.difficulty;

  return (
    <Link
      href={`/scenarios/${daily.scenarioId}`}
      aria-label={`Open today's daily challenge: ${daily.scenarioName}`}
      className="group block w-full sm:w-[20rem] rounded-2xl border-2 border-fuchsia-300 dark:border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-50 via-violet-50 to-purple-50 dark:from-fuchsia-500/10 dark:via-violet-500/10 dark:to-purple-500/10 p-4 shadow-sm dark:shadow-none hover:shadow-lg hover:shadow-fuchsia-400/20 dark:hover:shadow-fuchsia-500/10 hover:border-fuchsia-500 dark:hover:border-fuchsia-400 transition-all ar-card-hover relative overflow-hidden"
    >
      <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-fuchsia-200/50 dark:bg-fuchsia-500/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-fuchsia-700 dark:text-fuchsia-300 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M9 15l2 2 4-4" />
            </svg>
            Daily Challenge
          </p>
          {hydrated && completedToday && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
              Cleared
            </span>
          )}
        </div>

        <p className={`text-lg font-bold bg-gradient-to-r ${perspectiveStyle.gradient} bg-clip-text text-transparent leading-tight`}>
          {daily.scenarioName}
        </p>
        <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500 italic mt-0.5 line-clamp-2">
          {daily.tagline}
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${perspectiveStyle.chip}`}>
            {daily.perspective === 'red' ? 'Red Team' : 'Blue Team'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30">
            {difficultyLabel}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
            </svg>
            {daily.bonusMultiplier}&times; XP
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-fuchsia-200/60 dark:border-fuchsia-500/20 flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
            {hydrated && completedToday ? 'View briefing' : 'Start mission'}
          </span>
          <span className="text-sm text-fuchsia-600 dark:text-fuchsia-400 ar-arrow">&rarr;</span>
        </div>
      </div>
    </Link>
  );
}
