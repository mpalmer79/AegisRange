'use client';

import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { runScenario } from '@/lib/api';
import { SCENARIO_DEFINITIONS, ScenarioResult } from '@/lib/types';
import {
  DIFFICULTIES,
  DifficultyId,
  Perspective,
  getScenarioContent,
  ObjectiveDef,
} from '@/lib/scenario-content';
import { usePlayerProgress, Achievement, Rank, personalBestKey } from '@/lib/player-progress';
import { computeOpProgress, getOpsContainingScenario } from '@/lib/ops-content';
import { getDailyChallenge, isDailyChallengeMatch } from '@/lib/daily-challenge';

/**
 * Scenario drill-down page — Phase 2 gamified mission briefing.
 *
 * Features:
 *  - Per-scenario narrative, attacker/target, MITRE techniques, kill-chain stages
 *  - Red team / blue team perspective switch with distinct objectives
 *  - Difficulty selector with XP multiplier (Recruit / Analyst / Operator)
 *  - Launch button that runs the backend scenario and live-evaluates objectives
 *  - Mission timer, XP meter, completion summary, link to the generated incident
 */

// ---------- per-scenario accent palette (local) ----------
type Accent = {
  chip: string;
  ring: string;
  gradient: string;
  title: string;
  icon: string;
  glow: string;
};

const ACCENTS: Record<string, Accent> = {
  'scn-auth-001': {
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    ring: 'border-rose-300 dark:border-rose-500/30',
    gradient: 'from-rose-100/70 via-white to-white dark:from-rose-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-rose-500 via-red-500 to-orange-500',
    icon: 'from-rose-500 to-red-600',
    glow: 'shadow-rose-400/20 dark:shadow-rose-500/10',
  },
  'scn-session-002': {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    ring: 'border-amber-300 dark:border-amber-500/30',
    gradient: 'from-amber-100/70 via-white to-white dark:from-amber-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-amber-500 via-orange-500 to-red-500',
    icon: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-400/20 dark:shadow-amber-500/10',
  },
  'scn-doc-003': {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    ring: 'border-emerald-300 dark:border-emerald-500/30',
    gradient: 'from-emerald-100/70 via-white to-white dark:from-emerald-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-emerald-500 via-teal-500 to-cyan-500',
    icon: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-400/20 dark:shadow-emerald-500/10',
  },
  'scn-doc-004': {
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    ring: 'border-violet-300 dark:border-violet-500/30',
    gradient: 'from-violet-100/70 via-white to-white dark:from-violet-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-violet-500 via-purple-500 to-fuchsia-500',
    icon: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-400/20 dark:shadow-violet-500/10',
  },
  'scn-svc-005': {
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    ring: 'border-sky-300 dark:border-sky-500/30',
    gradient: 'from-sky-100/70 via-white to-white dark:from-sky-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-sky-500 via-blue-500 to-indigo-500',
    icon: 'from-sky-500 to-blue-600',
    glow: 'shadow-sky-400/20 dark:shadow-sky-500/10',
  },
  'scn-corr-006': {
    chip: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
    ring: 'border-fuchsia-300 dark:border-fuchsia-500/30',
    gradient: 'from-fuchsia-100/70 via-white to-white dark:from-fuchsia-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-fuchsia-500 via-pink-500 to-rose-500',
    icon: 'from-fuchsia-500 via-pink-500 to-rose-600',
    glow: 'shadow-fuchsia-400/20 dark:shadow-fuchsia-500/10',
  },
};

const DEFAULT_ACCENT = ACCENTS['scn-auth-001'];

