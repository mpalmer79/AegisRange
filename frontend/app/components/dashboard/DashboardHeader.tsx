'use client';

import PlayerCard from '@/components/PlayerCard';
import DailyChallengeCard from '@/components/DailyChallengeCard';
import ThemeToggle from '@/components/ThemeToggle';
import { HealthStatus } from '@/lib/types';

interface DashboardHeaderProps {
  health: HealthStatus | null;
  onRefresh: () => void;
}

export default function DashboardHeader({ health, onRefresh }: DashboardHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 ar-fade-in">
        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              <span className="ar-gradient-text">Dashboard</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Security Operations Overview</p>
          </div>
          <PlayerCard />
          <DailyChallengeCard />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
            health?.status === 'healthy' || health?.status === 'ok'
              ? 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : health
              ? 'bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
              : 'bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-slate-500 dark:text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              health?.status === 'healthy' || health?.status === 'ok'
                ? 'bg-emerald-500 animate-pulse'
                : health
                ? 'bg-rose-500'
                : 'bg-slate-400 dark:bg-gray-600'
            }`} />
            {health ? health.status.toUpperCase() : 'UNKNOWN'}
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-mono bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-300 dark:border-gray-700 rounded text-slate-700 dark:text-gray-300 transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Prominent theme toggle banner */}
      <section
        aria-label="Appearance settings"
        className="relative overflow-hidden mb-8 ar-slide-up rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-gradient-to-br from-white via-sky-50 to-indigo-50 dark:from-gray-900 dark:via-indigo-950/40 dark:to-gray-900 p-5 sm:p-6 shadow-lg shadow-slate-200/60 dark:shadow-black/40"
      >
        {/* Decorative orbs */}
        <div aria-hidden className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-amber-300/40 via-orange-300/30 to-transparent blur-3xl ar-drift" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-gradient-to-tr from-indigo-500/30 via-violet-500/20 to-transparent blur-3xl ar-drift-reverse" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-[11px] font-mono tracking-[0.2em] text-slate-500 dark:text-gray-500 uppercase mb-1">
              Appearance
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-gray-100">
              Pick your visual mode
            </h2>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 max-w-md">
              Toggle between a bright daylight UI and the classic SOC dark theme. Your choice is remembered across sessions.
            </p>
          </div>
          <div className="flex-shrink-0">
            <ThemeToggle size="lg" />
          </div>
        </div>
      </section>
    </>
  );
}
