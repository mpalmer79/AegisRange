// ---------- per-scenario accent palette ----------

export type Accent = {
  chip: string;
  ring: string;
  gradient: string;
  title: string;
  icon: string;
  glow: string;
};

export const ACCENTS: Record<string, Accent> = {
  'scn-auth-001': {
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    ring: 'border-rose-300 dark:border-rose-500/30',
    gradient: 'from-rose-100/70 via-white to-white dark:from-rose-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-rose-500 via-red-500 to-orange-500',
    icon: 'from-rose-500 to-red-600',
    glow: 'shadow-rose-400/20 dark:shadow-rose-500/10',
  },
  'scn-session-002': {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    ring: 'border-amber-300 dark:border-amber-500/30',
    gradient: 'from-amber-100/70 via-white to-white dark:from-amber-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-amber-500 via-orange-500 to-red-500',
    icon: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-400/20 dark:shadow-amber-500/10',
  },
  'scn-doc-003': {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    ring: 'border-emerald-300 dark:border-emerald-500/30',
    gradient: 'from-emerald-100/70 via-white to-white dark:from-emerald-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-emerald-500 via-teal-500 to-cyan-500',
    icon: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-400/20 dark:shadow-emerald-500/10',
  },
  'scn-doc-004': {
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    ring: 'border-violet-300 dark:border-violet-500/30',
    gradient: 'from-violet-100/70 via-white to-white dark:from-violet-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-violet-500 via-purple-500 to-fuchsia-500',
    icon: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-400/20 dark:shadow-violet-500/10',
  },
  'scn-svc-005': {
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    ring: 'border-sky-300 dark:border-sky-500/30',
    gradient: 'from-sky-100/70 via-white to-white dark:from-sky-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-sky-500 via-blue-500 to-indigo-500',
    icon: 'from-sky-500 to-blue-600',
    glow: 'shadow-sky-400/20 dark:shadow-sky-500/10',
  },
  'scn-corr-006': {
    chip: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
    ring: 'border-fuchsia-300 dark:border-fuchsia-500/30',
    gradient: 'from-fuchsia-100/70 via-white to-white dark:from-fuchsia-500/10 dark:via-gray-950 dark:to-gray-950',
    title: 'from-fuchsia-500 via-pink-500 to-rose-500',
    icon: 'from-fuchsia-500 via-pink-500 to-rose-600',
    glow: 'shadow-fuchsia-400/20 dark:shadow-fuchsia-500/10',
  },
};

export const DEFAULT_ACCENT = ACCENTS['scn-auth-001'];
