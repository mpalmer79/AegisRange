'use client';

interface IncidentsHeaderProps {
  onRefresh: () => void;
}

export default function IncidentsHeader({ onRefresh }: IncidentsHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-amber-50 to-red-50 px-6 py-8 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-amber-950/20 dark:to-gray-900">
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10"
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Investigations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Incidents
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400 sm:text-base">
            Review aggregated incident records, monitor active investigations,
            and trace how detections and responses accumulated into durable cases.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-mono uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>
    </section>
  );
}
