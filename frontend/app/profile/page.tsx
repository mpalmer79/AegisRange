'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ACHIEVEMENTS,
  RANKS,
  usePlayerProgress,
  MissionRecord,
  PersonalBest,
  Rank,
  personalBestKey,
} from '@/lib/player-progress';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import { computeAllOpProgress } from '@/lib/ops-content';

/**
 * /profile — Phase 3 career dashboard.
 *
 * Full view of the player's persistent progression: current rank, XP
 * toward next tier, achievements grid, per-scenario completion matrix,
 * and the last 50 mission records. A "Reset Career" button wipes the
 * localStorage-backed progress (with a confirm step).
 */

const ACCENT_GRADIENTS: Record<Rank['accent'], string> = {
  slate:   'from-slate-200 via-slate-100 to-white dark:from-slate-500/20 dark:via-slate-500/5 dark:to-gray-950',
  sky:     'from-sky-200 via-sky-100 to-white dark:from-sky-500/20 dark:via-sky-500/5 dark:to-gray-950',
  cyan:    'from-cyan-200 via-cyan-100 to-white dark:from-cyan-500/20 dark:via-cyan-500/5 dark:to-gray-950',
  emerald: 'from-emerald-200 via-emerald-100 to-white dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-gray-950',
  violet:  'from-violet-200 via-violet-100 to-white dark:from-violet-500/20 dark:via-violet-500/5 dark:to-gray-950',
  amber:   'from-amber-200 via-amber-100 to-white dark:from-amber-500/20 dark:via-amber-500/5 dark:to-gray-950',
};

const ACCENT_TEXT: Record<Rank['accent'], string> = {
  slate:   'text-slate-700 dark:text-slate-200',
  sky:     'text-sky-700 dark:text-sky-300',
  cyan:    'text-cyan-700 dark:text-cyan-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  violet:  'text-violet-700 dark:text-violet-300',
  amber:   'text-amber-700 dark:text-amber-300',
};

const ACCENT_BAR: Record<Rank['accent'], string> = {
  slate:   'from-slate-400 to-slate-500',
  sky:     'from-sky-400 to-blue-500',
  cyan:    'from-cyan-400 to-sky-500',
  emerald: 'from-emerald-400 to-teal-500',
  violet:  'from-violet-400 to-purple-500',
  amber:   'from-amber-400 to-orange-500',
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function AchievementIcon({ icon, earned }: { icon: string; earned: boolean }) {
  const cls = `w-5 h-5 ${earned ? '' : 'opacity-40'}`;
  switch (icon) {
    case 'target':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
    case 'sword':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></svg>;
    case 'shield':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'star':
      return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" /></svg>;
    case 'cog':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
    case 'swap':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l-4 4 4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></svg>;
    case 'books':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v16H4z" /><path d="M10 4h6v16h-6z" /><path d="M16 6l4 1-3 14-4-1z" /></svg>;
    case 'silver':
    case 'gold':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6" /><path d="M8 14l-2 8 6-3 6 3-2-8" /></svg>;
    case 'crosshair':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /></svg>;
    case 'moon':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>;
    case 'flame':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2s4 5 4 9a4 4 0 11-8 0c0-2 1-3 2-4-0.5 2 1 3 2 3 0-3-1-5 0-8z" /><path d="M7 16a5 5 0 0010 0" /></svg>;
    case 'radio':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 010 8.4M7.8 7.8a6 6 0 000 8.4" /><path d="M19 5a10 10 0 010 14M5 5a10 10 0 000 14" /></svg>;
    case 'calendar':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>;
    case 'bolt':
      return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>;
    case 'inferno':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s5 4 5 9a5 5 0 11-10 0c0-2 1-4 2-5 0 2 1 3 3 3-1-3 0-5 0-7z" /><path d="M9 17a3 3 0 006 0" /></svg>;
    case 'trophy':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" /></svg>;
    default:
      return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>;
  }
}

function PerspectiveChip({ perspective }: { perspective: 'red' | 'blue' }) {
  const cls = perspective === 'red'
    ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
    : 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {perspective === 'red' ? 'Red Team' : 'Blue Team'}
    </span>
  );
}

function DifficultyChip({ difficulty }: { difficulty: MissionRecord['difficulty'] }) {
  const cls =
    difficulty === 'operator'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
      : difficulty === 'analyst'
      ? 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30'
      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {difficulty}
    </span>
  );
}

