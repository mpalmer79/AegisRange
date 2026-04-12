import Link from 'next/link';
import type { MissionStageDef } from '@/lib/scenario-content';
import type { Accent } from './accents';

interface MissionStagesProps {
  stages: MissionStageDef[];
  accent: Accent;
  isComplete: boolean;
  correlationId: string | undefined;
}

export default function MissionStages({
  stages,
  accent,
  isComplete,
  correlationId,
}: MissionStagesProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 p-5 sm:p-6 shadow-sm dark:shadow-none ar-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">
            Cyber Kill Chain
          </p>
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">Mission Stages</h2>
        </div>
        {correlationId && (
          <Link
            href={`/killchain`}
            className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300 hover:underline"
          >
            View kill-chain analysis &rarr;
          </Link>
        )}
      </div>
      <ol className="space-y-3">
        {stages.map((stage, i) => {
          const reached = isComplete && i < stages.length;
          return (
            <li key={stage.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border-2 ${
                    reached
                      ? `bg-gradient-to-br ${accent.icon} border-transparent text-white`
                      : 'border-slate-300 dark:border-gray-700 text-slate-400 dark:text-gray-600'
                  }`}
                >
                  {i + 1}
                </div>
                {i < stages.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-1 ${reached ? 'bg-gradient-to-b from-cyan-400 to-transparent' : 'bg-slate-200 dark:bg-gray-800'}`} />
                )}
              </div>
              <div className="pb-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                  {stage.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{stage.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
