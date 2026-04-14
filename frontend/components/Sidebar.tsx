'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useViewport } from '@/lib/responsive';
import { useAuth } from '@/lib/auth-context';
import { useCommandPalette } from './CommandPalette';

const navItems = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/architecture', label: 'Architecture', icon: ArchitectureIcon },
  { href: '/scenarios', label: 'Scenarios', icon: ScenarioIcon },
  { href: '/ops', label: 'Training Ops', icon: OpsIcon },
  { href: '/profile', label: 'Career', icon: CareerIcon },
  { href: '/events', label: 'Events', icon: EventIcon },
  { href: '/alerts', label: 'Alerts', icon: AlertIcon },
  { href: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { href: '/incidents', label: 'Incidents', icon: IncidentIcon },
  { href: '/mitre', label: 'ATT&CK Matrix', icon: MitreIcon },
  { href: '/killchain', label: 'Kill Chain', icon: KillChainIcon },
  { href: '/campaigns', label: 'Campaigns', icon: CampaignIcon },
  { href: '/reports', label: 'Reports', icon: ReportIcon },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { openPalette } = useCommandPalette();
  const { isAuthenticated, username, role, logout } = useAuth();

  const isVisible = isDesktop || open;

  const [modKey, setModKey] = useState('Ctrl');

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform)) {
      setModKey('\u2318');
    }
  }, []);

  return (
    <>
      {!isDesktop && open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-200 dark:border-gray-800 dark:bg-gray-950 dark:shadow-none ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-200 p-4 dark:border-gray-800">
          <Link href="/" className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 transition-shadow group-hover:shadow-cyan-500/40 dark:from-cyan-500 dark:to-indigo-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-cyan-600 dark:text-cyan-400">Aegis</span>
              <span className="text-lg font-bold tracking-tight text-slate-700 dark:text-gray-300">Range</span>
            </div>
          </Link>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-500">
            Cyber Simulation Platform
          </p>
        </div>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => {
              openPalette();
              if (!isDesktop) onClose();
            }}
            className="group flex w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 transition-colors hover:border-cyan-300 hover:bg-slate-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500 dark:hover:border-cyan-500/40 dark:hover:bg-gray-800"
            aria-label="Open command palette"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              className="h-4 w-4 text-slate-400 transition-colors group-hover:text-cyan-600 dark:text-gray-600 dark:group-hover:text-cyan-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="flex-1 text-left text-xs font-mono">Search</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-500">
              {modKey}K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={!isDesktop ? onClose : undefined}
                className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon active={isActive} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-gray-800">
          {isAuthenticated ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Authenticated
                </p>
              </div>
              <p className="truncate font-mono text-xs text-slate-700 dark:text-gray-300">
                {username}
              </p>
              <p className="font-mono text-[10px] uppercase text-slate-400 dark:text-gray-600">
                {role}
              </p>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  if (!isDesktop) onClose();
                  router.push('/login');
                }}
                className="mt-2 font-mono text-[10px] text-slate-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Not signed in
                </p>
              </div>
              <Link
                href="/login"
                onClick={!isDesktop ? onClose : undefined}
                className="inline-block mt-1 font-mono text-xs text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
          <p className="mt-2 font-mono text-[10px] text-slate-300 dark:text-gray-700">v0.6.0</p>
        </div>
      </aside>
    </>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ArchitectureIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 12h16.5M3.75 18.75h16.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 5.25V18.75M16.5 5.25V18.75" />
    </svg>
  );
}

function ScenarioIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

function CareerIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111 5.52.442c.499.04.701.663.321.988l-4.204 3.602 1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 19.64a.562.562 0 01-.84-.61l1.285-5.386-4.204-3.602a.562.562 0 01.321-.988l5.52-.442 2.125-5.111z" />
    </svg>
  );
}

function OpsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

function EventIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}

function AlertIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IncidentIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
    </svg>
  );
}

function MitreIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zM3.75 9.75h16.5M3.75 13.5h16.5M9.75 3.75v16.5M13.5 3.75v16.5" />
    </svg>
  );
}

function KillChainIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.182-5.818l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
    </svg>
  );
}

function CampaignIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5a3 3 0 11-6 0 3 3 0 016 0zM12 16.5a3 3 0 11-6 0 3 3 0 016 0zM21 16.5a3 3 0 11-6 0 3 3 0 016 0zM14.47 9.75l1.56 4.5M9.53 14.25l-1.56-4.5" />
    </svg>
  );
}

function ReportIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6l4.5 4.5v11.25A2.25 2.25 0 0115.75 21h-8A2.25 2.25 0 015.5 18.75V6A2.25 2.25 0 017.75 3.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.75v4.5H18M8.25 12h7.5M8.25 15.75h7.5M8.25 8.25h2.25" />
    </svg>
  );
}