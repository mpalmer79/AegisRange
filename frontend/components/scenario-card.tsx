'use client';

interface ScenarioCardProps {
  title: string;
  code: string;
  description: string;
  imageUrl?: string;
  onOpenBriefing?: () => void;
  onRun?: () => void;
  isRunning?: boolean;
  disabled?: boolean;
  /** Tooltip text shown when the Run button is disabled due to auth. */
  disabledReason?: string;
}

const FALLBACK_IMAGE = '/images/scenario-default.jpg';

export default function ScenarioCard({
  title,
  code,
  description,
  imageUrl,
  onOpenBriefing,
  onRun,
  isRunning = false,
  disabled = false,
  disabledReason,
}: ScenarioCardProps) {
  const bgImage = imageUrl || FALLBACK_IMAGE;

  return (
    <div className="relative group rounded-2xl overflow-hidden min-h-[320px] flex flex-col">
      {/* Background image layer */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${bgImage})` }}
      />

      {/* Gradient overlay — ensures text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />

      {/* Subtle border glow */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 group-hover:ring-cyan-400/30 transition-all duration-300" />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 p-5">
        {/* Top row: icon + code badge */}
        <div className="flex items-start justify-between gap-3 mb-auto">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2l9 4-9 18-9-18 9-4z" />
            </svg>
          </div>
          <span className="inline-flex items-center text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-cyan-300 backdrop-blur-sm border border-white/10">
            {code}
          </span>
        </div>

        {/* Bottom content block */}
        <div className="mt-4">
          <h3 className="text-lg font-bold text-white mb-1.5 leading-snug">
            {title}
          </h3>
          <p className="text-sm text-gray-300 line-clamp-2 mb-5 leading-relaxed">
            {description}
          </p>

          {/* Action row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenBriefing?.();
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-sm transition-all"
            >
              Open Briefing
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRun?.();
              }}
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Running
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Run
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
