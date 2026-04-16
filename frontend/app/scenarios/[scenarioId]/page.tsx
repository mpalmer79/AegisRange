'use client';

import { useParams, notFound } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { runScenario, getScenarioErrorMessage, ApiError } from '@/lib/api';
import { useAuth, canRunScenarios } from '@/lib/auth-context';
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

import PageBreadcrumb from './components/PageBreadcrumb';
import DailyChallengeBanner from './components/DailyChallengeBanner';
import OpMembershipBanner from './components/OpMembershipBanner';
import ScenarioHeroCard from './components/ScenarioHeroCard';
import PerspectiveSwitcher from './components/PerspectiveSwitcher';
import MissionStages from './components/MissionStages';
import DifficultySelector from './components/DifficultySelector';
import MissionHUD from './components/MissionHUD';
import LaunchPanel from './components/LaunchPanel';
import { ACCENTS, DEFAULT_ACCENT } from './components/accents';

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

  // ---------- auth ----------
  const { isAuthenticated, role } = useAuth();
  const hasAccess = isAuthenticated && canRunScenarios(role);

  // ---------- state ----------
  const [perspective, setPerspective] = useState<Perspective>('blue');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('analyst');
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
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
    if (!isAuthenticated) {
      setErrorMsg('Please sign in to run scenarios.');
      setErrorDetail(null);
      setStatus('error');
      return;
    }
    if (!hasAccess) {
      setErrorMsg('Your account does not have permission to run scenarios.');
      setErrorDetail(null);
      setStatus('error');
      return;
    }
    setStatus('running');
    setErrorMsg(null);
    setErrorDetail(null);
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
      setErrorMsg(getScenarioErrorMessage(err));
      setErrorDetail(err instanceof ApiError ? err.detail ?? null : null);
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setResult(null);
    setErrorMsg(null);
    setErrorDetail(null);
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
      <PageBreadcrumb scenarioId={sc.id} />

      <DailyChallengeBanner
        dailyReady={dailyReady}
        isDailyMatch={isDailyMatch}
        dailyBonus={dailyBonus}
      />

      <OpMembershipBanner opContexts={opContexts} />

      <ScenarioHeroCard sc={sc} ct={ct} accent={accent} />

      {/* Two-column body: objectives + controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (2/3): perspective + objectives */}
        <div className="lg:col-span-2 space-y-6">
          <PerspectiveSwitcher
            perspective={perspective}
            setPerspective={setPerspective}
            perspectiveMeta={perspectiveMeta}
            perspectiveColor={perspectiveColor}
            perspectiveBadge={perspectiveBadge}
            objectiveStatus={objectiveStatus}
            xpMultiplier={difficulty.xpMultiplier}
            isRunning={status === 'running'}
          />

          <MissionStages
            stages={ct.stages}
            accent={accent}
            isComplete={status === 'complete'}
            correlationId={result?.correlation_id}
          />
        </div>

        {/* RIGHT (1/3): control tower */}
        <div className="space-y-6">
          <DifficultySelector
            difficultyId={difficultyId}
            setDifficultyId={setDifficultyId}
            isRunning={status === 'running'}
          />

          <MissionHUD
            earnedXp={earnedXp}
            maxXp={maxXp}
            xpPct={xpPct}
            elapsedSec={elapsedSec}
            completedCount={completedCount}
            totalObjectives={objectivesForPerspective.length}
            difficultyLabel={difficulty.label}
            timeBudgetSeconds={difficulty.timeBudgetSeconds}
            isRunning={status === 'running'}
            personalBest={personalBest}
          />

          <LaunchPanel
            status={status}
            result={result}
            errorMsg={errorMsg}
            errorDetail={errorDetail}
            accent={accent}
            allComplete={allComplete}
            perspectiveRole={perspectiveMeta.role}
            elapsedSec={elapsedSec}
            completedCount={completedCount}
            totalObjectives={objectivesForPerspective.length}
            earnedXp={earnedXp}
            maxXp={maxXp}
            isDailyMatch={isDailyMatch}
            dailyBonus={dailyBonus}
            previousBestXp={previousBestXp}
            newPersonalBest={newPersonalBest}
            streakReached={streakReached}
            rankUp={rankUp}
            newAchievements={newAchievements}
            isAuthenticated={isAuthenticated}
            hasAccess={hasAccess}
            role={role}
            onLaunch={launch}
            onReset={reset}
          />
        </div>
      </div>
    </div>
  );
}
