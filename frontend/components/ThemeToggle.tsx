'use client';

import { useTheme } from '@/lib/theme-context';

interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Large, eye-catching segmented light/dark theme toggle.
 * Designed to be immediately obvious on the home page so users understand
 * they can switch between visual modes.
 */
export default function ThemeToggle({ size = 'lg', className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  const dims = {
    sm: { track: 'h-9 text-xs', pad: 'px-3', icon: 'w-4 h-4' },
    md: { track: 'h-11 text-sm', pad: 'px-4', icon: 'w-4 h-4' },
    lg: { track: 'h-14 text-sm', pad: 'px-5', icon: 'w-5 h-5' },
  }[size];

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={`relative inline-flex items-center rounded-full border-2 border-slate-300 dark:border-gray-700 bg-slate-100/80 dark:bg-gray-900/80 backdrop-blur ${dims.track} shadow-lg shadow-slate-300/30 dark:shadow-cyan-900/20 transition-colors ${className}`}
    >
      {/* Sliding indicator */}
      <span
        aria-hidden
        className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full transition-all duration-500 ease-out ${
          isLight
            ? 'left-1 bg-gradient-to-br from-amber-300 via-orange-400 to-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.55)]'
            : 'left-[calc(50%+0.125rem)] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 shadow-[0_0_24px_rgba(99,102,241,0.55)]'
        }`}
      />

      {/* Light button */}
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={isLight}
        aria-label="Switch to light mode"
        className={`relative z-10 flex items-center gap-2 ${dims.pad} h-full font-semibold tracking-wide uppercase transition-colors ${
          isLight
            ? 'text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]'
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
        }`}
      >
        <SunIcon className={dims.icon} />
        Light
      </button>

      {/* Dark button */}
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={!isLight}
        aria-label="Switch to dark mode"
        className={`relative z-10 flex items-center gap-2 ${dims.pad} h-full font-semibold tracking-wide uppercase transition-colors ${
          !isLight
            ? 'text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]'
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
        }`}
      >
        <MoonIcon className={dims.icon} />
        Dark
      </button>
    </div>
  );
}

function SunIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
