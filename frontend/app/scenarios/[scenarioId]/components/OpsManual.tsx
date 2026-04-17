'use client';

import { useEffect, useRef, useState } from 'react';
import { getMissionHelp } from '@/lib/api';
import type { MissionHelp, MissionPerspective } from '@/lib/types';

interface Props {
  runId: string | null;
  perspective: MissionPerspective;
  open: boolean;
  onClose: () => void;
}

type Tab = 'quickstart' | 'verbs' | 'stuck';

const BLUE_QUICKSTART: string[] = [
  'You are the DEFENDER (Blue). Your job is to detect what the',
  'adversary is doing, correlate it into an incident, and contain the',
  'account before damage lands.',
  '',
  'The Mission Console on the right runs commands that query the',
  "simulated SIEM and push containment actions. Every line you type is",
  "recorded in the run transcript alongside the adversary's own beats.",
  '',
  'The 60-second playbook (scn-auth-001 Blue):',
  '  1. `alerts list`        — see what the SIEM has caught so far.',
  '  2. `alerts show <id>`    — drill into a suspicious one.',
  '  3. `correlate`           — confirm alerts belong to one incident.',
  '  4. `contain session --user user-alice --action revoke`',
  '                            — kick the attacker out. Mission complete.',
  '',
  'If you get stuck at any point, type `hint` in the console or switch',
  'to the Stuck? tab above. Recruit difficulty: free hints. Analyst:',
  '-10 XP. Operator: -25 XP.',
];

const RED_QUICKSTART: string[] = [
  'You are the INTRUDER (Red). Your job is to land a credential, force',
  'the defender into a containment response, and leave enough trace to',
  'make that defender earn their keep.',
  '',
  'The Mission Console runs attack verbs. Unlike the Blue side, no',
  "adversary script is playing — your commands ARE the adversary.",
  'Each `attempt login` you type produces an authentication event that',
  'the defender pipeline sees immediately.',
  '',
  'The 60-second playbook (scn-auth-001 Red):',
  '  1. `recon users`                          — list targetable accounts.',
  '  2. `attempt login --user alice --from 203.0.113.10`',
  '                                            — seed a 401 (no password).',
  '                                              Repeat ~5× to trip the',
  '                                              brute-force detector.',
  '  3. `attempt login --user alice --from 203.0.113.10 \\',
  '        --password Correct_Horse_42!`       — land the success. The',
  '                                              defender pipeline will',
  '                                              auto-respond; that flips',
  '                                              "Force a defensive',
  '                                              response" to done.',
  '',
  'Use `hint` for the next step or F1 to re-open this manual any time.',
];

const STUCK_PROMPT: string[] = [
  'Not sure what to do next?',
  '',
  "• Type `hint` in the Mission Console — it inspects what you've already",
  '  typed and returns the next recommended action.',
  '',
  "• Type `help` for the full verb list, or `help <verb>` for one verb's",
  '  flags and description.',
  '',
  '• Type `status` to check mission progress, alerts seen, and whether',
  '  an incident has been opened yet.',
  '',
  '• Waiting on the adversary? Blue missions pace events over the',
  "  difficulty's time budget; Red missions are silent until YOU type",
  '  something. Either way, `hint` is always safe.',
];

/**
 * Full-screen Ops Manual overlay. Triggered by F1 / ? / the Help button.
 *
 * Keeps three tabs:
 *   - Quickstart — 60-second walkthrough.
 *   - Verbs     — browsable command reference, fetched from the
 *                 backend so content changes with the grammar without
 *                 front-end redeploys.
 *   - Stuck?    — static "what to try" banner plus a link to run
 *                 `hint` in the console.
 */
export default function OpsManual({ runId, perspective, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('quickstart');
  const [help, setHelp] = useState<MissionHelp | null>(null);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Fetch help content on open (and when the run changes).
  useEffect(() => {
    if (!open || !runId) return;
    setLoadingHelp(true);
    getMissionHelp(runId)
      .then((h) => setHelp(h))
      .catch(() => setHelp(null))
      .finally(() => setLoadingHelp(false));
  }, [open, runId]);

  // Escape closes the overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus the close button when opening so screen readers anchor.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ops Manual"
    >
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-slate-950 text-slate-100 shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400">
              Ops Manual
            </p>
            <h2 className="text-lg font-bold text-slate-100">
              How to run this mission
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Esc to close
            </span>
            <button
              ref={closeRef}
              onClick={onClose}
              className="text-xs font-mono uppercase tracking-widest text-slate-300 hover:text-white border border-slate-700 hover:border-cyan-400 rounded px-3 py-1 transition"
            >
              Close
            </button>
          </div>
        </header>

        <nav className="flex border-b border-slate-800 bg-slate-900/60">
          {(
            [
              { id: 'quickstart', label: 'Quickstart' },
              { id: 'verbs', label: 'Command Reference' },
              { id: 'stuck', label: 'Stuck?' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-xs font-mono uppercase tracking-[0.15em] transition ${
                tab === t.id
                  ? 'text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed font-mono">
          {tab === 'quickstart' && (
            <pre className="whitespace-pre-wrap text-slate-300 font-mono">
              {(perspective === 'red' ? RED_QUICKSTART : BLUE_QUICKSTART).join('\n')}
            </pre>
          )}

          {tab === 'stuck' && (
            <pre className="whitespace-pre-wrap text-slate-300 font-mono">
              {STUCK_PROMPT.join('\n')}
            </pre>
          )}

          {tab === 'verbs' && (
            <div className="space-y-6">
              {!runId ? (
                <p className="text-slate-400">
                  Launch a mission to load the command reference.
                </p>
              ) : loadingHelp ? (
                <p className="text-slate-400">Loading verb reference…</p>
              ) : help ? (
                <>
                  <section>
                    <h3 className="text-cyan-300 text-xs font-mono uppercase tracking-[0.18em] mb-2">
                      Overview
                    </h3>
                    <pre className="whitespace-pre-wrap text-slate-300 font-mono">
                      {help.overview.join('\n')}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-cyan-300 text-xs font-mono uppercase tracking-[0.18em] mb-2">
                      Verbs
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(help.verb_help).map(([verb, lines]) => (
                        <article
                          key={verb}
                          className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
                        >
                          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-1">
                            {verb}
                          </p>
                          <pre className="whitespace-pre-wrap text-slate-300 font-mono">
                            {lines.join('\n')}
                          </pre>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <p className="text-slate-400">
                  Could not load verb reference. Type `help` in the console
                  as a fallback.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
