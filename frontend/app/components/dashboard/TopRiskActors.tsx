'use client';

import Link from 'next/link';
import { RiskProfile } from '@/lib/types';

interface TopRiskActorsProps {
  topRiskActors: RiskProfile[];
}

export default function TopRiskActors({ topRiskActors }: TopRiskActorsProps) {
  if (topRiskActors.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200">Top Risk Actors</h2>
        <Link href="/analytics" className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors">
          View All &rarr;
        </Link>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
        <div className="space-y-3">
          {topRiskActors.map((actor) => {
            const color =
              actor.current_score >= 81 ? 'bg-rose-500' :
              actor.current_score >= 51 ? 'bg-orange-500' :
              actor.current_score >= 21 ? 'bg-amber-500' : 'bg-emerald-500';
            const textColor =
              actor.current_score >= 81 ? 'text-rose-600 dark:text-rose-300' :
              actor.current_score >= 51 ? 'text-orange-600 dark:text-orange-300' :
              actor.current_score >= 21 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300';
            return (
              <div key={actor.actor_id} className="flex items-center gap-4">
                <span className="text-sm font-mono text-cyan-700 dark:text-cyan-300 w-32 truncate">{actor.actor_id}</span>
                <div className="flex-1 h-2 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} ar-bar-grow transition-all`}
                    style={{ width: `${Math.min(actor.current_score, 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-mono font-bold w-8 text-right ${textColor}`}>
                  {actor.current_score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
