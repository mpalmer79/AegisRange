'use client';

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export default function LoadingSkeleton({ lines = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-4 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 rounded bg-slate-200 dark:bg-gray-700" style={{ width: `${85 - i * 10}%` }} />
          <div className="h-3 rounded bg-slate-100 dark:bg-gray-800" style={{ width: `${70 - i * 5}%` }} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 h-5 w-1/3 rounded bg-slate-200 dark:bg-gray-700" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-slate-100 dark:bg-gray-800" />
        <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-gray-800" />
        <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-2 h-3 w-2/3 rounded bg-slate-200 dark:bg-gray-700" />
          <div className="h-8 w-1/2 rounded bg-slate-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
