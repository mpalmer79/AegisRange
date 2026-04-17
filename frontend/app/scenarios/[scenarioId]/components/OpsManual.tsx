'use client';

import { useEffect, useRef, useState } from 'react';
import { getMissionHelp } from '@/lib/api';
import type { MissionHelp, MissionPerspective } from '@/lib/types';

interface Props {
  runId: string | null;
  scenarioId: string;
  perspective: MissionPerspective;
  open: boolean;
  onClose: () => void;
}

type Tab = 'quickstart' | 'verbs' | 'stuck';

const BLUE_INTRO = [
  'You are the DEFENDER (Blue). Your job is to detect what the',
  'adversary is doing, correlate it into an incident, and contain the',
  'account/service/document before damage lands.',
  '',
  'The Mission Console on the right runs SIEM queries and containment',
  "verbs. Every line you type is recorded in the run transcript",
  "alongside the adversary's own beats.",
  '',
];

const RED_INTRO = [
  'You are the INTRUDER (Red). No adversary script is playing — your',
  'commands ARE the adversary. Each verb you type emits an event that',
  'the defender pipeline sees immediately.',
  '',
];

const UNIVERSAL_OUTRO = [
  '',
  'If you get stuck, type `hint` in the console or switch to the Stuck?',
  'tab. Recruit: free hints. Analyst: −10 XP. Operator: −25 XP.',
  'F1 (or the Help button) re-opens this manual any time.',
];

/** Scenario-specific playbooks. First line is the intro, then the
 *  numbered steps. Keys are `${scenarioId}:${perspective}`. */
const SCENARIO_PLAYBOOKS: Record<string, string[]> = {
  'scn-auth-001:blue': [
    'The 60-second playbook (scn-auth-001 Blue):',
    '  1. `alerts list`                 — what the SIEM caught so far.',
    '  2. `alerts show <id>`            — confirm the brute-force pattern.',
    '  3. `correlate`                   — accept the correlated incident.',
    '  4. `contain session --user user-alice --action revoke`',
    '                                    — kick the attacker out. Done.',
  ],
  'scn-auth-001:red': [
    'The 60-second playbook (scn-auth-001 Red):',
    '  1. `recon users`                                — list targets.',
    '  2. `attempt login --user alice --from 203.0.113.10` (repeat ~5×).',
    '  3. `attempt login --user alice --from 203.0.113.10 \\',
    '        --password Correct_Horse_42!`            — land success.',
  ],
  'scn-session-002:blue': [
    'The 60-second playbook (scn-session-002 Blue):',
    '  1. `alerts list`                 — DET-SESSION-003 should light up.',
    '  2. `events tail --user user-bob` — two auth checks, different IPs.',
    '  3. `contain session --user user-bob --action revoke`.',
  ],
  'scn-session-002:red': [
    'The 60-second playbook (scn-session-002 Red):',
    '  1. `attempt login --user bob --from 198.51.100.10 \\',
    '        --password Hunter2_Strong_99!`           — mint a session.',
    '  2. `session reuse --from 203.0.113.55`         — replay elsewhere.',
  ],
  'scn-doc-003:blue': [
    'The 60-second playbook (scn-doc-003 Blue):',
    '  1. `alerts list`                                — DET-DOC-005 fires.',
    '  2. `events tail --user user-bob --last 10`      — confirm bulk reads.',
    '  3. `contain document --id doc-002 --action restrict --actor user-bob`',
    '      OR `contain session --user user-bob --action revoke`.',
  ],
  'scn-doc-003:red': [
    'The 60-second playbook (scn-doc-003 Red):',
    '  1. `attempt login --user bob --from 198.51.100.10 \\',
    '        --password Hunter2_Strong_99!`           — get a session.',
    '  2. `doc read --id doc-002 --burst 20`          — trip bulk detector.',
  ],
  'scn-doc-004:blue': [
    'The 60-second playbook (scn-doc-004 Blue):',
    '  1. `alerts list`                                — DET-DOC-006 fires.',
    '  2. `contain document --id doc-002 --action quarantine` AND/OR',
    '     `contain session --user user-bob --action revoke`.',
  ],
  'scn-doc-004:red': [
    'The 60-second playbook (scn-doc-004 Red):',
    '  1. `attempt login --user bob --from 198.51.100.10 \\',
    '        --password Hunter2_Strong_99!`.',
    '  2. `doc read --id doc-001` / `--id doc-002` / `--id doc-003`.',
    '  3. `doc download --id doc-001` / `--id doc-002` / `--id doc-003`.',
  ],
  'scn-svc-005:blue': [
    'The 60-second playbook (scn-svc-005 Blue):',
    '  1. `alerts list`                                — DET-SVC-007 fires.',
    '  2. `contain service --id svc-data-processor --action disable`.',
  ],
  'scn-svc-005:red': [
    'The 60-second playbook (scn-svc-005 Red):',
    '  `svc call --service svc-data-processor --op <route>` for each of:',
    '  `/admin/config`, `/admin/secrets`, `/admin/users`, `/admin/audit`.',
  ],
  'scn-corr-006:blue': [
    'The 60-second playbook (scn-corr-006 Blue):',
    '  1. `alerts list`                  — multiple rules fire (auth + doc).',
    '  2. `correlate`                    — tie the chain together.',
    '  3. Any `contain ...` verb satisfies the full-containment objective.',
  ],
  'scn-corr-006:red': [
    'The 60-second playbook (scn-corr-006 Red):',
    '  1. Credential spray: `attempt login --user alice ...` (5× + success).',
    '  2. `doc read --id doc-001 --burst 10` / `doc read --id doc-002 --burst 10`.',
    '  3. `doc download --id doc-001` and friends — trip the exfil detector.',
  ],
};

function quickstartFor(
  scenarioId: string,
  perspective: MissionPerspective,
): string[] {
  const intro = perspective === 'red' ? RED_INTRO : BLUE_INTRO;
  const play = SCENARIO_PLAYBOOKS[`${scenarioId}:${perspective}`] ?? [
    `No Quickstart yet for ${scenarioId} ${perspective}. Type \`hint\` in the`,
    'console for a contextual next step, or `help` for the verb list.',
  ];
  return [...intro, ...play, ...UNIVERSAL_OUTRO];
}

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
export default function OpsManual({
  runId,
  scenarioId,
  perspective,
  open,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('quickstart');
  const [help, setHelp] = useState<MissionHelp | null>(null);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  // Capture the caller's focus on open so we can restore it on close;
  // focus the close button inside the overlay so screen readers anchor.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
      closeRef.current?.focus();
    } else if (previousFocusRef.current) {
      // Closing: restore focus to the trigger element (e.g. the "Help"
      // button in the console header) so keyboard users don't end up
      // at <body>.
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
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
              {quickstartFor(scenarioId, perspective).join('\n')}
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
