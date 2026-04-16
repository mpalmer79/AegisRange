import Link from 'next/link';
import type { ScenarioResult } from '@/lib/types';
import type { Achievement, Rank } from '@/lib/player-progress';
import type { Accent } from './accents';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface LaunchPanelProps {
  status: 'idle' | 'running' | 'complete' | 'error';
  result: ScenarioResult | null;
  errorMsg: string | null;
  errorDetail: string | null;
  accent: Accent;
  allComplete: boolean;
  perspectiveRole: string;
  elapsedSec: number;
  completedCount: number;
  totalObjectives: number;
  earnedXp: number;
  maxXp: number;
  isDailyMatch: boolean;
  dailyBonus: number;
  previousBestXp: number | null;
  newPersonalBest: boolean;
  streakReached: number | null;
  rankUp: Rank | null;
  newAchievements: Achievement[];
  onLaunch: () => void;
  onReset: () => void;
}

export default function LaunchPanel({
  status,
  result,
  errorMsg,
  errorDetail,
  accent,
  allComplete,
  perspectiveRole,
  elapsedSec,
  completedCount,
  totalObjectives,
  earnedXp,
  maxXp,
  isDailyMatch,
  dailyBonus,
  previousBestXp,
  newPersonalBest,
  streakReached,
  rankUp,
  newAchievements,
  onLaunch,
  onReset,
}: LaunchPanelProps) {
  return (
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
            onClick={onLaunch}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm tracking-wider uppercase text-white transition-all bg-gradient-to-r ${accent.title} shadow-lg ${accent.glow} hover:brightness-110 ar-pulse-ring`}
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
              ? `All ${perspectiveRole} objectives met in ${formatElapsed(elapsedSec)}.`
              : `${completedCount} of ${totalObjectives} objectives met. Review the debrief below.`}
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
              <div aria-hidden className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-fuchsia-200/50 dark:bg-fuchsia-500/10 blur-2xl ar-drift" />
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
              onClick={onReset}
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
            {errorMsg ?? 'The backend rejected the scenario run. Check that the API is reachable.'}
          </p>
          <p className="text-xs font-mono text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded p-2 mb-4 break-words">
            {errorDetail ?? errorMsg ?? 'Unknown error'}
          </p>
          <button
            onClick={onReset}
            className="w-full px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
          >
            Reset
          </button>
        </>
      )}
    </div>
  );
}
