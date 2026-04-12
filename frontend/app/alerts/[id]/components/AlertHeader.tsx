import type { Alert } from '@/lib/types';
import { formatConfidence, formatTimestamp, getSeverityStyle } from './utils';

interface AlertHeaderProps {
  alert: Alert;
}

export default function AlertHeader({ alert }: AlertHeaderProps) {
  const severityStyle = getSeverityStyle(alert.severity);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border ${severityStyle.border} bg-gradient-to-br from-white via-rose-50 to-orange-50 px-6 py-8 shadow-sm dark:from-gray-900 dark:via-red-950/20 dark:to-gray-900`}
    >
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Alert Detail
          </p>
          <h1 className="mt-2 break-all text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100 sm:text-3xl">
            {alert.rule_name || 'Unnamed detection rule'}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400">
            This page explains why the detection fired, what evidence supported it,
            and how it links into the broader incident workflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-3 py-1 text-xs font-mono uppercase ${severityStyle.badge}`}
          >
            {alert.severity || 'low'}
          </span>
          <span className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-mono uppercase text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {formatConfidence(alert.confidence)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Alert ID
          </p>
          <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
            {alert.alert_id || 'unknown'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Rule ID
          </p>
          <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
            {alert.rule_id || 'unknown'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Actor
          </p>
          <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
            {alert.actor_id || 'unknown'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Created
          </p>
          <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
            {formatTimestamp(alert.created_at)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Correlation
          </p>
          <p className="mt-1 break-all text-sm font-mono text-cyan-700 dark:text-cyan-400">
            {alert.correlation_id || 'not linked'}
          </p>
        </div>
      </div>
    </section>
  );
}
