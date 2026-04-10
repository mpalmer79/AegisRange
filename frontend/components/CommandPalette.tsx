'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { SCENARIO_DEFINITIONS } from '@/lib/types';
import { TRAINING_OPS } from '@/lib/ops-content';
import { useTheme } from '@/lib/theme-context';
import { usePlayerProgress } from '@/lib/player-progress';
import { getDailyChallenge } from '@/lib/daily-challenge';

/**
 * CommandPalette — Phase 6 global accelerator.
 *
 * A modal search surface triggered by Cmd+K / Ctrl+K (or the sidebar
 * button) that exposes every navigable destination and quick action
 * built so far: scenarios, training ops, career/profile pages, theme
 * toggle, and the current Daily Challenge. Keyboard-first (arrow
 * keys + enter + esc) with basic substring scoring.
 */

export type CommandGroup =
  | 'Quick Actions'
  | 'Scenarios'
  | 'Training Ops'
  | 'Navigate'
  | 'Theme';

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  group: CommandGroup;
  keywords?: string;
  icon: ReactNode;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const GROUP_ORDER: CommandGroup[] = [
  'Quick Actions',
  'Scenarios',
  'Training Ops',
  'Navigate',
  'Theme',
];

// ---------- icons ----------

function Icon({ children }: { children: ReactNode }) {
  // Decorative wrapper — the surrounding command row carries the
  // accessible label through its title text, so the icon itself is
  // hidden from assistive tech.
  return (
    <span
      aria-hidden="true"
      className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-600 dark:text-gray-300"
    >
      {children}
    </span>
  );
}

const IconSvg = {
  bolt: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
    </svg>
  ),
  target: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  grid: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  sun: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  moon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
};

// ---------- filter / scoring ----------

function matches(command: Command, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    command.title.toLowerCase().includes(q) ||
    (command.subtitle?.toLowerCase().includes(q) ?? false) ||
    (command.keywords?.toLowerCase().includes(q) ?? false) ||
    command.group.toLowerCase().includes(q)
  );
}

