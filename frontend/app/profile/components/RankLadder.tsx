import { RANKS } from '@/lib/player-progress';
import { ACCENT_TEXT } from './shared';

interface RankLadderProps {
  totalXp: number;
  currentRankId: string;
}

export default function RankLadder({ totalXp, currentRankId }: RankLadderProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-3">Rank Ladder</h2>
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none p-5">
        <ol className="space-y-3">
          {RANKS.map((r) => {
            const reached = totalXp >= r.minXp;
            const current = r.id === currentRankId;
            return (
              <li key={r.id} className="flex items-center gap-4">
                <span
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono border-2 ${
                    current
                      ? `border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 ${ACCENT_TEXT[r.accent]}`
                      : reached
                      ? 'border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-600'
                  }`}
                >
                  {reached ? '✓' : '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${current ? ACCENT_TEXT[r.accent] : reached ? 'text-slate-800 dark:text-gray-100' : 'text-slate-500 dark:text-gray-500'}`}>
                    {r.name}
                    {current && <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Current</span>}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500">{r.tagline}</p>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-gray-500 shrink-0">
                  {r.minXp} XP
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
