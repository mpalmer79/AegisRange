'use client';

interface AlertsMetricsData {
  total: number;
  critical: number;
  high: number;
  actors: number;
}

interface AlertsMetricsProps {
  metrics: AlertsMetricsData;
}

export default function AlertsMetrics({ metrics }: AlertsMetricsProps) {
  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Total alerts
        </p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-gray-100">
          {metrics.total}
        </p>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-white p-5 shadow-sm dark:border-red-500/20 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Critical
        </p>
        <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
          {metrics.critical}
        </p>
      </div>

      <div className="rounded-2xl border border-orange-500/20 bg-white p-5 shadow-sm dark:border-orange-500/20 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          High
        </p>
        <p className="mt-2 text-3xl font-bold text-orange-700 dark:text-orange-400">
          {metrics.high}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Distinct actors
        </p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-gray-100">
          {metrics.actors}
        </p>
      </div>
    </section>
  );
}
