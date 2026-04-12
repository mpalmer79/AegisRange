'use client';

interface AlertsFiltersProps {
  filterRuleId: string;
  filterActorId: string;
  filterSeverity: string;
  filterConfidence: string;
  sortBy: string;
  onFilterRuleIdChange: (value: string) => void;
  onFilterActorIdChange: (value: string) => void;
  onFilterSeverityChange: (value: string) => void;
  onFilterConfidenceChange: (value: string) => void;
  onSortByChange: (value: string) => void;
}

export default function AlertsFilters({
  filterRuleId,
  filterActorId,
  filterSeverity,
  filterConfidence,
  sortBy,
  onFilterRuleIdChange,
  onFilterActorIdChange,
  onFilterSeverityChange,
  onFilterConfidenceChange,
  onSortByChange,
}: AlertsFiltersProps) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
          Triage controls
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">
          Narrow the queue by rule, actor, severity, confidence, or sort order.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input
          type="text"
          placeholder="Filter by rule_id"
          value={filterRuleId}
          onChange={(e) => onFilterRuleIdChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
        />

        <input
          type="text"
          placeholder="Filter by actor_id"
          value={filterActorId}
          onChange={(e) => onFilterActorIdChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
        />

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

        <select
          value={filterConfidence}
          onChange={(e) => onFilterConfidenceChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="all">All confidence</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="recent">Sort by recent</option>
          <option value="severity">Sort by severity</option>
          <option value="confidence">Sort by confidence</option>
        </select>
      </div>
    </section>
  );
}
