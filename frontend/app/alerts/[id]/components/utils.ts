import type { Event, IncidentResponse } from '@/lib/types';

export const SEVERITY_STYLES: Record<
  string,
  { badge: string; border: string; text: string }
> = {
  critical: {
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    border: 'border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
  },
  high: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    border: 'border-orange-500/30',
    text: 'text-orange-700 dark:text-orange-400',
  },
  medium: {
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/30',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  low: {
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  informational: {
    badge: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
    border: 'border-gray-500/30',
    text: 'text-slate-600 dark:text-gray-400',
  },
};

export function getSeverityStyle(severity?: string) {
  return SEVERITY_STYLES[severity?.toLowerCase() ?? ''] ?? SEVERITY_STYLES.low;
}

export function formatTimestamp(ts?: string) {
  if (!ts) return 'Unknown';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function formatConfidence(confidence?: string) {
  if (!confidence) return 'unknown';
  return confidence;
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function getEventLabel(event: Event) {
  if (event.event_type) return event.event_type;

  if (event.payload && typeof event.payload === 'object') {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.event_type === 'string') {
      return payload.event_type;
    }
  }

  return 'unknown_event';
}

export function getResponseLabel(response: IncidentResponse) {
  return response.response_type || response.summary || 'unknown_response';
}
