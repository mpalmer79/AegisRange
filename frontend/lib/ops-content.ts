// ============================================================
// AegisRange Training Ops — Phase 4
//
// Curated sequences of scenarios with a narrative arc. Each Op is
// a small campaign (2-4 missions) played in order, meant to give
// structure to the gamified briefing flow introduced in Phase 2.
//
// Op progress is derived purely from the PlayerProgress mission
// history (see lib/player-progress.tsx) — no additional persisted
// state. A mission is considered "cleared" for op purposes when the
// player has completed it at least once from the recommended
// perspective. Op completion unlocks a dedicated achievement.
// ============================================================

import type { MissionRecord } from './player-progress';

export type OpAccent =
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'sky'
  | 'fuchsia';

export type OpDifficulty = 'recruit' | 'analyst' | 'operator';

export interface OpMission {
  scenarioId: string;
  /** Narrative role of this mission within the op. */
  title: string;
  perspective: 'red' | 'blue';
  /** Short story beat shown on the op detail page. */
  briefing: string;
}

export interface TrainingOp {
  id: string;
  name: string;
  codename: string;
  tagline: string;
  /** 2-4 sentence story arc for the op hero card. */
  story: string;
  accent: OpAccent;
  difficulty: OpDifficulty;
  missions: OpMission[];
  /** Achievement id granted on full completion. */
  achievementId: string;
}

export const TRAINING_OPS: TrainingOp[] = [
  {
    id: 'op-nightshade',
    name: 'Operation Nightshade',
    codename: 'NIGHTSHADE',
    tagline: 'Defend the night shift against a deliberate infiltrator.',
    story:
      'Between 22:00 and 04:00 a persistent actor is testing every soft edge of your environment. Your job as the night shift defender is to notice the first tremor, correlate it across surfaces, and shut the actor down before sunrise.',
    accent: 'sky',
    difficulty: 'recruit',
    missions: [
      {
        scenarioId: 'scn-auth-001',
        title: 'The Door at Midnight',
        perspective: 'blue',
        briefing:
          'A credential spray wakes your alerting rules. First contact — prove it is real and open a tracked incident.',
      },
      {
        scenarioId: 'scn-session-002',
        title: 'Session in the Fog',
        perspective: 'blue',
        briefing:
          'The actor has a session token now. Spot the impossible-travel anomaly and revoke the token before it spreads.',
      },
      {
        scenarioId: 'scn-doc-003',
        title: 'Closed Stacks',
        perspective: 'blue',
        briefing:
          'Board-level M&A folders are being probed. Clip the actor\u2019s wings with a download restriction.',
      },
    ],
    achievementId: 'op-nightshade',
  },
  {
    id: 'op-firestarter',
    name: 'Operation Firestarter',
    codename: 'FIRESTARTER',
    tagline: 'Wear the hood. Chain the exploit. Exit clean.',
    story:
      'You are the outside keyboard for a week. Build a foothold through credential abuse, expand inside with a stolen session, and exfiltrate a sensitive archive before the SOC wakes up. Every mission matters — the detectors sharpen each round.',
    accent: 'rose',
    difficulty: 'analyst',
    missions: [
      {
        scenarioId: 'scn-auth-001',
        title: 'Kick the Door',
        perspective: 'red',
        briefing:
          'Find a working credential before the brute-force rules alarm. Every failed attempt narrows your window.',
      },
      {
        scenarioId: 'scn-session-002',
        title: 'Borrow a Heartbeat',
        perspective: 'red',
        briefing:
          'Replay the stolen session as if you were the user. Blend in with the victim identity long enough to pivot.',
      },
      {
        scenarioId: 'scn-doc-004',
        title: 'Run with the Loot',
        perspective: 'red',
        briefing:
          'Pull the archive before the vault locks. The DLP signature will fire — can you outrun containment?',
      },
    ],
    achievementId: 'op-firestarter',
  },
  {
    id: 'op-gridlock',
    name: 'Operation Gridlock',
    codename: 'GRIDLOCK',
    tagline: 'Full-spectrum response to a multi-vector APT.',
    story:
      'Weak signals across service accounts, document stores, and authentication start correlating. One actor. One campaign. You are the incident commander — stitch the signals, name the threat, and shut it down across every surface it touches.',
    accent: 'fuchsia',
    difficulty: 'operator',
    missions: [
      {
        scenarioId: 'scn-svc-005',
        title: 'Robot Gone Rogue',
        perspective: 'blue',
        briefing:
          'A nightly build service account is calling admin APIs at noon. Find out why, and disable it before it changes policy.',
      },
      {
        scenarioId: 'scn-doc-003',
        title: 'Quiet Reader',
        perspective: 'blue',
        briefing:
          'The same actor profile is probing restricted docs. Correlate the two threads into a single campaign.',
      },
      {
        scenarioId: 'scn-corr-006',
        title: 'Full Spectrum',
        perspective: 'blue',
        briefing:
          'All three surfaces are lit up at once. Commander, the room is yours — execute containment across auth, session and data.',
      },
    ],
    achievementId: 'op-gridlock',
  },
];

