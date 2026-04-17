'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aegisrange.tutorialDismissed';

/**
 * First-run CTA nudging new visitors into the tutorial scenario. The
 * banner is persistent-dismissible via localStorage — once someone
 * clicks "Dismiss" or "Start Tutorial" it stays out of their way.
 */
export default function TutorialBanner() {
  // SSR renders with dismissed=true so the banner doesn't flash on
  // first paint; we hydrate from localStorage on mount.
  const [dismissed, setDismissed] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === '1');
    } catch {
      // No localStorage (private mode, iframe, etc.) — show the banner.
      setDismissed(false);
    }
    setReady(true);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* no-op */
    }
  };

  if (!ready || dismissed) return null;

  return (
    <aside
      role="region"
      aria-label="First-run tutorial prompt"
      className="mb-6 rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-transparent p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">
            New to AegisRange?
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-gray-100">
            Take the 60-second tutorial
          </h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-gray-300 max-w-2xl">
            The Mission Console uses a scoped command language — four verbs
            are enough to run your first mission. The tutorial walks you
            through each one in a sandbox with no XP or time pressure.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Link
              href="/scenarios/scn-tutorial-000"
              onClick={dismiss}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 transition"
            >
              Start Tutorial →
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
