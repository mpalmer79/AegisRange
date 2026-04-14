'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  platformLogin as apiLogin,
  platformLogout as apiLogout,
  getCurrentUser,
  resetBackendProbe,
} from './api';

// ------------------------------------------------------------
// Role hierarchy — mirrors backend ROLES dict so the frontend
// can gate UI elements without an extra round-trip.
// ------------------------------------------------------------
const ROLE_LEVELS: Record<string, number> = {
  admin: 100,
  soc_manager: 75,
  analyst: 50,
  red_team: 50,
  viewer: 25,
};

/** Minimum role level required to execute scenarios (matches backend require_role("red_team")). */
const SCENARIO_MIN_LEVEL = 50;

export function canRunScenarios(role: string | null): boolean {
  if (!role) return false;
  return (ROLE_LEVELS[role] ?? 0) >= SCENARIO_MIN_LEVEL;
}

// ------------------------------------------------------------
// Demo mode
//
// When NEXT_PUBLIC_DEMO_MODE=true the frontend presents a
// static red_team identity without contacting the backend for
// authentication.  The demo identity is clearly labelled in
// the UI ("Demo Mode") and never masquerades as a real session.
//
// All other data-fetching still goes through the live-first /
// mock-fallback path in api.ts, so the demo works with or
// without a live backend.
// ------------------------------------------------------------
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const DEMO_IDENTITY = {
  username: 'demo-operator',
  role: 'red_team',
} as const;

// ------------------------------------------------------------
// Session expiry persistence
// ------------------------------------------------------------
const EXPIRY_KEY = 'aegisrange_session_expires';

function persistExpiry(expiresAt: string): void {
  try {
    sessionStorage.setItem(EXPIRY_KEY, expiresAt);
  } catch {
    /* SSR or storage unavailable */
  }
}

function readPersistedExpiry(): string | null {
  try {
    return sessionStorage.getItem(EXPIRY_KEY);
  } catch {
    return null;
  }
}

function clearPersistedExpiry(): void {
  try {
    sessionStorage.removeItem(EXPIRY_KEY);
  } catch {
    /* SSR or storage unavailable */
  }
}

// ------------------------------------------------------------
// Auth context
// ------------------------------------------------------------
export interface AuthContextType {
  username: string | null;
  role: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  demoMode: boolean;
  expiresAt: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(
    DEMO_MODE ? DEMO_IDENTITY.username : null,
  );
  const [role, setRole] = useState<string | null>(
    DEMO_MODE ? DEMO_IDENTITY.role : null,
  );
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // On mount, check if the user already has a valid session cookie.
  // Skipped entirely in demo mode.
  useEffect(() => {
    if (DEMO_MODE) return;

    // Restore persisted session expiry so the sidebar can show it
    // even after a page reload.
    const stored = readPersistedExpiry();
    if (stored) setExpiresAt(stored);

    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        if (user) {
          setUsername(user.username);
          setRole(user.role);
        } else {
          // Backend says no session — clear stale expiry.
          clearPersistedExpiry();
          setExpiresAt(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    if (DEMO_MODE) return;
    const token = await apiLogin(user, password);
    resetBackendProbe();
    setUsername(token.username);
    setRole(token.role);
    setExpiresAt(token.expires_at);
    persistExpiry(token.expires_at);
  }, []);

  const logout = useCallback(async () => {
    if (DEMO_MODE) return;
    try {
      await apiLogout();
    } catch {
      // Best-effort — clear local state regardless.
    }
    resetBackendProbe();
    setUsername(null);
    setRole(null);
    setExpiresAt(null);
    clearPersistedExpiry();
  }, []);

  const isAuthenticated = username !== null;

  return (
    <AuthContext.Provider
      value={{
        username,
        role,
        isAuthenticated,
        loading,
        demoMode: DEMO_MODE,
        expiresAt,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
