'use client';

import type { TimelineBeat } from '../hooks/useMissionStream';

interface Props {
  beats: TimelineBeat[];
  totalBeats: number | null;
  phase:
    | 'idle'
    | 'connecting'
    | 'running'
    | 'complete'
    | 'failed'
    | 'aborted';
}

const KIND_STYLES: Record<string, string> = {
  failed_login: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  successful_login: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  session_token_issued: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  session_reuse: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  document_read: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  document_download: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10',
  authorization_failure: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
};

const DEFAULT_KIND_STYLE =
  'text-slate-300 border-slate-500/40 bg-slate-500/10 dark:text-gray-300';

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return ts;
  }
}

export default function MissionTimeline({ beats, totalBeats, phase }: Props) {
  const progressPct =
    totalBeats != null && totalBeats > 0
      ? Math.round((beats.length / totalBeats) * 100)
      : 0;

  return (
    <section className="mt-6 rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500">
            Live Telemetry
          </p>
          <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
            Adversary Activity
          </h2>
        </div>
        {totalBeats != null && (
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-gray-500">
              {beats.length} / {totalBeats} beats
            </p>
            <div className="mt-1 h-1.5 w-32 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {beats.length === 0 && phase !== 'idle' ? (
        <p className="text-sm text-slate-500 dark:text-gray-500 italic">
          {phase === 'connecting'
            ? 'Connecting to mission stream...'
            : 'Waiting for adversary to act...'}
        </p>
      ) : beats.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-gray-500 italic">
          Launch the mission to start generating telemetry.
        </p>
      ) : (
        <ol className="space-y-2">
          {beats.map((beat) => {
            const style = KIND_STYLES[beat.kind] ?? DEFAULT_KIND_STYLE;
            return (
              <li
                key={beat.index}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-xs ${style}`}
              >
                <span className="font-mono text-[10px] tabular-nums opacity-70 shrink-0 mt-[2px]">
                  {formatTime(beat.ts)}
                </span>
                <span className="font-mono uppercase tracking-wider text-[10px] opacity-80 shrink-0 mt-[2px]">
                  {beat.kind.replace(/_/g, ' ')}
                </span>
                <span className="flex-1 text-slate-800 dark:text-gray-200">
                  {beat.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