// ---------- lookup helpers ----------

export function getOpById(id: string): TrainingOp | undefined {
  return TRAINING_OPS.find((op) => op.id === id);
}

/** Ops that include the given scenario in their mission chain. */
export function getOpsContainingScenario(scenarioId: string): TrainingOp[] {
  return TRAINING_OPS.filter((op) =>
    op.missions.some((m) => m.scenarioId === scenarioId)
  );
}

// ---------- progress derivation ----------

export interface OpMissionProgress {
  mission: OpMission;
  index: number;
  cleared: boolean;
  lastRun: MissionRecord | null;
}

export interface OpProgress {
  op: TrainingOp;
  missions: OpMissionProgress[];
  completedCount: number;
  totalCount: number;
  /** Index of the next incomplete mission (totalCount if fully complete). */
  currentIndex: number;
  percentage: number;
  isComplete: boolean;
}

/**
 * Match a mission to the player's history. A mission is cleared when
 * the player has at least one completed record for that scenario at
 * the recommended perspective. We return the most recent matching
 * record so the op page can surface a timestamp and XP number.
 */
function findMatchingRun(
  mission: OpMission,
  history: MissionRecord[]
): MissionRecord | null {
  let best: MissionRecord | null = null;
  for (const record of history) {
    if (
      record.scenarioId === mission.scenarioId &&
      record.perspective === mission.perspective
    ) {
      if (!best || record.completedAt > best.completedAt) {
        best = record;
      }
    }
  }
  return best;
}

export function computeOpProgress(
  op: TrainingOp,
  history: MissionRecord[]
): OpProgress {
  const missions: OpMissionProgress[] = op.missions.map((m, index) => {
    const lastRun = findMatchingRun(m, history);
    return {
      mission: m,
      index,
      cleared: lastRun != null,
      lastRun,
    };
  });
  const completedCount = missions.filter((m) => m.cleared).length;
  const totalCount = missions.length;
  const firstIncomplete = missions.findIndex((m) => !m.cleared);
  const currentIndex = firstIncomplete === -1 ? totalCount : firstIncomplete;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return {
    op,
    missions,
    completedCount,
    totalCount,
    currentIndex,
    percentage,
    isComplete: completedCount === totalCount,
  };
}

export function computeAllOpProgress(history: MissionRecord[]): OpProgress[] {
  return TRAINING_OPS.map((op) => computeOpProgress(op, history));
}

/** IDs of ops fully completed in the given history (for achievement checks). */
export function completedOpIds(history: MissionRecord[]): string[] {
  return TRAINING_OPS.filter((op) =>
    computeOpProgress(op, history).isComplete
  ).map((op) => op.id);
}
