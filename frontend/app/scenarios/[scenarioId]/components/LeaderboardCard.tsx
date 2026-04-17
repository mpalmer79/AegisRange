'use client';

import { useEffect, useState } from 'react';
import { getMissionLeaderboard, type LeaderboardEntry } from '@/lib/api';
import type { MissionDifficulty, MissionPerspective } from '@/lib/types';

interface Props {
  scenarioId: string;
  perspective: MissionPerspective;
  difficulty: MissionDifficulty;
  /** Nonce that causes the card to refetch when it changes (e.g. the
   *  page can bump it after a mission completes). */
  refetchToken?: unknown;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Top-10 scores for this (scenario, perspective, difficulty) cell.
 * Shown on the scenario detail page; refetches when a mission
 * completes via the refetchToken prop.
 */
export default function LeaderboardCard({
  scenarioId,
  perspective,
  difficulty,
  refetchToken,
}: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    getMissionLeaderboard({
      scenario_id: scenarioId,
      perspective,
      difficulty,
      limit: 10,
    })
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setErr('Leaderboard unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, perspective, difficulty, refetchToken]);

  return (
    <section
      className="mt-6 rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5"
      aria-label="Scenario leaderboard"
    >
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Top 10 — {perspective} / {difficulty}
          </p>
          <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
            Leaderboard
          </h2>
        </div>
      </header>

      {err && (
        <p className="text-xs text-rose-600 dark:text-rose-300">{err}</p>
      )}

      {!err && entries === null && (
        <p className="text-xs text-slate-500 italic">Loading leaderboard…</p>
      )}

      {!err && entries != null && entries.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No scores yet. Be the first to complete this mission.
        </p>
      )}

      {!err && entries != null && entries.length > 0 && (
        <ol className="space-y-1 text-xs font-mono">
          {entries.map((entry, i) => (
            <li
              key={entry.run_id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-gray-700 transition"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className={
                    i === 0
                      ? 'text-amber-600 dark:text-amber-300 font-bold'
                      : i === 1
                        ? 'text-slate-500 dark:text-gray-400'
                        : i === 2
                          ? 'text-orange-500 dark:text-orange-400'
                          : 'text-slate-400 dark:text-gray-500'
                  }
                >
                  #{i + 1}
                </span>
                <span className="truncate text-slate-600 dark:text-gray-400">
                  {entry.operated_by ?? 'anonymous'}
                </span>
              </span>
              <span className="flex items-center gap-4 shrink-0">
                <span className="text-cyan-700 dark:text-cyan-300">
                  +{entry.score} XP
                </span>
                <span className="text-slate-500 dark:text-gray-500 tabular-nums">
                  {formatDuration(entry.duration_seconds)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
