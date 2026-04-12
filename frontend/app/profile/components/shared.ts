import { Rank } from '@/lib/player-progress';

export const ACCENT_GRADIENTS: Record<Rank['accent'], string> = {
  slate:   'from-slate-200 via-slate-100 to-white dark:from-slate-500/20 dark:via-slate-500/5 dark:to-gray-950',
  sky:     'from-sky-200 via-sky-100 to-white dark:from-sky-500/20 dark:via-sky-500/5 dark:to-gray-950',
  cyan:    'from-cyan-200 via-cyan-100 to-white dark:from-cyan-500/20 dark:via-cyan-500/5 dark:to-gray-950',
  emerald: 'from-emerald-200 via-emerald-100 to-white dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-gray-950',
  violet:  'from-violet-200 via-violet-100 to-white dark:from-violet-500/20 dark:via-violet-500/5 dark:to-gray-950',
  amber:   'from-amber-200 via-amber-100 to-white dark:from-amber-500/20 dark:via-amber-500/5 dark:to-gray-950',
};

export const ACCENT_TEXT: Record<Rank['accent'], string> = {
  slate:   'text-slate-700 dark:text-slate-200',
  sky:     'text-sky-700 dark:text-sky-300',
  cyan:    'text-cyan-700 dark:text-cyan-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  violet:  'text-violet-700 dark:text-violet-300',
  amber:   'text-amber-700 dark:text-amber-300',
};

export const ACCENT_BAR: Record<Rank['accent'], string> = {
  slate:   'from-slate-400 to-slate-500',
  sky:     'from-sky-400 to-blue-500',
  cyan:    'from-cyan-400 to-sky-500',
  emerald: 'from-emerald-400 to-teal-500',
  violet:  'from-violet-400 to-purple-500',
  amber:   'from-amber-400 to-orange-500',
};

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
