interface WhyTriggeredItem {
  label: string;
  value: string;
}

interface ExplainabilityPanelProps {
  items: WhyTriggeredItem[];
}

export default function ExplainabilityPanel({ items }: ExplainabilityPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
        Explainability
      </p>
      <h2 className="mt-2 text-2xl font-bold">Why this triggered</h2>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950"
          >
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              {item.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-gray-300">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
