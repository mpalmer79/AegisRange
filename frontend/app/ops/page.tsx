'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  TRAINING_OPS,
  computeOpProgress,
  OpAccent,
} from '@/lib/ops-content';
import { usePlayerProgress } from '@/lib/player-progress';

/**
 * /ops — Training Ops library (Phase 4).
 *
 * Shows the three curated ops with narrative taglines and per-op
 * progress (completedCount / totalCount) derived from the player's
 * mission history. Clicking a card navigates to the op detail page
 * where the mission chain lives.
 */

// Enumerated Tailwind classes per accent so the JIT compiler can see
// them (dynamic template strings are not picked up by Tailwind).
const ACCENT_CLASSES: Record<
  OpAccent,
  {
    ring: string;
    gradient: string;
    chipBg: string;
    chipText: string;
    titleGradient: string;
    badgeBg: string;
    barFill: string;
    glow: string;
  }
> = {
  rose: {
    ring: 'border-rose-300 dark:border-rose-500/30 hover:border-rose-500 dark:hover:border-rose-400',
    gradient:
      'from-rose-100/70 via-white to-white dark:from-rose-500/10 dark:via-gray-950 dark:to-gray-950',
    chipBg: 'bg-rose-100 dark:bg-rose-500/15',
    chipText: 'text-rose-700 dark:text-rose-300',
    titleGradient: 'from-rose-500 via-red-500 to-orange-500',
    badgeBg: 'from-rose-500 to-red-600',
    barFill: 'from-rose-400 to-red-500',
    glow: 'hover:shadow-rose-400/30 dark:hover:shadow-rose-500/20',
  },
  amber: {
    ring: 'border-amber-300 dark:border-amber-500/30 hover:border-amber-500 dark:hover:border-amber-400',
    gradient:
      'from-amber-100/70 via-white to-white dark:from-amber-500/10 dark:via-gray-950 dark:to-gray-950',
    chipBg: 'bg-amber-100 dark:bg-amber-500/15',
    chipText: 'text-amber-700 dark:text-amber-300',
    titleGradient: 'from-amber-500 via-orange-500 to-red-500',
    badgeBg: 'from-amber-500 to-orange-600',
    barFill: 'from-amber-400 to-orange-500',
    glow: 'hover:shadow-amber-400/30 dark:hover:shadow-amber-500/20',
  },
  emerald: {
    ring: 'border-emerald-300 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400',
    gradient:
      'from-emerald-100/70 via-white to-white dark:from-emerald-500/10 dark:via-gray-950 dark:to-gray-950',
    chipBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    chipText: 'text-emerald-700 dark:text-emerald-300',
    titleGradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    badgeBg: 'from-emerald-500 to-teal-600',
    barFill: 'from-emerald-400 to-teal-500',
    glow: 'hover:shadow-emerald-400/30 dark:hover:shadow-emerald-500/20',
  },
  violet: {
    ring: 'border-violet-300 dark:border-violet-500/30 hover:border-violet-500 dark:hover:border-violet-400',
    gradient:
      'from-violet-100/70 via-white to-white dark:from-violet-500/10 dark:via-gray-950 dark:to-gray-950',
    chipBg: 'bg-violet-100 dark:bg-violet-500/15',
    chipText: 'text-violet-700 dark:text-violet-300',
    titleGradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    badgeBg: 'from-violet-500 to-purple-600',
    barFill: 'from-violet-400 to-purple-500',
    glow: 'hover:shadow-violet-400/30 dark:hover:shadow-violet-500/20',
  },
  sky: {
    ring: 'border-sky-300 dark:border-sky-500/30 hover:border-sky-500 dark:hover:border-sky-400',
    gradient:
      'from-sky-100/70 via-white to-white dark:from-sky-500/10 dark:via-gray-950 dark:to-gray-950',
    chipBg: 'bg-sky-100 dark:bg-sky-500/15',
    chipText: 'text-sky-700 dark:text-sky-300',
    titleGradient: 'from-sky-500 via-blue-500 to-indigo-500',
    badgeBg: 'from-sky-500 to-blue-600',
    barFill: 'from-sky-400 to-blue-500',
    glow: 'hover:shadow-sky-400/30 dark:hover:shadow-sky-500/20',
  },
  fuchsia: {
    ring: 'border-fuchsia-300 dark:border-fuchsia-500/30 hover:border-fuchsia-500 dark:hover:border-fuchsia-400',
    gradient:
      'from-fuchsia-100/70 via-white to-white dark:from-fuchsia-500/10 dark:via-gray-950 dark:to-gray-950',
    chipBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15',
    chipText: 'text-fuchsia-700 dark:text-fuchsia-300',
    titleGradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
    badgeBg: 'from-fuchsia-500 via-pink-500 to-rose-600',
    barFill: 'from-fuchsia-400 to-pink-500',
    glow: 'hover:shadow-fuchsia-400/30 dark:hover:shadow-fuchsia-500/20',
  },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  recruit: 'Recruit',
  analyst: 'Analyst',
  operator: 'Operator',
};

