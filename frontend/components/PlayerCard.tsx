'use client';

import Link from 'next/link';
import { usePlayerProgress, Rank } from '@/lib/player-progress';

/**
 * PlayerCard — compact career badge shown on the home dashboard.
 *
 * Renders the current rank, a total XP counter and a progress bar toward
 * the next rank. Clicking navigates to /profile (the full career page).
 *
 * Reads from the PlayerProgressProvider; renders a skeleton before the
 * context has hydrated from localStorage so first-paint matches SSR.
 */

// Tailwind class maps keyed by rank accent. Tailwind can't see dynamic
// `${accent}-500` strings, so we enumerate every rank explicitly.
const ACCENT_CLASSES: Record<Rank['accent'], {
  border: string;
  ring: string;
  chipBg: string;
  chipText: string;
  gradient: string;
  barFill: string;
  glow: string;
}> = {
  slate: {
    border: 'border-slate-300 dark:border-slate-600/50',
    ring: 'hover:border-slate-400 dark:hover:border-slate-500',
    chipBg: 'bg-slate-100 dark:bg-slate-500/10',
    chipText: 'text-slate-700 dark:text-slate-300',
    gradient: 'from-slate-50 via-white to-slate-50 dark:from-slate-500/10 dark:via-gray-900 dark:to-gray-900',
    barFill: 'from-slate-400 to-slate-500',
    glow: 'hover:shadow-slate-400/20',
  },
  sky: {
    border: 'border-sky-300 dark:border-sky-500/40',
    ring: 'hover:border-sky-500 dark:hover:border-sky-400',
    chipBg: 'bg-sky-100 dark:bg-sky-500/15',
    chipText: 'text-sky-700 dark:text-sky-300',
    gradient: 'from-sky-50 via-white to-sky-50 dark:from-sky-500/10 dark:via-gray-900 dark:to-gray-900',
    barFill: 'from-sky-400 to-blue-500',
    glow: 'hover:shadow-sky-400/30',
  },
  cyan: {
    border: 'border-cyan-300 dark:border-cyan-500/40',
    ring: 'hover:border-cyan-500 dark:hover:border-cyan-400',
    chipBg: 'bg-cyan-100 dark:bg-cyan-500/15',
    chipText: 'text-cyan-700 dark:text-cyan-300',
    gradient: 'from-cyan-50 via-white to-sky-50 dark:from-cyan-500/10 dark:via-gray-900 dark:to-gray-900',
    barFill: 'from-cyan-400 to-sky-500',
    glow: 'hover:shadow-cyan-400/30',
  },
  emerald: {
    border: 'border-emerald-300 dark:border-emerald-500/40',
    ring: 'hover:border-emerald-500 dark:hover:border-emerald-400',
    chipBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    chipText: 'text-emerald-700 dark:text-emerald-300',
    gradient: 'from-emerald-50 via-white to-teal-50 dark:from-emerald-500/10 dark:via-gray-900 dark:to-gray-900',
    barFill: 'from-emerald-400 to-teal-500',
    glow: 'hover:shadow-emerald-400/30',
  },
  violet: {
    border: 'border-violet-300 dark:border-violet-500/40',
    ring: 'hover:border-violet-500 dark:hover:border-violet-400',
    chipBg: 'bg-violet-100 dark:bg-violet-500/15',
    chipText: 'text-violet-700 dark:text-violet-300',
    gradient: 'from-violet-50 via-white to-purple-50 dark:from-violet-500/10 dark:via-gray-900 dark:to-gray-900',
    barFill: 'from-violet-400 to-purple-500',
    glow: 'hover:shadow-violet-400/30',
  },
  amber: {
    border: 'border-amber-300 dark:border-amber-500/40',
    ring: 'hover:border-amber-500 dark:hover:border-amber-400',
    chipBg: 'bg-amber-100 dark:bg-amber-500/15',
    chipText: 'text-amber-700 dark:text-amber-300',
    gradient: 'from-amber-50 via-white to-orange-50 dark:from-amber-500/10 dark:via-gray-900 dark:to-gray-900',
    barFill: 'from-amber-400 to-orange-500',
    glow: 'hover:shadow-amber-400/30',
  },
};

export default function PlayerCard() {
  const {
    progress,
    hydrated,
    rank,
    nextRank,
    xpToNextRank,
    rankProgressPct,
  } = usePlayerProgress();

  const accent = ACCENT_CLASSES[rank.accent];

  // Skeleton matches the final card size so the layout doesn't jump after
  // localStorage hydration completes.
  if (!hydrated) {
    return (
      <div
        aria-hidden
        className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 p-4 w-full sm:w-72 min-h-[112px] animate-pulse"
      />
    );
  }

  return (
    <Link
      href="/profile"
      aria-label={`Open career profile — ${rank.name}, ${progress.totalXp} XP`}
      className={`group block rounded-2xl border-2 ${accent.border} ${accent.ring} bg-gradient-to-br ${accent.gradient} p-4 w-full sm:w-72 shadow-sm dark:shadow-none ${accent.glow} hover:shadow-lg transition-all ar-card-hover`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-slate-500 dark:text-gray-500">
            Career
          </p>
          <p className="text-lg font-bold text-slate-800 dark:text-gray-100 leading-tight">
            {rank.name}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider ${accent.chipBg} ${accent.chipText}`}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
          </svg>
          {progress.totalXp} XP
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accent.barFill} ar-bar-grow transition-all`}
          style={{ width: `${rankProgressPct}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-gray-500 flex items-center justify-between">
        <span className="truncate pr-2">{rank.tagline}</span>
        <span className="shrink-0 text-slate-600 dark:text-gray-400">
          {nextRank && xpToNextRank != null
            ? `${xpToNextRank} → ${nextRank.name}`
            : 'Max rank'}
        </span>
      </p>
    </Link>
  );
}
