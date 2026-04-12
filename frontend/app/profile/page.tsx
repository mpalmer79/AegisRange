'use client';

import { useState } from 'react';
import {
  usePlayerProgress,
  MissionRecord,
} from '@/lib/player-progress';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import { computeAllOpProgress } from '@/lib/ops-content';

import ProfileHeader from './components/ProfileHeader';
import RankHeroCard from './components/RankHeroCard';
import QuickStats from './components/QuickStats';
import AchievementsGrid from './components/AchievementsGrid';
import TrainingOpsProgress from './components/TrainingOpsProgress';
import ScenarioCoverage, { ScenarioEntry } from './components/ScenarioCoverage';
import PersonalBests from './components/PersonalBests';
import MissionHistory from './components/MissionHistory';
import RankLadder from './components/RankLadder';
import ResetCareer from './components/ResetCareer';

/**
 * /profile — Phase 3 career dashboard.
 *
 * Full view of the player's persistent progression: current rank, XP
 * toward next tier, achievements grid, per-scenario completion matrix,
 * and the last 50 mission records. A "Reset Career" button wipes the
 * localStorage-backed progress (with a confirm step).
 */
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
  const perScenario: Record<string, ScenarioEntry> = {};
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

  const opProgressList = computeAllOpProgress(progress.missions);

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <ProfileHeader />

      <RankHeroCard
        rank={rank}
        nextRank={nextRank}
        xpIntoRank={xpIntoRank}
        xpToNextRank={xpToNextRank}
        rankProgressPct={rankProgressPct}
        totalXp={progress.totalXp}
        hydrated={hydrated}
      />

      <QuickStats
        missionsCompleted={missionsCompleted}
        flawlessCount={flawlessCount}
        earnedAchievementsCount={earnedAch.size}
        bestRun={bestRun}
        streak={progress.streak}
        dailyCompletionsCount={progress.dailyCompletions.length}
      />

      <AchievementsGrid earnedAch={earnedAch} />

      <TrainingOpsProgress opProgressList={opProgressList} />

      <ScenarioCoverage perScenario={perScenario} />

      <PersonalBests
        personalBests={progress.personalBests}
        personalBestBeats={progress.personalBestBeats}
      />

      <MissionHistory missions={missions} />

      <RankLadder totalXp={progress.totalXp} currentRankId={rank.id} />

      <ResetCareer
        confirmReset={confirmReset}
        onRequestReset={() => setConfirmReset(true)}
        onConfirmReset={() => { resetProgress(); setConfirmReset(false); }}
        onCancelReset={() => setConfirmReset(false)}
      />
    </div>
  );
}
