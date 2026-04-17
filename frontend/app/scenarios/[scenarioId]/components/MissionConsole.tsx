'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { submitMissionCommand, ApiError } from '@/lib/api';
import type { MissionCommandResponse, MissionDifficulty, MissionPerspective } from '@/lib/types';

interface Props {
  runId: string | null;
  difficulty: MissionDifficulty;
  perspective: MissionPerspective;
  disabled?: boolean;
  onCommandApplied?: (response: MissionCommandResponse) => void;
  onOpenOpsManual?: () => void;
}

// Phase 5: Recruit gets a visible command palette + 45s inactivity
// nudge. Analyst gets no palette but a 90s nudge. Operator is silent.
const INACTIVITY_MS_BY_DIFFICULTY: Record<MissionDifficulty, number | null> = {
  recruit: 45_000,
  analyst: 90_000,
  operator: null,
};

const PALETTE_BY_PERSPECTIVE: Record<MissionPerspective, string[]> = {
  blue: [
    'alerts list',
    'alerts show <alert_id>',
    'events tail',
    'correlate',
    'contain session --user <id> --action revoke',
    'contain document --id <doc_id> --action quarantine',
    'contain service --id <svc_id> --action disable',
    'help',
    'hint',
    'status',
  ],
  red: [
    'recon users',
    'attempt login --user <id> --from <ip>',
    'attempt login --user <id> --from <ip> --password <pw>',
    'session reuse --from <ip>',
    'doc read --id <doc_id>',
    'doc read --id <doc_id> --burst <n>',
    'doc download --id <doc_id>',
    'svc call --service <svc_id> --op <route>',
    'help',
    'hint',
    'status',
  ],
};

type TranscriptLine =
  | { kind: 'prompt'; text: string }
  | { kind: 'ok'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'system'; text: string };

const PROMPT = 'ops>';

/**
 * Interactive terminal for the mission console.
 *
 * - Submits raw commands to ``POST /missions/{run_id}/commands``.
 * - Maintains a local transcript (prompt lines + response lines).
 * - Supports history recall via ArrowUp / ArrowDown.
 * - ``?`` or F1 escapes to :prop:`onOpenOpsManual` for the full manual.
 */
export default function MissionConsole({
  runId,
  difficulty,
  perspective,
  disabled,
  onCommandApplied,
  onOpenOpsManual,
}: Props) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([
    {
      kind: 'system',
      text:
        'Mission console ready. Type `help` for verbs, `hint` for the next step, or press F1 for the full Ops Manual.',
    },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);

  const showPalette = difficulty === 'recruit';
  const palette = PALETTE_BY_PERSPECTIVE[perspective];

  useEffect(() => {
    // Autoscroll to the bottom on new transcript lines.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Reset inactivity nudge when the console is (re)armed. The timer
  // starts on first transcript render and restarts after every player
  // action via resetInactivityTimer().
  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, runId]);

  function resetInactivityTimer() {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    setNudgeVisible(false);
    const ms = INACTIVITY_MS_BY_DIFFICULTY[difficulty];
    if (ms === null || nudgeDismissed || disabled || !runId) return;
    inactivityTimerRef.current = window.setTimeout(() => {
      setNudgeVisible(true);
    }, ms);
  }

  const appendLines = (lines: TranscriptLine[]) =>
    setTranscript((prev) => [...prev, ...lines]);

  const submit = async () => {
    const raw = input.trim();
    if (!raw || !runId || disabled) return;

    appendLines([{ kind: 'prompt', text: `${PROMPT} ${raw}` }]);
    setInput('');
    setHistory((prev) => [...prev, raw]);
    setHistoryIndex(null);
    setSubmitting(true);
    resetInactivityTimer();

    try {
      const response = await submitMissionCommand(runId, raw);
      const lineKind: TranscriptLine['kind'] =
        response.kind === 'ok' ? 'ok' : 'error';
      appendLines(response.lines.map((text) => ({ kind: lineKind, text })));
      onCommandApplied?.(response);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail ?? err.message
          : err instanceof Error
            ? err.message
            : 'Command failed for an unknown reason.';
      appendLines([{ kind: 'error', text: message }]);
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'F1' || e.key === '?' || e.key === '/') {
      // ? and / are common "help" bindings in game consoles and
      // mirror the OpsManual overlay. F1 is the canonical one.
      if (e.key === 'F1' || !input) {
        e.preventDefault();
        onOpenOpsManual?.();
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next =
        historyIndex === null
          ? history.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(null);
        setInput('');
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
      return;
    }
  };

  return (
    <section
      className="mt-6 rounded-2xl border-2 border-slate-800 dark:border-cyan-500/30 bg-black/90 text-slate-200 font-mono shadow-inner overflow-hidden"
      aria-label="Mission console"
    >
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Mission Console
          <span className="text-[9px] tracking-[0.2em] text-slate-500 ml-2">
            {difficulty.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showPalette && (
            <button
              type="button"
              onClick={() => setPaletteOpen((p) => !p)}
              className="text-[10px] font-mono uppercase tracking-widest text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded px-2 py-1 transition"
              aria-expanded={paletteOpen}
            >
              {paletteOpen ? 'Hide Palette' : 'Palette'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenOpsManual?.()}
            className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 rounded px-2 py-1 transition"
          >
            Help (F1)
          </button>
        </div>
      </header>

      {showPalette && paletteOpen && (
        <div className="border-b border-slate-800 bg-slate-900/70 px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            Command Palette — Recruit training only
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
            {palette.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setInput(example);
                    inputRef.current?.focus();
                  }}
                  className="text-left w-full text-slate-300 hover:text-cyan-300 transition"
                >
                  <code>{example}</code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nudgeVisible && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-200">
          <span>
            Stuck? Type <code className="text-amber-100">hint</code> in the
            console, or press <kbd className="font-mono">F1</kbd> for the full
            Ops Manual.
          </span>
          <button
            type="button"
            onClick={() => {
              setNudgeVisible(false);
              setNudgeDismissed(true);
            }}
            className="text-[10px] font-mono uppercase tracking-widest text-amber-300 hover:text-amber-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="max-h-[340px] min-h-[180px] overflow-y-auto px-4 py-3 text-[12.5px] leading-[1.55]"
        onClick={() => inputRef.current?.focus()}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Mission console transcript"
      >
        {transcript.map((line, i) => (
          <div
            key={i}
            className={
              line.kind === 'error'
                ? 'text-rose-300 whitespace-pre-wrap'
                : line.kind === 'prompt'
                  ? 'text-cyan-300 whitespace-pre-wrap'
                  : line.kind === 'system'
                    ? 'text-slate-500 italic whitespace-pre-wrap'
                    : 'text-slate-200 whitespace-pre-wrap'
            }
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/80 px-4 py-2">
        <span className="text-cyan-400 select-none">{PROMPT}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled || submitting || !runId}
          placeholder={
            !runId
              ? 'Launch the mission to activate the console…'
              : 'Type a command, then Enter. Try `help` or `hint`.'
          }
          className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
          aria-label="Mission console input"
        />
      </div>
    </section>
  );
}
