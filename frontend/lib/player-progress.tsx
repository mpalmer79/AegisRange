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
import { completedOpIds } from './ops-content';
import { addDaysToKey, toLocalDateKey } from './daily-challenge';

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

/**
 * Category drives the per-card gradient/flair styling on the
 * profile page. Kept on the achievement so the catalog stays the
 * single source of truth.
 */
export type AchievementCategory =
  | 'core'     // onboarding + career milestones (cyan / sky / indigo)
  | 'red'      // red team accomplishments (rose / red / orange)
  | 'blue'     // blue team accomplishments (sky / blue)
  | 'elite'    // mastery flourishes (amber / gold)
  | 'op'       // training op completions (per-op accent)
  | 'daily';   // phase 5 retention mechanics (fuchsia / violet)

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-mission',    name: 'First Contact',               description: 'Complete your first mission.',                         icon: 'target',    category: 'core'  },
  { id: 'red-recon',        name: 'Wear the Hood',               description: 'Complete a mission from the Red Team perspective.',    icon: 'sword',     category: 'red'   },
  { id: 'blue-recon',       name: 'Hold the Line',               description: 'Complete a mission from the Blue Team perspective.',   icon: 'shield',    category: 'blue'  },
  { id: 'flawless',         name: 'Flawless Victory',            description: 'Clear every objective in a single mission.',           icon: 'star',      category: 'elite' },
  { id: 'operator-tier',    name: 'Operator Ready',              description: 'Complete a mission on Operator difficulty.',           icon: 'cog',       category: 'elite' },
  { id: 'dual-perspective', name: 'Both Sides of the Keyboard',  description: 'Play the same scenario as both Red and Blue.',         icon: 'swap',      category: 'elite' },
  { id: 'full-library',     name: 'Full Library',                description: 'Complete all six scenarios at least once.',            icon: 'books',     category: 'core'  },
  { id: 'xp-500',           name: 'Seasoned',                    description: 'Reach 500 XP.',                                        icon: 'silver',    category: 'core'  },
  { id: 'xp-1500',          name: 'Decorated',                   description: 'Reach 1500 XP.',                                       icon: 'gold',      category: 'core'  },
  { id: 'apt-hunter',       name: 'APT Hunter',                  description: 'Complete the correlated multi-stage scenario.',        icon: 'crosshair', category: 'elite' },
  { id: 'op-nightshade',    name: 'Nightshade Veteran',          description: 'Complete Operation Nightshade.',                       icon: 'moon',      category: 'op'    },
  { id: 'op-firestarter',   name: 'Firestarter',                 description: 'Complete Operation Firestarter.',                      icon: 'flame',     category: 'op'    },
  { id: 'op-gridlock',      name: 'Incident Commander',          description: 'Complete Operation Gridlock.',                         icon: 'radio',     category: 'op'    },
  { id: 'daily-driver',     name: 'Daily Driver',                description: 'Complete any Daily Challenge.',                        icon: 'calendar',  category: 'daily' },
  { id: 'streak-3',         name: 'On a Roll',                   description: 'Play missions three days in a row.',                   icon: 'bolt',      category: 'daily' },
  { id: 'streak-7',         name: 'Week Warrior',                description: 'Play missions seven days in a row.',                   icon: 'inferno',   category: 'daily' },
  { id: 'new-best',         name: 'Personal Best',               description: 'Beat a personal best on any scenario.',                 icon: 'trophy',    category: 'elite' },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// ---------- personal bests + streak (Phase 5) ----------

export interface PersonalBest {
  scenarioId: string;
  perspective: 'red' | 'blue';
  xpEarned: number;
  xpMax: number;
  difficulty: 'recruit' | 'analyst' | 'operator';
  objectivesHit: number;
  objectivesTotal: number;
  durationSeconds: number;
  correlationId: string;
  recordedAt: string;
}

export interface StreakState {
  current: number;
  best: number;
  /** Local YYYY-MM-DD of the most recent mission that counted for the streak. */
  lastPlayedDate: string | null;
}

