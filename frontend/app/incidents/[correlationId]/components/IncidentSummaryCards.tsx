interface IncidentSummaryCardsProps {
  alertsCount: number;
  eventsCount: number;
  responsesCount: number;
  notesCount: number;
}

export default function IncidentSummaryCards({
  alertsCount,
  eventsCount,
  responsesCount,
  notesCount,
}: IncidentSummaryCardsProps) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-amber-500/20 bg-white p-5 shadow-sm dark:border-amber-500/20 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Related alerts
        </p>
        <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-400">
          {alertsCount}
        </p>
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-white p-5 shadow-sm dark:border-cyan-500/20 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Related events
        </p>
        <p className="mt-2 text-3xl font-bold text-cyan-700 dark:text-cyan-400">
          {eventsCount}
        </p>
      </div>

      <div className="rounded-2xl border border-orange-500/20 bg-white p-5 shadow-sm dark:border-orange-500/20 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Responses
        </p>
        <p className="mt-2 text-3xl font-bold text-orange-700 dark:text-orange-400">
          {responsesCount}
        </p>
      </div>

      <div className="rounded-2xl border border-cyan-800/20 bg-white p-5 shadow-sm dark:border-cyan-800/20 dark:bg-gray-900">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Analyst notes
        </p>
        <p className="mt-2 text-3xl font-bold text-cyan-800 dark:text-cyan-400">
          {notesCount}
        </p>
      </div>
    </section>
  );
}
