// ============================================================
// AegisRange Daily Challenge — Phase 5
//
// Deterministic per-day challenge selection: every player sees the
// same scenario, perspective, and difficulty on any given calendar
// day. Completing the daily challenge applies a bonus multiplier on
// top of the difficulty multiplier and feeds the streak counter in
// player-progress.
//
// The selection is seeded by "days since Unix epoch (UTC)" so it is
// deterministic and does not drift with local time zones. The date
// key used for streaks + dailyCompletions is intentionally LOCAL
// time so a player who plays at 11:59 pm and again at 12:01 am sees
// two different daily keys — classic streak behavior.
// ============================================================

import { SCENARIO_DEFINITIONS } from './types';

export type DailyPerspective = 'red' | 'blue';
export type DailyDifficultyId = 'recruit' | 'analyst' | 'operator';

export interface DailyChallenge {
  /** Local calendar date key in YYYY-MM-DD form — used as the persistence key. */
  dateKey: string;
  scenarioId: string;
  scenarioName: string;
  perspective: DailyPerspective;
  difficulty: DailyDifficultyId;
  /** Multiplier applied on top of the difficulty multiplier for daily-matching runs. */
  bonusMultiplier: number;
  /** Short flavor line for the home card / briefing banner. */
  tagline: string;
}

const DIFFICULTY_ORDER: DailyDifficultyId[] = ['recruit', 'analyst', 'operator'];

const TAGLINES: Record<string, string> = {
  'scn-auth-001':    'Run the night shift. Watch the login curve.',
  'scn-session-002': 'Impossible travel. Very possible stop.',
  'scn-doc-003':     'Nothing to see here. Except the audit trail.',
  'scn-doc-004':     'Download the evidence of the download.',
  'scn-svc-005':     'Robots went weird at lunch. Find out why.',
  'scn-corr-006':    'The SOC is quiet. That is the signal.',
};

/**
 * Convert a Date into the local YYYY-MM-DD string used for streak
 * comparisons and dailyCompletions keys.
 */
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add N days to a YYYY-MM-DD string and return the new YYYY-MM-DD.
 * Used by the streak increment logic to check whether the prior
 * play date is exactly one day before today.
 */
export function addDaysToKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateKey;
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + delta);
  return toLocalDateKey(base);
}

function daysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utc / (1000 * 60 * 60 * 24));
}

/**
 * The canonical daily challenge for the given date. Rotates through:
 *   - scenario:  every day (SCENARIO_DEFINITIONS.length slots)
 *   - perspective: every day (blue on even days, red on odd)
 *   - difficulty: every 3 days (recruit → analyst → operator)
 *
 * Given 6 scenarios × 2 perspectives × 3 difficulties = 36 unique
 * combinations, the daily rotation does not repeat the same
 * (scenario, perspective, difficulty) tuple for 36 days.
 */
export function getDailyChallenge(date: Date = new Date()): DailyChallenge {
  const days = daysSinceEpochUTC(date);
  const total = SCENARIO_DEFINITIONS.length;
  const scenario = SCENARIO_DEFINITIONS[((days % total) + total) % total];
  const perspective: DailyPerspective = days % 2 === 0 ? 'blue' : 'red';
  const diffIdx = Math.floor(days / 3) % DIFFICULTY_ORDER.length;
  const difficulty = DIFFICULTY_ORDER[((diffIdx % DIFFICULTY_ORDER.length) + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length];
  return {
    dateKey: toLocalDateKey(date),
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    perspective,
    difficulty,
    bonusMultiplier: 1.5,
    tagline: TAGLINES[scenario.id] ?? scenario.description,
  };
}

/**
 * True when the given (scenarioId, perspective, difficulty) triple
 * matches the daily challenge for the provided date (default: now).
 */
export function isDailyChallengeMatch(
  scenarioId: string,
  perspective: DailyPerspective,
  difficulty: DailyDifficultyId,
  date: Date = new Date()
): boolean {
  const daily = getDailyChallenge(date);
  return (
    daily.scenarioId === scenarioId &&
    daily.perspective === perspective &&
    daily.difficulty === difficulty
  );
}
