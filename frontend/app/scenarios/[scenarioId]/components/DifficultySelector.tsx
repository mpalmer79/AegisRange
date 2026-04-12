import { DIFFICULTIES, DifficultyId } from '@/lib/scenario-content';

interface DifficultySelectorProps {
  difficultyId: DifficultyId;
  setDifficultyId: (id: DifficultyId) => void;
  isRunning: boolean;
}

export default function DifficultySelector({
  difficultyId,
  setDifficultyId,
  isRunning,
}: DifficultySelectorProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 shadow-sm dark:shadow-none ar-fade-in">
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
        Difficulty
      </p>
      <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">Pick your rank</h3>
      <div className="space-y-2">
        {DIFFICULTIES.map((d) => {
          const active = d.id === difficultyId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficultyId(d.id)}
              disabled={isRunning}
              aria-pressed={active}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                active
                  ? 'border-cyan-400 dark:border-cyan-500/60 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 shadow-sm'
                  : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-sm font-bold ${active ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-gray-200'}`}>
                  {d.label}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                  {d.xpMultiplier}&times; XP
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-500">{d.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
