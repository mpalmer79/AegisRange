'use client';

interface IncidentsFiltersProps {
  filterStatus: string;
  filterSeverity: string;
  filterActor: string;
  sortBy: string;
  onFilterStatusChange: (value: string) => void;
  onFilterSeverityChange: (value: string) => void;
  onFilterActorChange: (value: string) => void;
  onSortByChange: (value: string) => void;
}

export default function IncidentsFilters({
  filterStatus,
  filterSeverity,
  filterActor,
  sortBy,
  onFilterStatusChange,
  onFilterSeverityChange,
  onFilterActorChange,
  onSortByChange,
}: IncidentsFiltersProps) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
          Investigation controls
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">
          Filter incidents by status, severity, actor, or sort by operational priority.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="contained">Contained</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => onFilterSeverityChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational</option>
        </select>

        <input
          type="text"
          placeholder="Filter by actor"
          value={filterActor}
          onChange={(e) => onFilterActorChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
        />

        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="recent">Sort by recent</option>
          <option value="severity">Sort by severity</option>
          <option value="status">Sort by status</option>
          <option value="risk">Sort by risk</option>
        </select>
      </div>
    </section>
  );
}
