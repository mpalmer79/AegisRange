export const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  investigating: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  contained: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  closed: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
};

export const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  informational: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
};

export const TIMELINE_ENTRY_STYLES: Record<string, { dot: string; icon: string }> = {
  event: { dot: 'bg-cyan-500', icon: 'E' },
  alert: { dot: 'bg-amber-500', icon: 'A' },
  detection: { dot: 'bg-red-500', icon: 'D' },
  response: { dot: 'bg-orange-500', icon: 'R' },
  incident: { dot: 'bg-purple-500', icon: 'I' },
  status_change: { dot: 'bg-green-500', icon: 'S' },
  note: { dot: 'bg-cyan-700', icon: 'N' },
};

export type TimelineRow = {
  id: string;
  type: string;
  summary: string;
  timestamp?: string;
};

export function formatTimestamp(ts?: string) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function getTimelineStyle(type: string) {
  const lower = type.toLowerCase();

  for (const [key, value] of Object.entries(TIMELINE_ENTRY_STYLES)) {
    if (lower.includes(key)) return value;
  }

  return { dot: 'bg-gray-500', icon: '?' };
}

export function riskScoreBadgeStyle(score: number): string {
  if (score >= 81) return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
  if (score >= 51) return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30';
  if (score >= 21) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
}

export function riskScoreBarColor(score: number): string {
  if (score >= 81) return 'bg-red-500';
  if (score >= 51) return 'bg-orange-500';
  if (score >= 21) return 'bg-amber-500';
  return 'bg-green-500';
}
