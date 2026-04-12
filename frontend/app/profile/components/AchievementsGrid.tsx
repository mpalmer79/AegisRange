import { ACHIEVEMENTS, Achievement, AchievementCategory } from '@/lib/player-progress';

// ============================================================
// Achievement banner palette — Phase 6 visual pass.
// Each palette supplies every Tailwind class the banner needs,
// enumerated (not dynamic) so the JIT picks them up.
// ============================================================
interface AchievementPalette {
  border: string;       // outer border when earned
  bg: string;           // gradient bg classes
  title: string;        // title text color
  iconBg: string;       // icon badge gradient
  orbOne: string;       // decorative orb 1 color
  orbTwo: string;       // decorative orb 2 color
  chipText: string;     // category chip text
  chipBg: string;       // category chip bg
  label: string;        // chip label displayed on the card
}

const PALETTES: Record<AchievementCategory, AchievementPalette> = {
  core: {
    border: 'border-cyan-300 dark:border-cyan-500/40',
    bg: 'from-cyan-50 via-sky-50 to-indigo-50 dark:from-cyan-500/10 dark:via-sky-500/10 dark:to-indigo-500/10',
    title: 'text-cyan-700 dark:text-cyan-200',
    iconBg: 'from-cyan-500 via-sky-500 to-indigo-600',
    orbOne: 'bg-cyan-300/50 dark:bg-cyan-500/20',
    orbTwo: 'bg-indigo-300/40 dark:bg-indigo-500/15',
    chipText: 'text-cyan-700 dark:text-cyan-300',
    chipBg: 'bg-cyan-100 dark:bg-cyan-500/15',
    label: 'Career',
  },
  red: {
    border: 'border-rose-300 dark:border-rose-500/40',
    bg: 'from-rose-50 via-red-50 to-orange-50 dark:from-rose-500/10 dark:via-red-500/10 dark:to-orange-500/10',
    title: 'text-rose-700 dark:text-rose-200',
    iconBg: 'from-rose-500 via-red-500 to-orange-500',
    orbOne: 'bg-rose-300/50 dark:bg-rose-500/20',
    orbTwo: 'bg-orange-300/40 dark:bg-orange-500/15',
    chipText: 'text-rose-700 dark:text-rose-300',
    chipBg: 'bg-rose-100 dark:bg-rose-500/15',
    label: 'Red Team',
  },
  blue: {
    border: 'border-sky-300 dark:border-sky-500/40',
    bg: 'from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-500/10 dark:via-blue-500/10 dark:to-indigo-500/10',
    title: 'text-sky-700 dark:text-sky-200',
    iconBg: 'from-sky-500 via-blue-500 to-indigo-600',
    orbOne: 'bg-sky-300/50 dark:bg-sky-500/20',
    orbTwo: 'bg-indigo-300/40 dark:bg-indigo-500/15',
    chipText: 'text-sky-700 dark:text-sky-300',
    chipBg: 'bg-sky-100 dark:bg-sky-500/15',
    label: 'Blue Team',
  },
  elite: {
    border: 'border-amber-300 dark:border-amber-500/40',
    bg: 'from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-500/10 dark:via-yellow-500/10 dark:to-orange-500/10',
    title: 'text-amber-700 dark:text-amber-200',
    iconBg: 'from-amber-400 via-orange-500 to-yellow-500',
    orbOne: 'bg-amber-300/50 dark:bg-amber-500/20',
    orbTwo: 'bg-yellow-300/40 dark:bg-yellow-500/15',
    chipText: 'text-amber-700 dark:text-amber-300',
    chipBg: 'bg-amber-100 dark:bg-amber-500/15',
    label: 'Elite',
  },
  op: {
    border: 'border-emerald-300 dark:border-emerald-500/40',
    bg: 'from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-500/10 dark:via-teal-500/10 dark:to-cyan-500/10',
    title: 'text-emerald-700 dark:text-emerald-200',
    iconBg: 'from-emerald-500 via-teal-500 to-cyan-600',
    orbOne: 'bg-emerald-300/50 dark:bg-emerald-500/20',
    orbTwo: 'bg-teal-300/40 dark:bg-teal-500/15',
    chipText: 'text-emerald-700 dark:text-emerald-300',
    chipBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    label: 'Training Op',
  },
  daily: {
    border: 'border-fuchsia-300 dark:border-fuchsia-500/40',
    bg: 'from-fuchsia-50 via-violet-50 to-purple-50 dark:from-fuchsia-500/10 dark:via-violet-500/10 dark:to-purple-500/10',
    title: 'text-fuchsia-700 dark:text-fuchsia-200',
    iconBg: 'from-fuchsia-500 via-violet-500 to-purple-600',
    orbOne: 'bg-fuchsia-300/50 dark:bg-fuchsia-500/20',
    orbTwo: 'bg-violet-300/40 dark:bg-violet-500/15',
    chipText: 'text-fuchsia-700 dark:text-fuchsia-300',
    chipBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15',
    label: 'Daily',
  },
};

