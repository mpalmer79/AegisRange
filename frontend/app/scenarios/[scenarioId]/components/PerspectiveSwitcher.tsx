import type { Perspective, ObjectiveDef } from '@/lib/scenario-content';

interface ObjectiveStatus extends ObjectiveDef {
  done: boolean;
}

interface PerspectiveMeta {
  role: string;
  summary: string;
}

interface PerspectiveSwitcherProps {
  perspective: Perspective;
  setPerspective: (p: Perspective) => void;
  perspectiveMeta: PerspectiveMeta;
  perspectiveColor: string;
  perspectiveBadge: string;
  objectiveStatus: ObjectiveStatus[];
  xpMultiplier: number;
  isRunning: boolean;
}

export default function PerspectiveSwitcher({
  perspective,
  setPerspective,
  perspectiveMeta,
  perspectiveColor,
  perspectiveBadge,
  objectiveStatus,
  xpMultiplier,
  isRunning,
}: PerspectiveSwitcherProps) {
  const isRed = perspective === 'red';

  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 sm:p-6 shadow-sm dark:shadow-none ar-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
            Perspective
          </p>
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">
            Choose your side
          </h2>
        </div>
        <div
          role="tablist"
          aria-label="Perspective"
          className="inline-flex rounded-full border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900 p-1"
        >
          <button
            role="tab"
            aria-selected={isRed}
            onClick={() => !isRunning && setPerspective('red')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              isRed
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30'
                : 'text-slate-600 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-300'
            }`}
          >
            Red Team
          </button>
          <button
            role="tab"
            aria-selected={!isRed}
            onClick={() => !isRunning && setPerspective('blue')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              !isRed
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-300'
            }`}
          >
            Blue Team
          </button>
        </div>
      </div>

      <div className={`mb-5 px-4 py-3 rounded-lg border ${perspectiveBadge}`}>
        <p className={`text-xs font-mono uppercase tracking-wider ${perspectiveColor} mb-1`}>
          Role: {perspectiveMeta.role}
        </p>
        <p className="text-sm text-slate-700 dark:text-gray-300">{perspectiveMeta.summary}</p>
      </div>

      {/* Objectives checklist */}
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-2">
        Objectives
      </p>
      <ul className="space-y-3">
        {objectiveStatus.map((o, idx) => {
          const done = o.done;
          return (
            <li
              key={o.id}
              className={`relative flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                done
                  ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5'
                  : 'border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40'
              }`}
            >
              <div
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-gray-700 text-slate-400 dark:text-gray-600'
                }`}
                aria-hidden
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : (
                  <span className="text-[11px] font-mono">{idx + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm font-semibold ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-gray-100'}`}>
                    {o.title}
                  </p>
                  <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    done
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-gray-800 text-slate-600 dark:text-gray-400'
                  }`}>
                    +{Math.round(o.xp * xpMultiplier)} XP
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{o.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
