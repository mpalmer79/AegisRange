// ============================================================
// AegisRange Player Progression — Phase 3
//
// Persistent career layer on top of the Phase 2 gamified briefing.
// Tracks XP, rank, mission history and achievements in localStorage.
//
// The Phase 2 briefing page calls recordMission() once per completed
// scenario run; the PlayerCard + /profile page read from this context.
// ============================================================

'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ---------- ranks ----------

export type RankId =
  | 'cadet'
  | 'recruit'
  | 'analyst'
  | 'operator'
  | 'commander'
  | 'legend';

export interface Rank {
  id: RankId;
  name: string;
  minXp: number;
  /** Tailwind color family used by PlayerCard + /profile accents. */
  accent: 'slate' | 'sky' | 'cyan' | 'emerald' | 'violet' | 'amber';
  tagline: string;
}

export const RANKS: Rank[] = [
  { id: 'cadet',     name: 'Cadet',     minXp: 0,    accent: 'slate',   tagline: 'Welcome to the range.' },
  { id: 'recruit',   name: 'Recruit',   minXp: 100,  accent: 'sky',     tagline: 'Basic training in the books.' },
  { id: 'analyst',   name: 'Analyst',   minXp: 300,  accent: 'cyan',    tagline: 'You read the logs before they scream.' },
  { id: 'operator',  name: 'Operator',  minXp: 700,  accent: 'emerald', tagline: 'You ship containment while others triage.' },
  { id: 'commander', name: 'Commander', minXp: 1500, accent: 'violet',  tagline: 'You run the room when it hits the fan.' },
  { id: 'legend',    name: 'Legend',    minXp: 3000, accent: 'amber',   tagline: 'The SOC tells stories about you.' },
];

export function computeRank(totalXp: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (totalXp >= r.minXp) current = r;
  }
  return current;
}

export function computeNextRank(totalXp: number): Rank | null {
  for (const r of RANKS) {
    if (r.minXp > totalXp) return r;
  }
  return null;
}

// ---------- mission history ----------

export interface MissionRecord {
  id: string;
  scenarioId: string;
  scenarioName: string;
  perspective: 'red' | 'blue';
  difficulty: 'recruit' | 'analyst' | 'operator';
  xpEarned: number;
  xpMax: number;
  objectivesHit: number;
  objectivesTotal: number;
  durationSeconds: number;
  completedAt: string;
  correlationId: string;
  incidentId: string | null;
  flawless: boolean;
}

// ---------- achievements ----------

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-mission',    name: 'First Contact',               description: 'Complete your first mission.',                         icon: 'target' },
  { id: 'red-recon',        name: 'Wear the Hood',               description: 'Complete a mission from the Red Team perspective.',    icon: 'sword' },
  { id: 'blue-recon',       name: 'Hold the Line',               description: 'Complete a mission from the Blue Team perspective.',   icon: 'shield' },
  { id: 'flawless',         name: 'Flawless Victory',            description: 'Clear every objective in a single mission.',           icon: 'star' },
  { id: 'operator-tier',    name: 'Operator Ready',              description: 'Complete a mission on Operator difficulty.',           icon: 'cog' },
  { id: 'dual-perspective', name: 'Both Sides of the Keyboard',  description: 'Play the same scenario as both Red and Blue.',         icon: 'swap' },
  { id: 'full-library',     name: 'Full Library',                description: 'Complete all six scenarios at least once.',            icon: 'books' },
  { id: 'xp-500',           name: 'Seasoned',                    description: 'Reach 500 XP.',                                        icon: 'silver' },
  { id: 'xp-1500',          name: 'Decorated',                   description: 'Reach 1500 XP.',                                       icon: 'gold' },
  { id: 'apt-hunter',       name: 'APT Hunter',                  description: 'Complete the correlated multi-stage scenario.',        icon: 'crosshair' },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// ---------- persisted shape ----------

export interface PlayerProgress {
  totalXp: number;
  missions: MissionRecord[];
  achievements: string[];
}

const EMPTY_PROGRESS: PlayerProgress = {
  totalXp: 0,
  missions: [],
  achievements: [],
};

const STORAGE_KEY = 'aegisrange-progress-v1';
const MAX_HISTORY = 50;

function isValidProgress(value: unknown): value is PlayerProgress {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.totalXp === 'number' &&
    Array.isArray(v.missions) &&
    Array.isArray(v.achievements)
  );
}

function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw);
    if (isValidProgress(parsed)) return parsed;
  } catch {
    // ignore malformed storage
  }
  return EMPTY_PROGRESS;
}

function saveProgress(progress: PlayerProgress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // quota / private mode — silently drop
  }
}

// Compute the full set of earned achievement ids for a given state.
function earnedAchievementIds(progress: PlayerProgress): string[] {
  const earned: string[] = [];
  const missions = progress.missions;

  const hasRed = missions.some((m) => m.perspective === 'red');
  const hasBlue = missions.some((m) => m.perspective === 'blue');
  const hasFlawless = missions.some((m) => m.flawless);
  const hasOperator = missions.some((m) => m.difficulty === 'operator');
  const hasApt = missions.some((m) => m.scenarioId === 'scn-corr-006');

  const bySide: Record<string, Set<'red' | 'blue'>> = {};
  for (const m of missions) {
    if (!bySide[m.scenarioId]) bySide[m.scenarioId] = new Set();
    bySide[m.scenarioId].add(m.perspective);
  }
  const dualPerspective = Object.values(bySide).some((set) => set.size === 2);
  const distinctScenarios = new Set(missions.map((m) => m.scenarioId));

  if (missions.length >= 1) earned.push('first-mission');
  if (hasRed) earned.push('red-recon');
  if (hasBlue) earned.push('blue-recon');
  if (hasFlawless) earned.push('flawless');
  if (hasOperator) earned.push('operator-tier');
  if (dualPerspective) earned.push('dual-perspective');
  if (distinctScenarios.size >= 6) earned.push('full-library');
  if (progress.totalXp >= 500) earned.push('xp-500');
  if (progress.totalXp >= 1500) earned.push('xp-1500');
  if (hasApt) earned.push('apt-hunter');

  return earned;
}

