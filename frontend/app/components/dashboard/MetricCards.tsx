'use client';

import Link from 'next/link';
import { Metrics } from '@/lib/types';

interface MetricCard {
  label: string;
  value: number | string;
  color: string;
  bg: string;
  border: string;
  href: string;
}

interface MetricCardsProps {
  metrics: Metrics | null;
}

export default function MetricCards({ metrics }: MetricCardsProps) {
  const metricCards: MetricCard[] = [
    {
      label: 'Total Events',
      value: metrics?.total_events ?? '-',
      color: 'text-cyan-700 dark:text-cyan-300',
      bg: 'bg-gradient-to-br from-cyan-50 to-sky-100 dark:from-cyan-500/10 dark:to-sky-500/10',
      border: 'border-cyan-300/70 dark:border-cyan-500/30',
      href: '/events',
    },
    {
      label: 'Alerts',
      value: metrics?.total_alerts ?? '-',
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-500/10 dark:to-orange-500/10',
      border: 'border-amber-300/70 dark:border-amber-500/30',
      href: '/alerts',
    },
    {
      label: 'Incidents',
      value: metrics?.total_incidents ?? '-',
      color: 'text-rose-700 dark:text-rose-300',
      bg: 'bg-gradient-to-br from-rose-50 to-red-100 dark:from-rose-500/10 dark:to-red-500/10',
      border: 'border-rose-300/70 dark:border-rose-500/30',
      href: '/incidents',
    },
    {
      label: 'Active Containments',
      value: metrics?.active_containments ?? '-',
      color: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-500/10 dark:to-teal-500/10',
      border: 'border-emerald-300/70 dark:border-emerald-500/30',
      href: '/incidents',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 ar-stagger">
      {metricCards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`${card.bg} border ${card.border} rounded-xl p-5 ar-card-hover shadow-sm dark:shadow-none`}
        >
          <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider font-mono mb-2">{card.label}</p>
          <p className={`text-3xl font-bold ${card.color} font-[family-name:var(--font-geist-mono)]`}>{card.value}</p>
        </Link>
      ))}
    </div>
  );
}
