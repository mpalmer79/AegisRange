'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  computeOpProgress,
  getOpById,
  OpAccent,
} from '@/lib/ops-content';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import { usePlayerProgress } from '@/lib/player-progress';

/**
 * /ops/[opId] — Training Op detail page.
 *
 * Shows the narrative hero, operation summary and an ordered mission
 * chain. Each mission link deep-links into the Phase 2 scenario
 * briefing. Cleared missions are marked with the XP and timestamp
 * pulled from the player's history.
 */

const ACCENT_CLASSES: Record<
  OpAccent,
  {
    ring: string;
    heroGradient: string;
    titleGradient: string;
    chipBg: string;
    chipText: string;
    badgeBg: string;
    barFill: string;
    softText: string;
  }
> = {
  rose: {
    ring: 'border-rose-300 dark:border-rose-500/30',
    heroGradient:
      'from-rose-100 via-rose-50 to-white dark:from-rose-500/15 dark:via-rose-500/5 dark:to-gray-950',
    titleGradient: 'from-rose-500 via-red-500 to-orange-500',
    chipBg: 'bg-rose-100 dark:bg-rose-500/15',
    chipText: 'text-rose-700 dark:text-rose-300',
    badgeBg: 'from-rose-500 to-red-600',
    barFill: 'from-rose-400 to-red-500',
    softText: 'text-rose-700 dark:text-rose-300',
  },
  amber: {
    ring: 'border-amber-300 dark:border-amber-500/30',
    heroGradient:
      'from-amber-100 via-amber-50 to-white dark:from-amber-500/15 dark:via-amber-500/5 dark:to-gray-950',
    titleGradient: 'from-amber-500 via-orange-500 to-red-500',
    chipBg: 'bg-amber-100 dark:bg-amber-500/15',
    chipText: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'from-amber-500 to-orange-600',
    barFill: 'from-amber-400 to-orange-500',
    softText: 'text-amber-700 dark:text-amber-300',
  },
  emerald: {
    ring: 'border-emerald-300 dark:border-emerald-500/30',
    heroGradient:
      'from-emerald-100 via-emerald-50 to-white dark:from-emerald-500/15 dark:via-emerald-500/5 dark:to-gray-950',
    titleGradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    chipBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    chipText: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'from-emerald-500 to-teal-600',
    barFill: 'from-emerald-400 to-teal-500',
    softText: 'text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    ring: 'border-violet-300 dark:border-violet-500/30',
    heroGradient:
      'from-violet-100 via-violet-50 to-white dark:from-violet-500/15 dark:via-violet-500/5 dark:to-gray-950',
    titleGradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    chipBg: 'bg-violet-100 dark:bg-violet-500/15',
    chipText: 'text-violet-700 dark:text-violet-300',
    badgeBg: 'from-violet-500 to-purple-600',
    barFill: 'from-violet-400 to-purple-500',
    softText: 'text-violet-700 dark:text-violet-300',
  },
  sky: {
    ring: 'border-sky-300 dark:border-sky-500/30',
    heroGradient:
      'from-sky-100 via-sky-50 to-white dark:from-sky-500/15 dark:via-sky-500/5 dark:to-gray-950',
    titleGradient: 'from-sky-500 via-blue-500 to-indigo-500',
    chipBg: 'bg-sky-100 dark:bg-sky-500/15',
    chipText: 'text-sky-700 dark:text-sky-300',
    badgeBg: 'from-sky-500 to-blue-600',
    barFill: 'from-sky-400 to-blue-500',
    softText: 'text-sky-700 dark:text-sky-300',
  },
  fuchsia: {
    ring: 'border-fuchsia-300 dark:border-fuchsia-500/30',
    heroGradient:
      'from-fuchsia-100 via-fuchsia-50 to-white dark:from-fuchsia-500/15 dark:via-fuchsia-500/5 dark:to-gray-950',
    titleGradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
    chipBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15',
    chipText: 'text-fuchsia-700 dark:text-fuchsia-300',
    badgeBg: 'from-fuchsia-500 via-pink-500 to-rose-600',
    barFill: 'from-fuchsia-400 to-pink-500',
    softText: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  recruit: 'Recruit',
  analyst: 'Analyst',
  operator: 'Operator',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function OpDetailPage() {
  const params = useParams<{ opId: string }>();
  const opId = params?.opId;
  const op = opId ? getOpById(opId) : undefined;
  const { progress, hydrated } = usePlayerProgress();

  if (!op) {
    notFound();
  }

  // Non-null assertions are safe after the notFound() guard.
  const accent = ACCENT_CLASSES[op!.accent];

  const opProgress = useMemo(
    () => computeOpProgress(op!, progress.missions),
    [op, progress.missions]
  );

  const scenariosById = useMemo(() => {
    const map: Record<string, { name: string; description: string }> = {};
    for (const s of SCENARIO_DEFINITIONS) {
      map[s.id] = { name: s.name, description: s.description };
    }
    return map;
  }, []);

  return (
    <div className="text-slate-800 dark:text-gray-100">
      {/* Top bar with HOME + breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap mb-6 ar-fade-in">
        <Link
          href="/"
          aria-label="Return to home dashboard"
          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-cyan-300 dark:border-cyan-500/40 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 text-cyan-700 dark:text-cyan-300 font-bold text-sm tracking-wide uppercase shadow-sm hover:shadow-lg hover:shadow-cyan-400/30 dark:hover:shadow-cyan-500/20 transition-all"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9" />
            <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
          </svg>
          Home
        </Link>
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 dark:text-gray-500 flex items-center gap-2">
          <Link href="/" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/ops" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Training Ops</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-gray-300">{op!.codename}</span>
        </nav>
      </div>

      {/* Hero card */}
      <section
        className={`relative overflow-hidden rounded-3xl border-2 ${accent.ring} bg-gradient-to-br ${accent.heroGradient} p-6 sm:p-8 mb-8 shadow-lg dark:shadow-none ar-slide-up`}
      >
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/40 dark:bg-white/5 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/30 dark:bg-white/5 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <p className={`text-[11px] font-mono tracking-[0.2em] uppercase ${accent.softText} mb-1`}>
                Training Op · {op!.codename}
              </p>
              <h1 className={`text-3xl sm:text-5xl font-bold bg-gradient-to-r ${accent.titleGradient} bg-clip-text text-transparent leading-tight`}>
                {op!.name}
              </h1>
              <p className="text-base text-slate-600 dark:text-gray-400 italic mt-1 max-w-2xl">
                {op!.tagline}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`inline-flex items-center text-[11px] font-mono tracking-wider px-3 py-1.5 rounded-full ${accent.chipBg} ${accent.chipText}`}>
                {DIFFICULTY_LABEL[op!.difficulty] ?? op!.difficulty}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
                {op!.missions.length} missions
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-700 dark:text-gray-300 max-w-3xl leading-relaxed mb-5">
            {op!.story}
          </p>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-gray-500 mb-1">
              <span>
                {hydrated
                  ? `${opProgress.completedCount} / ${opProgress.totalCount} missions cleared`
                  : `${op!.missions.length} missions queued`}
              </span>
              <span>{hydrated ? `${opProgress.percentage}%` : ''}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-white/60 dark:bg-gray-800 overflow-hidden border border-slate-200 dark:border-gray-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${accent.barFill} transition-all`}
                style={{ width: `${hydrated ? opProgress.percentage : 0}%` }}
              />
            </div>
            {hydrated && opProgress.isComplete && (
              <p className="mt-2 text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Operation complete — achievement unlocked
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Mission chain */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Mission Chain</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Play each mission in order from the recommended perspective.
            </p>
          </div>
          <Link
            href="/ops"
            className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
          >
            ALL OPS &rarr;
          </Link>
        </div>

        <ol className="space-y-4">
          {opProgress.missions.map(({ mission, index, cleared, lastRun }) => {
            const scenario = scenariosById[mission.scenarioId];
            const isCurrent = !cleared && index === opProgress.currentIndex;
            const perspectiveChip =
              mission.perspective === 'red'
                ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                : 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';

            return (
              <li
                key={mission.scenarioId + ':' + mission.perspective}
                className={`relative rounded-2xl border-2 bg-white dark:bg-gray-900 p-5 transition-all ${
                  cleared
                    ? 'border-emerald-300 dark:border-emerald-500/30'
                    : isCurrent
                    ? `${accent.ring} shadow-md dark:shadow-none ar-fade-in`
                    : 'border-slate-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Step badge */}
                  <div
                    className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-lg ${
                      cleared
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow'
                        : isCurrent
                        ? `bg-gradient-to-br ${accent.badgeBg} text-white shadow`
                        : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500'
                    }`}
                  >
                    {cleared ? (
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500">
                          Mission {index + 1} of {op!.missions.length}
                        </p>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">
                          {mission.title}
                        </h3>
                        {scenario && (
                          <p className="text-[11px] font-mono text-slate-400 dark:text-gray-600 mt-0.5">
                            {scenario.name} · {mission.scenarioId}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${perspectiveChip}`}>
                        {mission.perspective === 'red' ? 'Red Team' : 'Blue Team'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-gray-400 mt-2 leading-relaxed">
                      {mission.briefing}
                    </p>

                    {cleared && lastRun && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          Cleared
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300">+{lastRun.xpEarned} XP</span>
                        <span className="text-slate-500 dark:text-gray-500">
                          {formatDate(lastRun.completedAt)}
                        </span>
                        {lastRun.flawless && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" /></svg>
                            Flawless
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/scenarios/${mission.scenarioId}`}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-white bg-gradient-to-r ${accent.badgeBg} shadow hover:brightness-110 transition`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {cleared ? 'Replay Briefing' : isCurrent ? 'Start Mission' : 'Open Briefing'}
                      </Link>
                      {cleared && lastRun?.incidentId && (
                        <Link
                          href={`/incidents/${lastRun.correlationId}`}
                          className="inline-flex items-center gap-1 text-xs font-mono text-rose-600 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200"
                        >
                          Incident &rarr;
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
