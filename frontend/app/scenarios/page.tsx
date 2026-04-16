'use client';

import { useState } from 'react';
import { runScenario, getScenarioErrorMessage } from '@/lib/api';
import { SCENARIO_DEFINITIONS, ScenarioResult } from '@/lib/types';
import Link from 'next/link';

export default function ScenariosPage() {
  const [results, setResults] = useState<Record<string, ScenarioResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRun = async (scenarioId: string) => {
    setRunning(scenarioId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[scenarioId];
      return next;
    });
    try {
      const result = await runScenario(scenarioId);
      setResults((prev) => ({ ...prev, [scenarioId]: result }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [scenarioId]: getScenarioErrorMessage(err),
      }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Scenarios</h1>
        <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
          Run cybersecurity attack simulations and observe the detection pipeline
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SCENARIO_DEFINITIONS.map((scenario) => {
          const result = results[scenario.id];
          const error = errors[scenario.id];
          const isRunning = running === scenario.id;

          return (
            <div
              key={scenario.id}
              className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm dark:shadow-none hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-colors"
            >
              <div className="p-5 border-b border-slate-200 dark:border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/scenarios/${scenario.id}`}
                    aria-label={`Open ${scenario.name} mission briefing`}
                    className="flex-1 group block -m-2 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded">
                        {scenario.id.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-gray-600 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        Briefing &rarr;
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100 mb-1 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                      {scenario.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
                      {scenario.description}
                    </p>
                  </Link>
                  <button
                    onClick={() => handleRun(scenario.id)}
                    disabled={running !== null}
                    aria-label={`Run ${scenario.name} in place`}
                    className={`shrink-0 px-4 py-2 rounded text-sm font-mono font-medium transition-all ${
                      isRunning
                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 animate-pulse cursor-wait'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isRunning ? 'RUNNING...' : 'RUN'}
                  </button>
                </div>
              </div>

              {/* Result Panel */}
              {(result || error) && (
                <div className="p-5 bg-slate-100 dark:bg-gray-950/50">
                  {error ? (
                    <div className="text-red-700 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  ) : result ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-xs font-mono text-green-700 dark:text-green-400 uppercase">Completed</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-gray-500 text-xs font-mono mb-0.5">CORRELATION ID</p>
                          <p className="font-mono text-cyan-700 dark:text-cyan-400 text-xs break-all">
                            {result.correlation_id}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-gray-500 text-xs font-mono mb-0.5">EVENTS</p>
                          <p className="font-mono text-slate-800 dark:text-gray-200">
                            {result.events_generated ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-gray-500 text-xs font-mono mb-0.5">ALERTS</p>
                          <p className="font-mono text-amber-700 dark:text-amber-400">
                            {result.alerts_generated ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-gray-500 text-xs font-mono mb-0.5">RESPONSES</p>
                          <p className="font-mono text-orange-700 dark:text-orange-400">
                            {result.responses_generated ?? 0}
                          </p>
                        </div>
                      </div>

                      {result.incident_id && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-800">
                          <p className="text-slate-500 dark:text-gray-500 text-xs font-mono mb-1">INCIDENT</p>
                          <Link
                            href={`/incidents/${result.correlation_id}`}
                            className="inline-flex items-center gap-2 text-sm font-mono text-red-700 dark:text-red-400 hover:text-red-300 transition-colors"
                          >
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            {result.incident_id}
                            <span className="text-slate-400 dark:text-gray-600">&#8594;</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