export function personalBestKey(
  scenarioId: string,
  perspective: 'red' | 'blue'
): string {
  return `${scenarioId}:${perspective}`;
}

// ---------- persisted shape ----------

export interface PlayerProgress {
  totalXp: number;
  missions: MissionRecord[];
  achievements: string[];
  /** Phase 5 — best run per (scenarioId, perspective). */
  personalBests: Record<string, PersonalBest>;
  /** Phase 5 — lifetime count of times the player has beaten an existing PB. */
  personalBestBeats: number;
  /** Phase 5 — consecutive-day play streak. */
  streak: StreakState;
  /** Phase 5 — YYYY-MM-DD date keys on which the player cleared a Daily Challenge. */
  dailyCompletions: string[];
}

const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastPlayedDate: null,
};

const EMPTY_PROGRESS: PlayerProgress = {
  totalXp: 0,
  missions: [],
  achievements: [],
  personalBests: {},
  personalBestBeats: 0,
  streak: { ...EMPTY_STREAK },
  dailyCompletions: [],
};

const STORAGE_KEY = 'aegisrange-progress-v1';
const MAX_HISTORY = 50;
/** Keep at most ~1 year of daily-challenge completion keys so the
 *  localStorage payload does not grow unbounded over time. */
const MAX_DAILY_HISTORY = 366;

/**
 * Validate the minimum v1 shape. Phase 5 fields are filled in by
 * migrateLoaded() so older saved data continues to work across the
 * upgrade without forcing a reset.
 */
function isValidProgress(value: unknown): value is {
  totalXp: number;
  missions: MissionRecord[];
  achievements: string[];
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.totalXp === 'number' &&
    Array.isArray(v.missions) &&
    Array.isArray(v.achievements)
  );
}

/**
 * Forward-compat loader: accept any valid v1 shape and augment it
 * with Phase 5 defaults for missing fields. Already-v2 data passes
 * through unchanged.
 */
function migrateLoaded(raw: unknown): PlayerProgress {
  if (!isValidProgress(raw)) return EMPTY_PROGRESS;
  const v = raw as Partial<PlayerProgress> & {
    totalXp: number;
    missions: MissionRecord[];
    achievements: string[];
  };
  const personalBests: Record<string, PersonalBest> =
    v.personalBests && typeof v.personalBests === 'object' && !Array.isArray(v.personalBests)
      ? (v.personalBests as Record<string, PersonalBest>)
      : {};
  const streakCandidate = v.streak as Partial<StreakState> | undefined;
  const streak: StreakState = streakCandidate && typeof streakCandidate === 'object'
    ? {
        current: typeof streakCandidate.current === 'number' ? streakCandidate.current : 0,
        best: typeof streakCandidate.best === 'number' ? streakCandidate.best : 0,
        lastPlayedDate:
          typeof streakCandidate.lastPlayedDate === 'string'
            ? streakCandidate.lastPlayedDate
            : null,
      }
    : { ...EMPTY_STREAK };
  return {
    totalXp: v.totalXp,
    missions: v.missions,
    achievements: v.achievements,
    personalBests,
    personalBestBeats:
      typeof v.personalBestBeats === 'number' ? v.personalBestBeats : 0,
    streak,
    dailyCompletions: Array.isArray(v.dailyCompletions)
      ? v.dailyCompletions
          .filter((d): d is string => typeof d === 'string')
          .slice(-MAX_DAILY_HISTORY)
      : [],
  };
}

function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw);
    return migrateLoaded(parsed);
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

  // Phase 4 — Training Ops completion achievements.
  for (const opId of completedOpIds(missions)) {
    earned.push(opId);
  }

  // Phase 5 — Daily Challenge + PB + streak achievements.
  if (progress.dailyCompletions.length >= 1) earned.push('daily-driver');
  if (progress.streak.best >= 3) earned.push('streak-3');
  if (progress.streak.best >= 7) earned.push('streak-7');
  if (progress.personalBestBeats >= 1) earned.push('new-best');

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
  /** Phase 5 — set when this run matches today's Daily Challenge. */
  isDailyChallenge?: boolean;
}

