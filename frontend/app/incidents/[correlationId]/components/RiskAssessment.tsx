import type { Incident, RiskProfile } from '@/lib/types';
import { riskScoreBadgeStyle, riskScoreBarColor } from './utils';

interface RiskAssessmentProps {
  incident: Incident;
  riskProfile: RiskProfile | null;
}

export default function RiskAssessment({ incident, riskProfile }: RiskAssessmentProps) {
  if (incident.risk_score == null && !riskProfile) return null;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-300">
        Risk Assessment
      </h2>

      <div className="flex flex-wrap gap-6">
        {incident.risk_score != null && (
          <div>
            <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
              INCIDENT RISK SCORE
            </p>
            <div className="flex items-center gap-3">
              <span
                className={`rounded border px-4 py-2 text-2xl font-mono font-bold ${riskScoreBadgeStyle(incident.risk_score)}`}
              >
                {incident.risk_score}
              </span>
              <div className="h-3 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full ${riskScoreBarColor(incident.risk_score)}`}
                  style={{ width: `${Math.min(incident.risk_score, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {riskProfile && (
          <div className="min-w-[220px] flex-1">
            <p className="mb-2 text-xs font-mono text-slate-500 dark:text-gray-500">
              ACTOR PROFILE:{' '}
              <span className="text-cyan-700 dark:text-cyan-400">
                {riskProfile.actor_id}
              </span>
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs font-mono text-slate-400 dark:text-gray-600">
                  CURRENT SCORE
                </p>
                <p className="font-mono font-bold text-slate-800 dark:text-gray-200">
                  {riskProfile.current_score}
                </p>
              </div>

              <div>
                <p className="text-xs font-mono text-slate-400 dark:text-gray-600">
                  PEAK SCORE
                </p>
                <p className="font-mono font-bold text-slate-800 dark:text-gray-200">
                  {riskProfile.peak_score}
                </p>
              </div>
            </div>

            {riskProfile.contributing_rules.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-mono text-slate-400 dark:text-gray-600">
                  CONTRIBUTING RULES
                </p>
                <div className="flex flex-wrap gap-1">
                  {riskProfile.contributing_rules.map((rule) => (
                    <span
                      key={rule}
                      className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