// Per-op overrides so each training op gets its own accent.
const OP_ID_PALETTES: Record<string, AchievementPalette> = {
  'op-nightshade': {
    ...PALETTES.blue,
    iconBg: 'from-sky-500 via-indigo-500 to-violet-600',
    label: 'Op Nightshade',
  },
  'op-firestarter': {
    ...PALETTES.red,
    iconBg: 'from-rose-500 via-red-500 to-orange-500',
    label: 'Op Firestarter',
  },
  'op-gridlock': {
    ...PALETTES.daily,
    iconBg: 'from-fuchsia-500 via-pink-500 to-rose-600',
    label: 'Op Gridlock',
  },
};

function paletteFor(a: Achievement): AchievementPalette {
  if (a.category === 'op' && OP_ID_PALETTES[a.id]) {
    return OP_ID_PALETTES[a.id];
  }
  return PALETTES[a.category];
}

function AchievementIcon({ icon, earned }: { icon: string; earned: boolean }) {
  // Decorative inside the gradient badge — the parent card already
  // carries an aria-label that describes the achievement.
  const svgProps = {
    'aria-hidden': true as const,
    focusable: false as const,
    className: `w-5 h-5 ${earned ? '' : 'opacity-40'}`,
    viewBox: '0 0 24 24',
  };
  switch (icon) {
    case 'target':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
    case 'sword':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></svg>;
    case 'shield':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'star':
      return <svg {...svgProps} fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" /></svg>;
    case 'cog':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
    case 'swap':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l-4 4 4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></svg>;
    case 'books':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v16H4z" /><path d="M10 4h6v16h-6z" /><path d="M16 6l4 1-3 14-4-1z" /></svg>;
    case 'silver':
    case 'gold':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6" /><path d="M8 14l-2 8 6-3 6 3-2-8" /></svg>;
    case 'crosshair':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /></svg>;
    case 'moon':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>;
    case 'flame':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2s4 5 4 9a4 4 0 11-8 0c0-2 1-3 2-4-0.5 2 1 3 2 3 0-3-1-5 0-8z" /><path d="M7 16a5 5 0 0010 0" /></svg>;
    case 'radio':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 010 8.4M7.8 7.8a6 6 0 000 8.4" /><path d="M19 5a10 10 0 010 14M5 5a10 10 0 000 14" /></svg>;
    case 'calendar':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>;
    case 'bolt':
      return <svg {...svgProps} fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>;
    case 'inferno':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s5 4 5 9a5 5 0 11-10 0c0-2 1-4 2-5 0 2 1 3 3 3-1-3 0-5 0-7z" /><path d="M9 17a3 3 0 006 0" /></svg>;
    case 'trophy':
      return <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" /></svg>;
    default:
      return <svg {...svgProps} fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>;
  }
}

interface AchievementsGridProps {
  earnedAch: Set<string>;
}

export default function AchievementsGrid({ earnedAch }: AchievementsGridProps) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Achievements</h2>
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Unlock by completing missions and clearing objectives.
          </p>
        </div>
        <p className="text-xs font-mono text-slate-500 dark:text-gray-500">
          {earnedAch.size} / {ACHIEVEMENTS.length}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ar-stagger">
        {ACHIEVEMENTS.map((a) => {
          const earned = earnedAch.has(a.id);
          const palette = paletteFor(a);
          return (
            <div
              key={a.id}
              aria-label={`${a.name} — ${earned ? 'earned' : 'locked'}`}
              className={`group relative rounded-2xl border-2 overflow-hidden p-5 transition-all ${
                earned
                  ? `${palette.border} bg-gradient-to-br ${palette.bg} shadow-sm hover:shadow-lg dark:shadow-none ar-shine`
                  : 'border-slate-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 grayscale hover:grayscale-0'
              }`}
            >
              {/* Decorative orbs drift slowly in the background
                  when earned, giving a subtle sense of life. */}
              {earned && (
                <>
                  <div aria-hidden className={`absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl ${palette.orbOne} ar-drift`} />
                  <div aria-hidden className={`absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-3xl ${palette.orbTwo} ar-drift-reverse`} />
                </>
              )}

              <div className="relative flex items-start gap-4">
                {/* Gradient badge with the achievement icon.
                    Floats gently when earned, goes flat when locked. */}
                <div
                  className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                    earned
                      ? `bg-gradient-to-br ${palette.iconBg} text-white ar-float-slow ar-wiggle-hover`
                      : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600 shadow-none'
                  }`}
                >
                  <div className="[&>svg]:w-6 [&>svg]:h-6">
                    <AchievementIcon icon={a.icon} earned={earned} />
                  </div>
                </div>

                {/* Text column */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`inline-flex items-center text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${
                        earned
                          ? `${palette.chipBg} ${palette.chipText} border-transparent`
                          : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600 border-slate-200 dark:border-gray-800'
                      }`}
                    >
                      {palette.label}
                    </span>
                    {earned ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        Earned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-gray-600">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="10" rx="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        Locked
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-base font-bold leading-tight truncate ${
                      earned ? palette.title : 'text-slate-700 dark:text-gray-300'
                    }`}
                  >
                    {a.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">
                    {a.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
