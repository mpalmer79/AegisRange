'use client';

import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { SCENARIO_DEFINITIONS } from '@/lib/types';

/**
 * Scenario drill-down page (Phase 1 stub).
 *
 * Phase 1 delivers the route + navigation contract so the home page cards
 * have somewhere to land. Phase 2 replaces this stub with the full gamified
 * briefing shell (level selection, objectives, red/blue perspectives, etc).
 */
export default function ScenarioDetailPage() {
  const params = useParams<{ scenarioId: string }>();
  const scenarioId = params?.scenarioId;
  const scenario = SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId);

  if (!scenario) {
    notFound();
  }

  return (
    <div className="text-slate-800 dark:text-gray-100">
      {/* Top bar with HOME + breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap mb-8 ar-fade-in">
        <Link
          href="/"
          aria-label="Return to home dashboard"
          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-cyan-300 dark:border-cyan-500/40 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 text-cyan-700 dark:text-cyan-300 font-bold text-sm tracking-wide uppercase shadow-sm hover:shadow-lg hover:shadow-cyan-400/30 dark:hover:shadow-cyan-500/20 transition-all"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9" />
            <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
          </svg>
          Home
        </Link>
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 dark:text-gray-500 flex items-center gap-2">
          <Link href="/" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/scenarios" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Scenarios</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-gray-300">{scenario!.id.toUpperCase()}</span>
        </nav>
      </div>

      <div className="ar-slide-up">
        <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-cyan-700 dark:text-cyan-300 mb-2">
          Mission Briefing
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          <span className="ar-gradient-text">{scenario!.name}</span>
        </h1>
        <p className="text-base text-slate-600 dark:text-gray-400 max-w-3xl">
          {scenario!.description}
        </p>
      </div>

      <div className="mt-10 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/70 ar-fade-in-slow">
        <p className="text-sm text-slate-600 dark:text-gray-400">
          <span className="font-bold text-slate-800 dark:text-gray-100">Interactive briefing coming soon.</span>{' '}
          The full gamified walkthrough — difficulty selection, red team / blue team perspectives,
          objectives, timer, XP and scoring — ships in Phase 2 of this feature.
        </p>
      </div>
    </div>
  );
}
