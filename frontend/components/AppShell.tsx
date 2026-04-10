'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { useViewport } from '@/lib/responsive';
import AuthGuard from './AuthGuard';
import Sidebar from './Sidebar';
import { CommandPaletteProvider } from './CommandPalette';

/**
 * Demo-mode shell.
 *
 * Authentication has been removed for the recruiter demo deployment
 * (see lib/auth-context.tsx). The AuthProvider + AuthGuard wrappers
 * are kept as no-op pass-throughs so existing imports still compile.
 * Every route — including "/" — renders the full sidebar + command
 * palette without redirecting anywhere.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isDesktop } = useViewport();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation (mobile/tablet)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  return (
    <AuthProvider>
      <AuthGuard>
        <CommandPaletteProvider>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          {/* Mobile header bar with hamburger */}
          {!isDesktop && (
            <header className="fixed top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-gray-950/95 backdrop-blur border-b border-slate-200 dark:border-gray-800 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 transition-colors"
                aria-label="Open navigation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">Aegis</span>
              <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Range</span>
            </header>
          )}
          <main
            className={
              isDesktop ? 'ml-56 min-h-screen' : 'min-h-screen pt-14'
            }
          >
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>
          </main>
        </CommandPaletteProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
