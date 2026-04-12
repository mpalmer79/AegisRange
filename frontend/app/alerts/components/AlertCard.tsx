'use client';

import Link from 'next/link';
import { Alert } from '@/lib/types';

const SEVERITY_STYLES: Record<string, { badge: string; border: string; accent: string }> = {
  critical: {
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    border: 'border-red-500/30',
    accent: 'text-red-700 dark:text-red-400',
  },
  high: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    border: 'border-orange-500/30',
    accent: 'text-orange-700 dark:text-orange-400',
  },
  medium: {
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/30',
    accent: 'text-yellow-700 dark:text-yellow-400',
  },
  low: {
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    accent: 'text-blue-700 dark:text-blue-400',
  },
  informational: {
    badge: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
    border: 'border-gray-500/30',
    accent: 'text-slate-600 dark:text-gray-400',
  },
};

function getSeverityStyle(severity: string) {
  return SEVERITY_STYLES[severity?.toLowerCase()] ?? SEVERITY_STYLES.low;
}

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatConfidence(confidence: string | number | null | undefined) {
  if (confidence === null || confidence === undefined || confidence === '') {
    return 'unknown';
  }
  if (typeof confidence === 'number') {
    return `${Math.round(confidence * 100)}%`;
  }
  return String(confidence);
}

function getWhyItMatters(alert: Alert) {
  if (alert.summary?.trim()) return alert.summary.trim();
  if (alert.rule_name?.trim()) return `Triggered by ${alert.rule_name}.`;
  return 'Detection generated without a detailed summary.';
}

interface AlertCardProps {
  alert: Alert;
  index: number;
  total: number;
}

export default function AlertCard({ alert, index, total }: AlertCardProps) {
  const style = getSeverityStyle(alert.severity);

  const content = (
    <div
      className={`rounded-2xl border ${style.border} bg-white p-5 shadow-sm transition-colors hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-900/80`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-gray-500">
            {alert.rule_id || 'unknown_rule'}
          </p>
          <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">
            {alert.rule_name || 'Unnamed detection rule'}
          </h3>
        </div>

        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-mono uppercase ${style.badge}`}
        >
          {alert.severity || 'low'}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          Why this matters
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
          {getWhyItMatters(alert)}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Actor
          </p>
          <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
            {alert.actor_id || 'unknown'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Confidence
          </p>
          <p className={`mt-1 text-sm font-mono uppercase ${style.accent}`}>
            {formatConfidence(alert.confidence)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Created
          </p>
          <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
            {formatTimestamp(alert.created_at)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Correlation
          </p>
          <p className="mt-1 break-all text-sm font-mono text-cyan-700 dark:text-cyan-400">
            {alert.correlation_id || 'not linked'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-gray-800">
        <p className="text-xs text-slate-500 dark:text-gray-500">
          Alert {index + 1} of {total}
        </p>

        {alert.alert_id ? (
          <span className="text-xs font-mono uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
            View detail
          </span>
        ) : (
          <span className="text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-gray-500">
            List only
          </span>
        )}
      </div>
    </div>
  );

  if (alert.alert_id) {
    return (
      <Link href={`/alerts/${alert.alert_id}`} className="block">
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}