// ---------- context ----------

export interface RecordMissionInput {
  scenarioId: string;
  scenarioName: string;
  perspective: 'red' | 'blue';
  difficulty: 'recruit' | 'analyst' | 'operator';
  xpEarned: number;
  xpMax: number;
  objectivesHit: number;
  objectivesTotal: number;
  durationSeconds: number;
  correlationId: string;
  incidentId: string | null;
}

export interface RecordMissionResult {
  newAchievements: Achievement[];
  newRank: Rank | null;
}

interface PlayerProgressContextValue {
  progress: PlayerProgress;
  hydrated: boolean;
  rank: Rank;
  nextRank: Rank | null;
  xpIntoRank: number;
  xpToNextRank: number | null;
  rankProgressPct: number;
  recordMission: (input: RecordMissionInput) => RecordMissionResult;
  resetProgress: () => void;
}

const PlayerProgressContext = createContext<PlayerProgressContextValue | undefined>(
  undefined
);

export function PlayerProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<PlayerProgress>(EMPTY_PROGRESS);
  const [hydrated, setHydrated] = useState(false);
  const progressRef = useRef<PlayerProgress>(EMPTY_PROGRESS);

  // Hydrate once from localStorage on mount.
  useEffect(() => {
    const loaded = loadProgress();
    progressRef.current = loaded;
    setProgress(loaded);
    setHydrated(true);
  }, []);

  // Persist whenever progress changes (after initial hydration).
  useEffect(() => {
    if (!hydrated) return;
    progressRef.current = progress;
    saveProgress(progress);
  }, [progress, hydrated]);

  const recordMission = useCallback((input: RecordMissionInput): RecordMissionResult => {
    const prev = progressRef.current;
    const record: MissionRecord = {
      id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      scenarioId: input.scenarioId,
      scenarioName: input.scenarioName,
      perspective: input.perspective,
      difficulty: input.difficulty,
      xpEarned: Math.max(0, input.xpEarned),
      xpMax: Math.max(0, input.xpMax),
      objectivesHit: input.objectivesHit,
      objectivesTotal: input.objectivesTotal,
      durationSeconds: Math.max(0, input.durationSeconds),
      completedAt: new Date().toISOString(),
      correlationId: input.correlationId,
      incidentId: input.incidentId,
      flawless:
        input.objectivesTotal > 0 &&
        input.objectivesHit === input.objectivesTotal,
    };

    const priorRank = computeRank(prev.totalXp);
    const nextTotalXp = prev.totalXp + record.xpEarned;
    const prevAchSet = new Set(prev.achievements);

    const interim: PlayerProgress = {
      totalXp: nextTotalXp,
      missions: [record, ...prev.missions].slice(0, MAX_HISTORY),
      achievements: prev.achievements,
    };
    const earnedIds = earnedAchievementIds(interim);
    const newlyEarnedIds = earnedIds.filter((id) => !prevAchSet.has(id));

    const next: PlayerProgress = {
      ...interim,
      achievements: Array.from(new Set([...prev.achievements, ...earnedIds])),
    };

    progressRef.current = next;
    setProgress(next);

    const newRank = computeRank(nextTotalXp);
    const newAchievements = newlyEarnedIds
      .map((id) => getAchievement(id))
      .filter((a): a is Achievement => a != null);

    return {
      newAchievements,
      newRank: newRank.id !== priorRank.id ? newRank : null,
    };
  }, []);

  const resetProgress = useCallback(() => {
    progressRef.current = EMPTY_PROGRESS;
    setProgress(EMPTY_PROGRESS);
  }, []);

  const derived = useMemo(() => {
    const rank = computeRank(progress.totalXp);
    const nextRank = computeNextRank(progress.totalXp);
    const xpIntoRank = progress.totalXp - rank.minXp;
    const xpToNextRank = nextRank ? nextRank.minXp - progress.totalXp : null;
    const span = nextRank ? nextRank.minXp - rank.minXp : 0;
    const rankProgressPct = nextRank && span > 0
      ? Math.min(100, Math.max(0, Math.round((xpIntoRank / span) * 100)))
      : 100;
    return { rank, nextRank, xpIntoRank, xpToNextRank, rankProgressPct };
  }, [progress.totalXp]);

  const value: PlayerProgressContextValue = {
    progress,
    hydrated,
    ...derived,
    recordMission,
    resetProgress,
  };

  return (
    <PlayerProgressContext.Provider value={value}>
      {children}
    </PlayerProgressContext.Provider>
  );
}

export function usePlayerProgress(): PlayerProgressContextValue {
  const ctx = useContext(PlayerProgressContext);
  if (!ctx) {
    throw new Error('usePlayerProgress must be used within a PlayerProgressProvider');
  }
  return ctx;
}