// ---------- main component ----------

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme, toggleTheme } = useTheme();
  const { progress, hydrated } = usePlayerProgress();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Navigate helper that closes the palette afterward.
  const go = useCallback(
    (href: string) => {
      onClose();
      // Defer navigation a tick so the modal can unmount cleanly.
      setTimeout(() => router.push(href), 0);
    },
    [onClose, router]
  );

  // Build the full command list. Depends on hydrated career data
  // (last mission + daily challenge), theme, and static content.
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    // ----- Quick Actions -----
    const daily = typeof window !== 'undefined' ? getDailyChallenge() : null;
    if (daily) {
      list.push({
        id: 'quick-daily',
        title: `Open today's Daily Challenge`,
        subtitle: `${daily.scenarioName} · ${daily.perspective === 'red' ? 'Red Team' : 'Blue Team'} · ${daily.difficulty}`,
        group: 'Quick Actions',
        keywords: 'daily challenge today bonus',
        icon: <Icon>{IconSvg.calendar}</Icon>,
        run: () => go(`/scenarios/${daily.scenarioId}`),
      });
    }
    list.push({
      id: 'quick-profile',
      title: 'Open Career Profile',
      subtitle: hydrated ? `${progress.totalXp} XP · ${progress.missions.length} missions` : 'View ranks, XP and history',
      group: 'Quick Actions',
      keywords: 'career xp rank achievements profile',
      icon: <Icon>{IconSvg.star}</Icon>,
      run: () => go('/profile'),
    });
    if (hydrated && progress.missions.length > 0) {
      const last = progress.missions[0];
      list.push({
        id: 'quick-last',
        title: `Replay ${last.scenarioName}`,
        subtitle: `Last run · +${last.xpEarned} XP · ${last.perspective === 'red' ? 'Red Team' : 'Blue Team'}`,
        group: 'Quick Actions',
        keywords: 'replay last mission recent',
        icon: <Icon>{IconSvg.bolt}</Icon>,
        run: () => go(`/scenarios/${last.scenarioId}`),
      });
    }

    // ----- Scenarios -----
    for (const s of SCENARIO_DEFINITIONS) {
      list.push({
        id: `scn-${s.id}`,
        title: s.name,
        subtitle: s.description,
        group: 'Scenarios',
        keywords: s.id,
        icon: <Icon>{IconSvg.target}</Icon>,
        run: () => go(`/scenarios/${s.id}`),
      });
    }

    // ----- Training Ops -----
    for (const op of TRAINING_OPS) {
      list.push({
        id: `op-${op.id}`,
        title: op.name,
        subtitle: `${op.codename} · ${op.missions.length} missions · ${op.tagline}`,
        group: 'Training Ops',
        keywords: `${op.codename} ${op.difficulty} training op campaign`,
        icon: <Icon>{IconSvg.shield}</Icon>,
        run: () => go(`/ops/${op.id}`),
      });
    }

    // ----- Navigate -----
    const nav: Array<[string, string, string]> = [
      ['Dashboard', '/', 'home overview'],
      ['Scenarios Library', '/scenarios', 'library all'],
      ['Training Ops', '/ops', 'campaigns chains'],
      ['Career Profile', '/profile', 'progression xp'],
      ['Events', '/events', 'logs telemetry'],
      ['Alerts', '/alerts', 'detections siem'],
      ['Incidents', '/incidents', 'cases'],
      ['Analytics', '/analytics', 'risk rules'],
      ['ATT&CK Matrix', '/mitre', 'mitre attack tactics techniques'],
      ['Kill Chain', '/killchain', 'stages progression'],
      ['Campaigns', '/campaigns', 'threat adversary'],
      ['Reports', '/reports', 'exercise debrief'],
    ];
    for (const [title, href, keywords] of nav) {
      list.push({
        id: `nav-${href}`,
        title,
        subtitle: href,
        group: 'Navigate',
        keywords,
        icon: <Icon>{IconSvg.list}</Icon>,
        run: () => go(href),
      });
    }

    // ----- Theme -----
    list.push({
      id: 'theme-light',
      title: 'Switch to Light Mode',
      subtitle: theme === 'light' ? 'Already active' : 'Bright daylight UI',
      group: 'Theme',
      keywords: 'light theme day bright',
      icon: <Icon>{IconSvg.sun}</Icon>,
      run: () => {
        setTheme('light');
        onClose();
      },
    });
    list.push({
      id: 'theme-dark',
      title: 'Switch to Dark Mode',
      subtitle: theme === 'dark' ? 'Already active' : 'Classic SOC dark UI',
      group: 'Theme',
      keywords: 'dark theme night soc',
      icon: <Icon>{IconSvg.moon}</Icon>,
      run: () => {
        setTheme('dark');
        onClose();
      },
    });
    list.push({
      id: 'theme-toggle',
      title: 'Toggle Theme',
      subtitle: theme === 'dark' ? 'Dark → Light' : 'Light → Dark',
      group: 'Theme',
      keywords: 'toggle flip theme',
      icon: <Icon>{theme === 'dark' ? IconSvg.sun : IconSvg.moon}</Icon>,
      run: () => {
        toggleTheme();
        onClose();
      },
    });

    return list;
  }, [go, hydrated, progress, theme, setTheme, toggleTheme, onClose]);

  const filtered = useMemo(
    () => commands.filter((c) => matches(c, query)),
    [commands, query]
  );

  // Flatten groups in a stable display order.
  const grouped = useMemo(() => {
    const buckets = new Map<CommandGroup, Command[]>();
    for (const g of GROUP_ORDER) buckets.set(g, []);
    for (const cmd of filtered) {
      buckets.get(cmd.group)?.push(cmd);
    }
    return GROUP_ORDER.filter((g) => (buckets.get(g)?.length ?? 0) > 0).map(
      (g) => ({ group: g, commands: buckets.get(g)! })
    );
  }, [filtered]);

  // Flat index for cursor navigation regardless of grouping.
  const flatCommands = useMemo(
    () => grouped.flatMap((g) => g.commands),
    [grouped]
  );

  // Reset cursor + query when opening / when results change, and
  // save the previously focused element so we can restore focus on
  // close (accessibility requirement for dialogs).
  useEffect(() => {
    if (open) {
      previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
      setQuery('');
      setCursor(0);
      // Focus the search input after the dialog mounts.
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      // Return focus to whatever was focused before we opened.
      // Wait a tick so the unmount settles before refocusing.
      const target = previouslyFocused.current;
      if (target && typeof target.focus === 'function') {
        setTimeout(() => target.focus(), 0);
      }
    }
  }, [open]);

  // Body scroll lock while the palette is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus trap: cycle Tab / Shift+Tab within the dialog so focus
  // cannot escape to background content while the palette is open.
  useEffect(() => {
    if (!open) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  useEffect(() => {
    // Keep cursor in bounds as the list shrinks while typing.
    if (cursor >= flatCommands.length) {
      setCursor(Math.max(0, flatCommands.length - 1));
    }
  }, [flatCommands.length, cursor]);

  // Scroll the active row into view.
  useEffect(() => {
    if (!open) return;
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-cmd-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  // Global keyboard handling while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(flatCommands.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatCommands[cursor];
        if (cmd) cmd.run();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, cursor, flatCommands, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 ar-fade-in-slow"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl rounded-2xl border-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-2xl overflow-hidden ar-bounce-in"
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-gray-800">
          <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-slate-500 dark:text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Search scenarios, ops, pages, or theme..."
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-600 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-700 text-[10px] font-mono text-slate-500 dark:text-gray-500">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {grouped.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-gray-500">
              No matches for <span className="font-mono text-slate-700 dark:text-gray-300">{query}</span>.
            </p>
          ) : (
            grouped.map(({ group, commands: cmds }) => (
              <div key={group} className="mb-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 dark:text-gray-600">
                  {group}
                </p>
                {cmds.map((cmd) => {
                  const flatIdx = flatCommands.indexOf(cmd);
                  const isActive = flatIdx === cursor;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-cmd-index={flatIdx}
                      onMouseEnter={() => setCursor(flatIdx)}
                      onClick={() => cmd.run()}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-gray-900'
                      }`}
                    >
                      {cmd.icon}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-gray-100'}`}>
                          {cmd.title}
                        </p>
                        {cmd.subtitle && (
                          <p className="text-[11px] font-mono text-slate-500 dark:text-gray-500 truncate">
                            {cmd.subtitle}
                          </p>
                        )}
                      </div>
                      <span aria-hidden="true" className={`shrink-0 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-300 dark:text-gray-700'}`}>
                        {IconSvg.arrowRight}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50 text-[10px] font-mono text-slate-500 dark:text-gray-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-700">&uarr;</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-700">&darr;</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-700">&crarr;</kbd>
              select
            </span>
          </div>
          <span>{flatCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Provider + hook so any component can trigger the palette.
// AppShell mounts a single <CommandPalette> bound to this state
// and installs the global Cmd+K listener.
// ============================================================

interface CommandPaletteContextValue {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(
  undefined
);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((o) => !o), []);

  // Global Cmd/Ctrl+K listener. Installed once at the provider level
  // so every page can trigger the palette without extra wiring.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <CommandPaletteContext.Provider
      value={{ open, openPalette, closePalette, togglePalette }}
    >
      {children}
      <CommandPalette open={open} onClose={closePalette} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return ctx;
}