export interface RecordMissionResult {
  newAchievements: Achievement[];
  newRank: Rank | null;
  /** Phase 5 — true when this run beat a previous PB for (scenario, perspective). */
  newPersonalBest: boolean;
  /** Phase 5 — previous PB xpEarned, or null if there was no prior PB. */
  previousBestXp: number | null;
  /** Phase 5 — new streak value if the streak advanced today, else null. */
  streakReached: number | null;
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

    // --- Phase 5: personal best check ---
    const pbKey = personalBestKey(record.scenarioId, record.perspective);
    const existingPb = prev.personalBests[pbKey];
    const previousBestXp = existingPb ? existingPb.xpEarned : null;
    let nextPersonalBests = prev.personalBests;
    let nextPersonalBestBeats = prev.personalBestBeats;
    let newPersonalBest = false;
    if (!existingPb || record.xpEarned > existingPb.xpEarned) {
      nextPersonalBests = {
        ...prev.personalBests,
        [pbKey]: {
          scenarioId: record.scenarioId,
          perspective: record.perspective,
          xpEarned: record.xpEarned,
          xpMax: record.xpMax,
          difficulty: record.difficulty,
          objectivesHit: record.objectivesHit,
          objectivesTotal: record.objectivesTotal,
          durationSeconds: record.durationSeconds,
          correlationId: record.correlationId,
          recordedAt: record.completedAt,
        },
      };
      if (existingPb) {
        // Only count as a "beat" when there was already a PB to beat —
        // the first-ever run of a (scenario, perspective) doesn't fire
        // the new-best achievement.
        newPersonalBest = true;
        nextPersonalBestBeats += 1;
      }
    }

    // --- Phase 5: streak update (local date) ---
    const todayKey = toLocalDateKey();
    let nextStreak: StreakState = prev.streak;
    let streakReached: number | null = null;
    if (prev.streak.lastPlayedDate === todayKey) {
      // Already played today — streak is unchanged.
    } else if (
      prev.streak.lastPlayedDate &&
      addDaysToKey(prev.streak.lastPlayedDate, 1) === todayKey
    ) {
      // Consecutive day — increment.
      const newCurrent = prev.streak.current + 1;
      nextStreak = {
        current: newCurrent,
        best: Math.max(prev.streak.best, newCurrent),
        lastPlayedDate: todayKey,
      };
      streakReached = newCurrent;
    } else {
      // First play ever, or broken streak — reset to 1.
      nextStreak = {
        current: 1,
        best: Math.max(prev.streak.best, 1),
        lastPlayedDate: todayKey,
      };
      streakReached = 1;
    }

    // --- Phase 5: daily challenge completion ---
    // Append today's key (once per day), then cap to MAX_DAILY_HISTORY
    // so long-running careers don't grow the localStorage payload
    // without bound. Keeping the tail preserves recent-day checks.
    let nextDailyCompletions = prev.dailyCompletions;
    if (input.isDailyChallenge && !prev.dailyCompletions.includes(todayKey)) {
      const appended = [...prev.dailyCompletions, todayKey];
      nextDailyCompletions =
        appended.length > MAX_DAILY_HISTORY
          ? appended.slice(appended.length - MAX_DAILY_HISTORY)
          : appended;
    }

    const interim: PlayerProgress = {
      totalXp: nextTotalXp,
      missions: [record, ...prev.missions].slice(0, MAX_HISTORY),
      achievements: prev.achievements,
      personalBests: nextPersonalBests,
      personalBestBeats: nextPersonalBestBeats,
      streak: nextStreak,
      dailyCompletions: nextDailyCompletions,
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
      newPersonalBest,
      previousBestXp,
      streakReached,
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
