'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import ScenarioCard from '@/components/scenario-card';

// Color palette per scenario — each card gets its own accent so the grid stays
// lively in both light and dark modes. Keep this aligned with the scenario
// drill-down pages we ship in later phases.
const SCENARIO_ACCENTS: Record<
  string,
  {
    ring: string;       // border + hover
    glow: string;       // box shadow
    chip: string;       // id badge pill
    icon: string;       // icon bg
    title: string;      // title color
    gradient: string;   // faint gradient behind the card
  }
> = {
  'scn-auth-001': {
    ring: 'border-rose-300/70 dark:border-rose-500/30 hover:border-rose-500 dark:hover:border-rose-400',
    glow: 'hover:shadow-rose-400/30 dark:hover:shadow-rose-500/20',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    icon: 'from-rose-500 to-red-600',
    title: 'text-rose-700 dark:text-rose-300',
    gradient: 'from-rose-100/60 via-white to-white dark:from-rose-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-session-002': {
    ring: 'border-amber-300/70 dark:border-amber-500/30 hover:border-amber-500 dark:hover:border-amber-400',
    glow: 'hover:shadow-amber-400/30 dark:hover:shadow-amber-500/20',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    icon: 'from-amber-500 to-orange-600',
    title: 'text-amber-700 dark:text-amber-300',
    gradient: 'from-amber-100/60 via-white to-white dark:from-amber-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-doc-003': {
    ring: 'border-emerald-300/70 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400',
    glow: 'hover:shadow-emerald-400/30 dark:hover:shadow-emerald-500/20',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: 'from-emerald-500 to-teal-600',
    title: 'text-emerald-700 dark:text-emerald-300',
    gradient: 'from-emerald-100/60 via-white to-white dark:from-emerald-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-doc-004': {
    ring: 'border-violet-300/70 dark:border-violet-500/30 hover:border-violet-500 dark:hover:border-violet-400',
    glow: 'hover:shadow-violet-400/30 dark:hover:shadow-violet-500/20',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    icon: 'from-violet-500 to-purple-600',
    title: 'text-violet-700 dark:text-violet-300',
    gradient: 'from-violet-100/60 via-white to-white dark:from-violet-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-svc-005': {
    ring: 'border-sky-300/70 dark:border-sky-500/30 hover:border-sky-500 dark:hover:border-sky-400',
    glow: 'hover:shadow-sky-400/30 dark:hover:shadow-sky-500/20',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    icon: 'from-sky-500 to-blue-600',
    title: 'text-sky-700 dark:text-sky-300',
    gradient: 'from-sky-100/60 via-white to-white dark:from-sky-500/5 dark:via-gray-900 dark:to-gray-900',
  },
  'scn-corr-006': {
    ring: 'border-fuchsia-300/70 dark:border-fuchsia-500/30 hover:border-fuchsia-500 dark:hover:border-fuchsia-400',
    glow: 'hover:shadow-fuchsia-400/30 dark:hover:shadow-fuchsia-500/20',
    chip: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
    icon: 'from-fuchsia-500 via-pink-500 to-rose-600',
    title: 'text-fuchsia-700 dark:text-fuchsia-300',
    gradient: 'from-fuchsia-100/60 via-white to-white dark:from-fuchsia-500/5 dark:via-gray-900 dark:to-gray-900',
  },
};

const DEFAULT_ACCENT = SCENARIO_ACCENTS['scn-auth-001'];

interface ScenarioGridProps {
  runningScenario: string | null;
  onRunScenario: (scenarioId: string) => void;
}

export default function ScenarioGrid({ runningScenario, onRunScenario }: ScenarioGridProps) {
  const router = useRouter();

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Quick Scenarios</h2>
          <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
            Click a card to enter the interactive mission briefing.
          </p>
        </div>
        <Link
          href="/scenarios"
          className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
        >
          VIEW ALL &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ar-stagger">
        {SCENARIO_DEFINITIONS.map((s) => {
          const accent = SCENARIO_ACCENTS[s.id] ?? DEFAULT_ACCENT;
          const isRunning = runningScenario === s.id;

          /* ── Redesigned card for SCN-CORR-006 ────────────────── */
          if (s.id === 'scn-corr-006') {
            return (
              <ScenarioCard
                key={s.id}
                title={s.name}
                code="SCN-CORR-006"
                description={s.description}
                imageUrl="/images/correlated-attack.jpg"
                isRunning={isRunning}
                disabled={runningScenario !== null}
                onOpenBriefing={() => router.push(`/scenarios/${s.id}`)}
                onRun={() => onRunScenario(s.id)}
              />
            );
          }

          /* ── Original card for all other scenarios ───────────── */
          return (
            <div key={s.id} className="relative group">
              <Link
                href={`/scenarios/${s.id}`}
                aria-label={`Open ${s.name} briefing`}
                className={`block p-5 rounded-xl border-2 bg-gradient-to-br ${accent.gradient} ${accent.ring} shadow-sm hover:shadow-lg dark:shadow-none ${accent.glow} ar-card-hover`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent.icon} flex items-center justify-center shadow-md`}>
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l9 4-9 18-9-18 9-4z" />
                    </svg>
                  </div>
                  <span className={`inline-flex items-center text-[10px] font-mono tracking-wider px-2 py-1 rounded-full ${accent.chip}`}>
                    {s.id.toUpperCase()}
                  </span>
                </div>
                <p className={`text-base font-semibold ${accent.title} mb-1.5`}>{s.name}</p>
                <p className="text-xs text-slate-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {s.description}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-gray-800/80">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
                    Open briefing
                  </span>
                  <span className={`text-sm ar-arrow ${accent.title}`}>&rarr;</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRunScenario(s.id);
                }}
                disabled={runningScenario !== null}
                aria-label={`Run ${s.name} scenario in place`}
                className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-white/90 dark:bg-gray-950/90 backdrop-blur border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isRunning ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-300 animate-pulse" />
                    RUNNING
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    RUN
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