export default function OpsPage() {
  const { progress, hydrated } = usePlayerProgress();
  const opsWithProgress = useMemo(
    () => TRAINING_OPS.map((op) => computeOpProgress(op, progress.missions)),
    [progress.missions]
  );
  const totalOps = opsWithProgress.length;
  const completedOps = opsWithProgress.filter((o) => o.isComplete).length;

  return (
    <div className="text-slate-800 dark:text-gray-100">
      {/* Header */}
      <div className="mb-8 ar-fade-in">
        <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-cyan-700 dark:text-cyan-300 mb-1">
          Phase 4
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          <span className="ar-gradient-text">Training Ops</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 max-w-2xl">
          Curated sequences of scenarios with a narrative arc. Each Op chains
          multiple missions into a single story. Play from the recommended
          perspective to progress the chain.
        </p>
      </div>

      {/* Summary strip */}
      <div className="mb-8 rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-gradient-to-br from-white via-sky-50 to-indigo-50 dark:from-gray-900 dark:via-indigo-950/30 dark:to-gray-900 p-5 shadow-sm dark:shadow-none ar-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
              Operations Complete
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-gray-100">
              {hydrated ? completedOps : '—'}
              <span className="text-base font-normal text-slate-500 dark:text-gray-500"> / {totalOps}</span>
            </p>
          </div>
          <div className="text-sm text-slate-600 dark:text-gray-400 max-w-md">
            Finish all three ops to earn every campaign achievement and prove
            you can switch between offense and defense.
          </div>
        </div>
      </div>

      {/* Op grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 ar-stagger">
        {opsWithProgress.map(({ op, completedCount, totalCount, percentage, isComplete, currentIndex }) => {
          const accent = ACCENT_CLASSES[op.accent];
          const currentMission = op.missions[currentIndex] ?? op.missions[op.missions.length - 1];
          return (
            <Link
              key={op.id}
              href={`/ops/${op.id}`}
              aria-label={`Open ${op.name} briefing`}
              className={`group block p-5 rounded-2xl border-2 bg-gradient-to-br ${accent.gradient} ${accent.ring} shadow-sm hover:shadow-lg dark:shadow-none ${accent.glow} ar-card-hover`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent.badgeBg} flex items-center justify-center shadow-md`}>
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4" />
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center text-[10px] font-mono tracking-wider px-2 py-1 rounded-full ${accent.chipBg} ${accent.chipText}`}>
                    {op.codename}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
                    {DIFFICULTY_LABEL[op.difficulty] ?? op.difficulty}
                  </span>
                </div>
              </div>

              <p className={`text-xl font-bold bg-gradient-to-r ${accent.titleGradient} bg-clip-text text-transparent mb-1`}>
                {op.name}
              </p>
              <p className="text-xs text-slate-600 dark:text-gray-400 italic mb-3">
                {op.tagline}
              </p>

              <div className="mb-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-gray-500 mb-1">
                  <span>
                    {hydrated ? `${completedCount} / ${totalCount} missions` : `${totalCount} missions`}
                  </span>
                  <span>{hydrated ? `${percentage}%` : ''}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${accent.barFill} transition-all`}
                    style={{ width: `${hydrated ? percentage : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-gray-800/80">
                {isComplete ? (
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Complete
                  </span>
                ) : (
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 truncate pr-2">
                    Next · {currentMission?.title ?? 'Start'}
                  </span>
                )}
                <span className={`text-sm ar-arrow ${accent.chipText}`}>&rarr;</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