export default function ProfilePage() {
  const {
    progress,
    hydrated,
    rank,
    nextRank,
    xpIntoRank,
    xpToNextRank,
    rankProgressPct,
    resetProgress,
  } = usePlayerProgress();
  const [confirmReset, setConfirmReset] = useState(false);

  const accentGradient = ACCENT_GRADIENTS[rank.accent];
  const accentText = ACCENT_TEXT[rank.accent];
  const accentBar = ACCENT_BAR[rank.accent];

  const earnedAch = new Set(progress.achievements);
  const missions = progress.missions;
  const missionsCompleted = missions.length;
  const flawlessCount = missions.filter((m) => m.flawless).length;
  const bestRun = missions
    .filter((m) => m.xpMax > 0)
    .reduce<MissionRecord | null>(
      (best, m) => (!best || m.xpEarned > best.xpEarned ? m : best),
      null
    );

  // Per-scenario coverage: which sides have been cleared?
  const perScenario: Record<string, { red: boolean; blue: boolean; lastPlayed?: string }> = {};
  for (const def of SCENARIO_DEFINITIONS) {
    perScenario[def.id] = { red: false, blue: false };
  }
  for (const m of missions) {
    const entry = perScenario[m.scenarioId] ?? { red: false, blue: false };
    if (m.perspective === 'red') entry.red = true;
    if (m.perspective === 'blue') entry.blue = true;
    if (!entry.lastPlayed || entry.lastPlayed < m.completedAt) entry.lastPlayed = m.completedAt;
    perScenario[m.scenarioId] = entry;
  }

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
          <span className="text-slate-700 dark:text-gray-300">Career</span>
        </nav>
      </div>

      {/* Hero rank card */}
      <section
        className={`relative overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-gray-800 bg-gradient-to-br ${accentGradient} p-6 sm:p-8 mb-8 shadow-lg dark:shadow-none ar-slide-up`}
      >
        <div aria-hidden className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/40 dark:bg-white/5 blur-3xl" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/30 dark:bg-white/5 blur-3xl" />

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
              {hydrated ? progress.totalXp : '—'}
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
              : `${progress.totalXp} XP lifetime`}
          </p>
        </div>
      </section>

      {/* Quick stats */}
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
            {earnedAch.size}
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
            {progress.streak.current}
            <span className="text-[11px] font-normal text-slate-500 dark:text-gray-500">
              {progress.streak.best > progress.streak.current ? `best ${progress.streak.best}` : progress.streak.current === 1 ? 'day' : 'days'}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm dark:shadow-none">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">Dailies</p>
          <p className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-300 mt-1">
            {progress.dailyCompletions.length}
          </p>
        </div>
      </div>

      {/* Achievements grid */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Achievements</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Unlock by completing missions and clearing objectives.
            </p>
          </div>
          <p className="text-xs font-mono text-slate-500 dark:text-gray-500">
            {earnedAch.size} / {ACHIEVEMENTS.length}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const earned = earnedAch.has(a.id);
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  earned
                    ? 'border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-gray-950'
                    : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                }`}
              >
                <div
                  className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    earned
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600'
                  }`}
                >
                  <AchievementIcon icon={a.icon} earned={earned} />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      earned
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-700 dark:text-gray-300'
                    }`}
                  >
                    {a.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                    {a.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Training Ops progress (Phase 4) */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Training Ops</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Curated sequences of scenarios. Clear an op to unlock its achievement.
            </p>
          </div>
          <Link
            href="/ops"
            className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
          >
            ALL OPS &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {computeAllOpProgress(progress.missions).map(({ op, completedCount, totalCount, percentage, isComplete, currentIndex }) => {
            const currentMission = op.missions[currentIndex] ?? op.missions[op.missions.length - 1];
            return (
              <Link
                key={op.id}
                href={`/ops/${op.id}`}
                className={`rounded-xl border-2 p-4 bg-white dark:bg-gray-900 transition-colors block ${
                  isComplete
                    ? 'border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500 dark:hover:border-emerald-400'
                    : 'border-slate-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-500/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-slate-500 dark:text-gray-500">
                    {op.codename}
                  </p>
                  {isComplete ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      Cleared
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-gray-500">
                      {completedCount} / {totalCount}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{op.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-gray-500 italic mt-0.5 line-clamp-2">
                  {op.tagline}
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isComplete ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-cyan-400 to-sky-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-gray-500 truncate">
                  {isComplete ? 'Achievement unlocked' : `Next · ${currentMission?.title ?? 'Start'}`}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Per-scenario coverage */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Scenario Coverage</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Play every scenario from both sides to complete the library.
            </p>
          </div>
          <Link
            href="/scenarios"
            className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
          >
            VIEW ALL &rarr;
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Scenario</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Red</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Blue</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-gray-500 uppercase tracking-wider">Last Played</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {SCENARIO_DEFINITIONS.map((def) => {
                const entry = perScenario[def.id];
                return (
                  <tr key={def.id} className="border-b border-slate-200 dark:border-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{def.name}</p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500">{def.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-mono ${entry?.red ? 'text-rose-600 dark:text-rose-300' : 'text-slate-400 dark:text-gray-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${entry?.red ? 'bg-rose-500' : 'bg-slate-300 dark:bg-gray-700'}`} />
                        {entry?.red ? 'Cleared' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-mono ${entry?.blue ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400 dark:text-gray-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${entry?.blue ? 'bg-sky-500' : 'bg-slate-300 dark:bg-gray-700'}`} />
                        {entry?.blue ? 'Cleared' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-gray-500">
                      {entry?.lastPlayed ? formatDate(entry.lastPlayed) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/scenarios/${def.id}`}
                        className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
                      >
                        Briefing &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Personal Bests (Phase 5) */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Personal Bests</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Your highest XP run on each scenario and perspective. Beat a best to unlock the Personal Best achievement.
            </p>
          </div>
          <p className="text-xs font-mono text-slate-500 dark:text-gray-500">
            {Object.keys(progress.personalBests).length} tracked · {progress.personalBestBeats} beaten
          </p>
        </div>
        {Object.keys(progress.personalBests).length === 0 ? (
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
                const pb: PersonalBest | undefined = progress.personalBests[key];
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

      {/* Mission history */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Mission History</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Your last {missions.length > 0 ? missions.length : 50} mission runs.
            </p>
          </div>
        </div>
        {missions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/70 p-8 text-center">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              No missions recorded yet. Launch a scenario from the{' '}
              <Link href="/scenarios" className="text-cyan-700 dark:text-cyan-300 hover:underline">briefing room</Link>{' '}
              to start earning XP.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none divide-y divide-slate-200 dark:divide-gray-800">
            {missions.map((m) => (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/scenarios/${m.scenarioId}`}
                      className="text-sm font-semibold text-slate-800 dark:text-gray-100 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors truncate"
                    >
                      {m.scenarioName}
                    </Link>
                    <PerspectiveChip perspective={m.perspective} />
                    <DifficultyChip difficulty={m.difficulty} />
                    {m.flawless && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" /></svg>
                        Flawless
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500 mt-1">
                    {formatDate(m.completedAt)} · {formatDuration(m.durationSeconds)} ·{' '}
                    {m.objectivesHit}/{m.objectivesTotal} objectives
                    {m.correlationId && <> · {m.correlationId}</>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">XP</p>
                    <p className="text-base font-mono font-bold text-cyan-600 dark:text-cyan-300">
                      +{m.xpEarned}
                      <span className="text-xs font-normal text-slate-500 dark:text-gray-500"> / {m.xpMax}</span>
                    </p>
                  </div>
                  {m.incidentId && (
                    <Link
                      href={`/incidents/${m.correlationId}`}
                      className="text-xs font-mono text-rose-600 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 transition-colors"
                    >
                      Incident &rarr;
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rank ladder */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-3">Rank Ladder</h2>
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none p-5">
          <ol className="space-y-3">
            {RANKS.map((r) => {
              const reached = progress.totalXp >= r.minXp;
              const current = r.id === rank.id;
              return (
                <li key={r.id} className="flex items-center gap-4">
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono border-2 ${
                      current
                        ? `border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 ${ACCENT_TEXT[r.accent]}`
                        : reached
                        ? 'border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-600'
                    }`}
                  >
                    {reached ? '✓' : '·'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${current ? ACCENT_TEXT[r.accent] : reached ? 'text-slate-800 dark:text-gray-100' : 'text-slate-500 dark:text-gray-500'}`}>
                      {r.name}
                      {current && <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Current</span>}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500">{r.tagline}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-gray-500 shrink-0">
                    {r.minXp} XP
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Reset footer */}
      <section className="mb-8">
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950/50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">Reset career</p>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Wipes all local XP, missions and achievements. This cannot be undone.
            </p>
          </div>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetProgress();
                  setConfirmReset(false);
                }}
                className="px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-white bg-rose-600 hover:bg-rose-500 transition"
              >
                Confirm Wipe
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
            >
              Reset Career
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
