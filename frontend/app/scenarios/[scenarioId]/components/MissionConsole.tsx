'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { submitMissionCommand, ApiError } from '@/lib/api';
import type { MissionCommandResponse } from '@/lib/types';

interface Props {
  runId: string | null;
  disabled?: boolean;
  onCommandApplied?: (response: MissionCommandResponse) => void;
  onOpenOpsManual?: () => void;
}

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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Autoscroll to the bottom on new transcript lines.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

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
        </div>
        <button
          type="button"
          onClick={() => onOpenOpsManual?.()}
          className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 rounded px-2 py-1 transition"
        >
          Help (F1)
        </button>
      </header>

      <div
        ref={scrollRef}
        className="max-h-[340px] min-h-[180px] overflow-y-auto px-4 py-3 text-[12.5px] leading-[1.55]"
        onClick={() => inputRef.current?.focus()}
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
