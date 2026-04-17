'use client';

import { useEffect, useState } from 'react';
import type { CoopPair, MissionPerspective } from '@/lib/types';

interface Props {
  open: boolean;
  pair: CoopPair | null;
  currentPerspective: MissionPerspective;
  onClose: () => void;
  onKeepMyRun: (runId: string) => void;
}

/**
 * Post-launch modal for co-op missions. Shows the two linked run ids
 * and builds a shareable URL the partner can open to join from the
 * opposite perspective. The initiator keeps the run matching their
 * currently-selected perspective; the other side is passed to the
 * partner.
 */
export default function CoopLaunchModal({
  open,
  pair,
  currentPerspective,
  onClose,
  onKeepMyRun,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open || !pair) return null;

  const myRun = currentPerspective === 'red' ? pair.red : pair.blue;
  const partnerRun = currentPerspective === 'red' ? pair.blue : pair.red;
  const partnerPerspective: MissionPerspective =
    currentPerspective === 'red' ? 'blue' : 'red';

  const partnerUrl = `${window.location.pathname}?run=${partnerRun.run_id}`;
  const absoluteUrl = `${window.location.origin}${partnerUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  const takeMyRun = () => {
    onKeepMyRun(myRun.run_id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Co-op mission link"
    >
      <div className="w-full max-w-lg mx-4 rounded-2xl border-2 border-cyan-500/40 bg-slate-950 text-slate-100 shadow-2xl">
        <header className="px-6 py-4 border-b border-slate-800">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400">
            Co-op mission ready
          </p>
          <h2 className="mt-1 text-lg font-bold">
            Share this link with your partner
          </h2>
        </header>

        <div className="px-6 py-5 space-y-4 text-sm">
          <p className="text-slate-300">
            You&apos;ll play{' '}
            <strong className="text-cyan-300">{currentPerspective}</strong>.
            Your partner should open the link below to join as{' '}
            <strong className="text-cyan-300">{partnerPerspective}</strong>.
          </p>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 font-mono text-[11px] break-all">
            {absoluteUrl}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-mono uppercase tracking-widest text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 rounded px-3 py-2 transition"
              aria-live="polite"
            >
              {copied ? 'Link Copied!' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={takeMyRun}
              className="text-xs font-mono uppercase tracking-widest text-slate-200 border border-slate-700 hover:border-cyan-400 rounded px-3 py-2 transition"
            >
              Start Playing ({currentPerspective})
            </button>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-[11px] font-mono uppercase tracking-widest text-slate-500 hover:text-slate-300">
              Run ids
            </summary>
            <dl className="mt-2 space-y-1 text-[11px] font-mono text-slate-400">
              <div className="flex gap-3">
                <dt className="w-14 text-slate-500">RED</dt>
                <dd className="truncate">{pair.red.run_id}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-14 text-slate-500">BLUE</dt>
                <dd className="truncate">{pair.blue.run_id}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-14 text-slate-500">CORR</dt>
                <dd className="truncate">{pair.correlation_id}</dd>
              </div>
            </dl>
          </details>
        </div>

        <footer className="flex justify-end px-6 py-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
