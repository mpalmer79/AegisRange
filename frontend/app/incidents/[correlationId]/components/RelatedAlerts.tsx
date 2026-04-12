import Link from 'next/link';
import type { Alert } from '@/lib/types';
import { SEVERITY_STYLES } from './utils';

interface RelatedAlertsProps {
  alerts: Alert[];
}

export default function RelatedAlerts({ alerts }: RelatedAlertsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Related Alerts ({alerts.length})
      </h2>

      {alerts.length === 0 ? (
        <p className="text-sm font-mono text-slate-400 dark:text-gray-600">None</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Link
              key={alert.alert_id}
              href={`/alerts/${alert.alert_id}`}
              className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {alert.rule_name || alert.rule_id || 'Detection'}
                  </p>
                  <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                    {alert.alert_id}
                  </p>
                </div>
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-mono uppercase ${
                    SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
                {alert.summary || 'No alert summary provided.'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
