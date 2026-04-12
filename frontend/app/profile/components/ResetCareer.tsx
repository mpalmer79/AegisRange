interface ResetCareerProps {
  confirmReset: boolean;
  onRequestReset: () => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
}

export default function ResetCareer({
  confirmReset,
  onRequestReset,
  onConfirmReset,
  onCancelReset,
}: ResetCareerProps) {
  return (
    <section className="mb-8">
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950/50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">Reset career</p>
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Wipes all local XP, missions and achievements. This cannot be undone.
          </p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirmReset}
              className="px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-white bg-rose-600 hover:bg-rose-500 transition"
            >
              Confirm Wipe
            </button>
            <button
              onClick={onCancelReset}
              className="px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onRequestReset}
            className="px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
          >
            Reset Career
          </button>
        )}
      </div>
    </section>
  );
}