// ---------- small presentational helpers ----------

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ScenarioDetailPage() {
  const params = useParams<{ scenarioId: string }>();
  const scenarioId = params?.scenarioId;

  const scenario = SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId);
  const content = scenarioId ? getScenarioContent(scenarioId) : undefined;

  if (!scenario || !content) {
    notFound();
  }

  // Non-null after the notFound() guard above.
  const sc = scenario!;
  const ct = content!;
  const accent = ACCENTS[sc.id] ?? DEFAULT_ACCENT;

  // ---------- state ----------
  const [perspective, setPerspective] = useState<Perspective>('blue');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('analyst');
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [launchedAt, setLaunchedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];

  // Timer tick — runs only while status === 'running'
  useEffect(() => {
    if (status !== 'running' || launchedAt == null) return;
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - launchedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, launchedAt]);

  // ---------- derived ----------
  const objectivesForPerspective: ObjectiveDef[] =
    perspective === 'red' ? ct.red.objectives : ct.blue.objectives;

  const objectiveStatus = useMemo(() => {
    if (!result) {
      return objectivesForPerspective.map((o) => ({ ...o, done: false }));
    }
    return objectivesForPerspective.map((o) => ({
      ...o,
      done: o.check(result),
    }));
  }, [result, objectivesForPerspective]);

  const totalXp = objectivesForPerspective.reduce((acc, o) => acc + o.xp, 0);
  const earnedRawXp = objectiveStatus.reduce((acc, o) => acc + (o.done ? o.xp : 0), 0);

  // ---------- career progression (Phase 3) ----------
  const { recordMission, progress } = usePlayerProgress();
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [rankUp, setRankUp] = useState<Rank | null>(null);
  const recordedRef = useRef<string | null>(null);

  // ---------- Daily Challenge (Phase 5) ----------
  // Computed in useEffect to avoid SSR/CSR hydration mismatch around
  // timezone boundaries. First render treats the run as non-daily
  // (dailyBonus = 1) and is corrected after mount.
  const [dailyReady, setDailyReady] = useState(false);
  const [isDailyMatch, setIsDailyMatch] = useState(false);
  const [dailyBonus, setDailyBonus] = useState(1);
  useEffect(() => {
    const match = isDailyChallengeMatch(sc.id, perspective, difficulty.id);
    setIsDailyMatch(match);
    setDailyBonus(match ? getDailyChallenge().bonusMultiplier : 1);
    setDailyReady(true);
  }, [sc.id, perspective, difficulty.id]);

  const earnedXp = Math.round(earnedRawXp * difficulty.xpMultiplier * dailyBonus);
  const maxXp = Math.round(totalXp * difficulty.xpMultiplier * dailyBonus);
  const xpPct = maxXp > 0 ? Math.min(100, Math.round((earnedXp / maxXp) * 100)) : 0;
  const completedCount = objectiveStatus.filter((o) => o.done).length;
  const allComplete = result != null && completedCount === objectivesForPerspective.length;

  // ---------- Personal Best (Phase 5) ----------
  const personalBest = progress.personalBests[personalBestKey(sc.id, perspective)] ?? null;
  const [newPersonalBest, setNewPersonalBest] = useState(false);
  const [previousBestXp, setPreviousBestXp] = useState<number | null>(null);
  const [streakReached, setStreakReached] = useState<number | null>(null);

  // ---------- op membership (Phase 4) ----------
  // If this scenario is part of one or more Training Ops, compute each
  // op's progress so the briefing page can surface a "Part of Op X —
  // step N/M" banner with a link back to the op detail page.
  const opContexts = useMemo(() => {
    const ops = getOpsContainingScenario(sc.id);
    return ops.map((op) => {
      const opProgress = computeOpProgress(op, progress.missions);
      const missionIndex = op.missions.findIndex((m) => m.scenarioId === sc.id);
      const mission = missionIndex >= 0 ? op.missions[missionIndex] : null;
      const cleared = missionIndex >= 0 && opProgress.missions[missionIndex]?.cleared;
      return { op, opProgress, missionIndex, mission, cleared };
    });
  }, [sc.id, progress.missions]);

  // Fire recordMission() exactly once per completed run. The recordedRef
  // key combines the run's correlation id + perspective so swapping
  // perspectives after a run doesn't double-count.
  useEffect(() => {
    if (status !== 'complete' || !result) return;
    const key = `${result.correlation_id}:${perspective}`;
    if (recordedRef.current === key) return;
    recordedRef.current = key;
    const outcome = recordMission({
      scenarioId: sc.id,
      scenarioName: sc.name,
      perspective,
      difficulty: difficulty.id,
      xpEarned: earnedXp,
      xpMax: maxXp,
      objectivesHit: completedCount,
      objectivesTotal: objectivesForPerspective.length,
      durationSeconds: elapsedSec,
      correlationId: result.correlation_id,
      incidentId: result.incident_id,
      isDailyChallenge: isDailyMatch,
    });
    if (outcome.newAchievements.length > 0) {
      setNewAchievements(outcome.newAchievements);
    }
    if (outcome.newRank) {
      setRankUp(outcome.newRank);
    }
    setNewPersonalBest(outcome.newPersonalBest);
    setPreviousBestXp(outcome.previousBestXp);
    setStreakReached(outcome.streakReached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result]);

  // ---------- actions ----------
  const launch = async () => {
    setStatus('running');
    setErrorMsg(null);
    setResult(null);
    setElapsedSec(0);
    setNewAchievements([]);
    setRankUp(null);
    setNewPersonalBest(false);
    setPreviousBestXp(null);
    setStreakReached(null);
    const started = Date.now();
    setLaunchedAt(started);
    try {
      const r = await runScenario(sc.id);
      setResult(r);
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
      setStatus('complete');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setResult(null);
    setErrorMsg(null);
    setLaunchedAt(null);
    setElapsedSec(0);
    setNewAchievements([]);
    setRankUp(null);
    setNewPersonalBest(false);
    setPreviousBestXp(null);
    setStreakReached(null);
    recordedRef.current = null;
  };

  const isRed = perspective === 'red';
  const perspectiveMeta = isRed ? ct.red : ct.blue;
  const perspectiveColor = isRed
    ? 'text-rose-700 dark:text-rose-300'
    : 'text-sky-700 dark:text-sky-300';
  const perspectiveBadge = isRed
    ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
    : 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';

  // ---------- render ----------
  return (
    <div className="text-slate-800 dark:text-gray-100">
      {/* Top bar with HOME + breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap mb-8 ar-fade-in">
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
          <Link href="/scenarios" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Scenarios</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-gray-300">{sc.id.toUpperCase()}</span>
        </nav>
      </div>

      {/* Phase 5 — Daily Challenge banner. Shown when this scenario +
          perspective + difficulty match today's Daily Challenge.
          Detection runs in a useEffect to avoid SSR hydration drift. */}
      {dailyReady && isDailyMatch && (
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
      )}

      {/* Phase 4 — op membership banner. Shown only when the scenario
          is part of at least one Training Op. */}
      {opContexts.length > 0 && (
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
      )}

      {/* Hero card */}
      <section
        className={`relative overflow-hidden rounded-2xl border-2 ${accent.ring} bg-gradient-to-br ${accent.gradient} p-6 sm:p-8 mb-6 shadow-lg ${accent.glow} ar-slide-up`}
      >
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent dark:from-white/10 dark:via-white/5 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`inline-flex items-center text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full border ${accent.chip}`}>
                {sc.id.toUpperCase()}
              </span>
              <span className="inline-flex items-center text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full border border-slate-300 dark:border-gray-700 text-slate-600 dark:text-gray-400">
                MISSION BRIEFING
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-2">
              <span className={`bg-gradient-to-r ${accent.title} bg-clip-text text-transparent`}>
                {sc.name}
              </span>
            </h1>
            <p className="text-sm font-mono italic text-slate-500 dark:text-gray-400 mb-4">
              &ldquo;{ct.tagline}&rdquo;
            </p>
            <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              {ct.backstory}
            </p>

            {/* Attacker / Target row */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">Attacker</p>
                <p className="text-sm text-slate-700 dark:text-gray-200">{ct.attacker}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">Target</p>
                <p className="text-sm text-slate-700 dark:text-gray-200">{ct.target}</p>
              </div>
            </div>
          </div>

          {/* MITRE techniques chip stack */}
          <div className="flex flex-col gap-2 lg:w-64 shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">MITRE ATT&amp;CK</p>
            <div className="flex flex-wrap gap-2">
              {ct.mitreTechniques.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-[11px]"
                >
                  <span className="font-mono text-cyan-700 dark:text-cyan-300">{t.id}</span>
                  <span className="text-slate-600 dark:text-gray-300">{t.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Two-column body: objectives + controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ----------------- LEFT (2/3): perspective + objectives ----------------- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Perspective switcher */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 sm:p-6 shadow-sm dark:shadow-none ar-fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
                  Perspective
                </p>
                <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">
                  Choose your side
                </h2>
              </div>
              <div
                role="tablist"
                aria-label="Perspective"
                className="inline-flex rounded-full border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900 p-1"
              >
                <button
                  role="tab"
                  aria-selected={isRed}
                  onClick={() => setPerspective('red')}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all ${
                    isRed
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30'
                      : 'text-slate-600 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-300'
                  }`}
                >
                  Red Team
                </button>
                <button
                  role="tab"
                  aria-selected={!isRed}
                  onClick={() => setPerspective('blue')}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all ${
                    !isRed
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                      : 'text-slate-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-300'
                  }`}
                >
                  Blue Team
                </button>
              </div>
            </div>

            <div className={`mb-5 px-4 py-3 rounded-lg border ${perspectiveBadge}`}>
              <p className={`text-xs font-mono uppercase tracking-wider ${perspectiveColor} mb-1`}>
                Role: {perspectiveMeta.role}
              </p>
              <p className="text-sm text-slate-700 dark:text-gray-300">{perspectiveMeta.summary}</p>
            </div>

            {/* Objectives checklist */}
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-2">
              Objectives
            </p>
            <ul className="space-y-3">
              {objectiveStatus.map((o, idx) => {
                const done = o.done;
                return (
                  <li
                    key={o.id}
                    className={`relative flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      done
                        ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5'
                        : 'border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-gray-700 text-slate-400 dark:text-gray-600'
                      }`}
                      aria-hidden
                    >
                      {done ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      ) : (
                        <span className="text-[11px] font-mono">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm font-semibold ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-gray-100'}`}>
                          {o.title}
                        </p>
                        <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          done
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-gray-800 text-slate-600 dark:text-gray-400'
                        }`}>
                          +{Math.round(o.xp * difficulty.xpMultiplier)} XP
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{o.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mission stages */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 sm:p-6 shadow-sm dark:shadow-none ar-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
                  Cyber Kill Chain
                </p>
                <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">Mission Stages</h2>
              </div>
              {result?.correlation_id && (
                <Link
                  href={`/killchain`}
                  className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300 hover:underline"
                >
                  View kill-chain analysis &rarr;
                </Link>
              )}
            </div>
            <ol className="space-y-3">
              {ct.stages.map((stage, i) => {
                const reached = status === 'complete' && i < ct.stages.length;
                return (
                  <li key={stage.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border-2 ${
                          reached
                            ? `bg-gradient-to-br ${accent.icon} border-transparent text-white`
                            : 'border-slate-300 dark:border-gray-700 text-slate-400 dark:text-gray-600'
                        }`}
                      >
                        {i + 1}
                      </div>
                      {i < ct.stages.length - 1 && (
                        <div className={`w-0.5 flex-1 mt-1 ${reached ? 'bg-gradient-to-b from-cyan-400 to-transparent' : 'bg-slate-200 dark:bg-gray-800'}`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                        {stage.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{stage.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* ----------------- RIGHT (1/3): control tower ----------------- */}
        <div className="space-y-6">
          {/* Difficulty selector */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 shadow-sm dark:shadow-none ar-fade-in">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
              Difficulty
            </p>
            <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">Pick your rank</h3>
            <div className="space-y-2">
              {DIFFICULTIES.map((d) => {
                const active = d.id === difficultyId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficultyId(d.id)}
                    disabled={status === 'running'}
                    aria-pressed={active}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      active
                        ? 'border-cyan-400 dark:border-cyan-500/60 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 shadow-sm'
                        : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-bold ${active ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-gray-200'}`}>
                        {d.label}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                        {d.xpMultiplier}&times; XP
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-500">{d.blurb}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mission HUD */}
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
                <p className={`text-xl font-mono font-bold ${status === 'running' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-gray-100'}`}>
                  {formatElapsed(elapsedSec)}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/80 dark:bg-gray-900/60">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">
                  Objectives
                </p>
                <p className="text-xl font-mono font-bold text-slate-800 dark:text-gray-100">
                  {completedCount}/{objectivesForPerspective.length}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[10px] font-mono text-slate-400 dark:text-gray-600">
              Budget: {formatElapsed(difficulty.timeBudgetSeconds)} &middot; {difficulty.label}
            </p>
          </div>

          {/* Launch / result */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 shadow-sm dark:shadow-none ar-fade-in">
            {status === 'idle' && (
              <>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
                  Ready to deploy
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  Launch the scenario to execute it on the backend and auto-evaluate objectives.
                </p>
                <button
                  onClick={launch}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm tracking-wider uppercase text-white bg-gradient-to-r ${accent.title} shadow-lg ${accent.glow} hover:brightness-110 transition-all ar-pulse-ring`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Launch Mission
                </button>
              </>
            )}

            {status === 'running' && (
              <>
                <p className="text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 animate-pulse">
                  In Progress
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  Executing scenario on the backend. Objectives will light up as the result lands.
                </p>
                <button
                  disabled
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm tracking-wider uppercase text-white bg-gradient-to-r from-amber-500 to-orange-500 cursor-wait opacity-90"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Running...
                </button>
              </>
            )}

            {status === 'complete' && result && (
              <>
                <p className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${
                  allComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-cyan-600 dark:text-cyan-400'
                }`}>
                  {allComplete ? 'Mission Complete' : 'Debrief'}
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  {allComplete
                    ? `All ${perspectiveMeta.role} objectives met in ${formatElapsed(elapsedSec)}.`
                    : `${completedCount} of ${objectivesForPerspective.length} objectives met. Review the debrief below.`}
                </p>

                <div className="mb-4 rounded-lg border border-cyan-300 dark:border-cyan-500/30 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 p-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1 flex items-center justify-between gap-2">
                    <span>XP Awarded</span>
                    {isDailyMatch && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">
                        Daily {dailyBonus}&times;
                      </span>
                    )}
                  </p>
                  <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300 font-[family-name:var(--font-geist-mono)]">
                    +{earnedXp}
                    <span className="text-xs font-normal text-slate-500 dark:text-gray-500"> / {maxXp} max</span>
                  </p>
                  {previousBestXp != null && !newPersonalBest && (
                    <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500 mt-1">
                      Previous best: +{previousBestXp} XP
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-1">
                    Added to your{' '}
                    <Link href="/profile" className="text-cyan-700 dark:text-cyan-300 hover:underline">
                      career profile
                    </Link>
                    .
                  </p>
                </div>

                {newPersonalBest && (
                  <div className="mb-4 rounded-lg border-2 border-amber-400 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-500/10 dark:via-yellow-500/10 dark:to-orange-500/10 p-3 ar-bounce-in">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
                        <path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" />
                      </svg>
                      New Personal Best
                    </p>
                    <p className="text-base font-bold text-amber-700 dark:text-amber-300">
                      +{earnedXp} XP
                      {previousBestXp != null && (
                        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-gray-500">
                          (prev: {previousBestXp})
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {streakReached != null && streakReached >= 2 && (
                  <div className="mb-4 rounded-lg border border-orange-300 dark:border-orange-500/40 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-500/10 dark:to-red-500/10 p-3 ar-fade-in">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300 mb-1 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
                      </svg>
                      Streak
                    </p>
                    <p className="text-base font-bold text-orange-700 dark:text-orange-300">
                      {streakReached}-day run
                    </p>
                  </div>
                )}

                {rankUp && (
                  <div className="mb-4 rounded-lg border-2 border-fuchsia-300 dark:border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-50 via-violet-50 to-purple-50 dark:from-fuchsia-500/10 dark:via-violet-500/10 dark:to-purple-500/10 p-3 ar-bounce-in relative overflow-hidden">
                    <div aria-hidden className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-fuchsia-200/50 dark:bg-fuchsia-500/10 blur-2xl" />
                    <div className="relative">
                      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fuchsia-700 dark:text-fuchsia-300 mb-1 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17l5-5 5 5" />
                          <path d="M7 11l5-5 5 5" />
                        </svg>
                        Rank Up
                      </p>
                      <p className="text-lg font-bold bg-gradient-to-r from-fuchsia-600 via-violet-500 to-purple-600 dark:from-fuchsia-300 dark:via-violet-300 dark:to-purple-300 bg-clip-text text-transparent">
                        {rankUp.name}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-gray-400 mt-0.5">
                        {rankUp.tagline}
                      </p>
                    </div>
                  </div>
                )}

                {newAchievements.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 p-3 ar-bounce-in">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
                      </svg>
                      Achievement{newAchievements.length > 1 ? 's' : ''} Unlocked
                    </p>
                    <ul className="space-y-1">
                      {newAchievements.map((a) => (
                        <li key={a.id} className="text-xs">
                          <p className="font-semibold text-amber-700 dark:text-amber-300">{a.name}</p>
                          <p className="text-[11px] text-slate-600 dark:text-gray-400">{a.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <dl className="space-y-2 text-xs font-mono mb-4">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-gray-500">CORRELATION</dt>
                    <dd className="text-cyan-700 dark:text-cyan-300 truncate max-w-[60%]" title={result.correlation_id}>
                      {result.correlation_id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-gray-500">EVENTS</dt>
                    <dd className="text-slate-700 dark:text-gray-200">{result.events_generated ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-gray-500">ALERTS</dt>
                    <dd className="text-amber-700 dark:text-amber-300">{result.alerts_generated ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-gray-500">RESPONSES</dt>
                    <dd className="text-orange-700 dark:text-orange-300">{result.responses_generated ?? 0}</dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-2">
                  {result.incident_id && (
                    <Link
                      href={`/incidents/${result.correlation_id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-white bg-gradient-to-r from-rose-500 to-red-600 hover:brightness-110 transition"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Open Incident
                    </Link>
                  )}
                  <button
                    onClick={reset}
                    className="w-full px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
                  >
                    Run Again
                  </button>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <p className="text-[10px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                  Mission Failed
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                  The backend rejected the scenario run. Check that the API is reachable.
                </p>
                <p className="text-xs font-mono text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded p-2 mb-4 break-words">
                  {errorMsg ?? 'Unknown error'}
                </p>
                <button
                  onClick={reset}
                  className="w-full px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
