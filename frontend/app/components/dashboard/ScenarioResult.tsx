'use client';

import Link from 'next/link';
import { ScenarioResult } from '@/lib/types';

interface ScenarioResultPanelProps {
  lastResult: ScenarioResult;
}

export default function ScenarioResultPanel({ lastResult }: ScenarioResultPanelProps) {
  return (
    <div className="p-5 bg-white dark:bg-gray-900 border-2 border-cyan-300 dark:border-cyan-500/30 rounded-xl shadow-md dark:shadow-none ar-bounce-in">
      <h3 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 mb-3 font-mono">LAST SCENARIO RESULT</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Scenario</p>
          <p className="font-mono text-slate-800 dark:text-gray-200">{lastResult.scenario_id}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Correlation ID</p>
          <p className="font-mono text-cyan-700 dark:text-cyan-300 text-xs break-all">{lastResult.correlation_id}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Events / Alerts</p>
          <p className="font-mono text-slate-800 dark:text-gray-200">
            {lastResult.events_generated ?? 0} / {lastResult.alerts_generated ?? 0}
          </p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-gray-500 text-xs mb-1">Incident</p>
          {lastResult.incident_id ? (
            <Link href={`/incidents/${lastResult.correlation_id}`} className="font-mono text-rose-600 dark:text-rose-400 hover:underline text-xs">
              {lastResult.incident_id}
            </Link>
          ) : (
            <p className="font-mono text-slate-500 dark:text-gray-500">None</p>
          )}
        </div>
      </div>
    </div>
  );
}
