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
// Capability gates
//
// The frontend used to mirror the backend's role ladder (ROLE_LEVELS
// dict + SCENARIO_MIN_LEVEL constant). That meant adding a role or
// retuning a level required a coordinated change on both sides. As
// of 0.9.0 the backend ships capability flags on /auth/me; the
// frontend consults them directly.
//
// Null-safe on input so pre-session / unauthenticated callers just
// get `false` without a capability lookup.
// ------------------------------------------------------------

interface CapabilityBearer {
  capabilities?: readonly string[];
}

function hasCapability(
  user: CapabilityBearer | null | undefined,
  capability: string,
): boolean {
  if (!user || !user.capabilities) return false;
  return user.capabilities.includes(capability);
}

export function canRunScenarios(
  user: CapabilityBearer | null | undefined,
): boolean {
  return hasCapability(user, 'run_scenarios');
}

export function canManageIncidents(
  user: CapabilityBearer | null | undefined,
): boolean {
  return hasCapability(user, 'manage_incidents');
}

export function canAdministerPlatform(
  user: CapabilityBearer | null | undefined,
): boolean {
  return hasCapability(user, 'administer_platform');
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
  level: 50,
  scopes: ['read', 'scenarios'],
  capabilities: ['run_scenarios'],
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
  /** Numeric role level from backend ROLES (0 when unauthenticated). */
  level: number;
  /** Scopes granted to the role (empty list when unauthenticated). */
  scopes: readonly string[];
  /** Capability flags from backend (empty list when unauthenticated). */
  capabilities: readonly string[];
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
  const [level, setLevel] = useState<number>(
    DEMO_MODE ? DEMO_IDENTITY.level : 0,
  );
  const [scopes, setScopes] = useState<readonly string[]>(
    DEMO_MODE ? DEMO_IDENTITY.scopes : [],
  );
  const [capabilities, setCapabilities] = useState<readonly string[]>(
    DEMO_MODE ? DEMO_IDENTITY.capabilities : [],
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
          setLevel(user.level ?? 0);
          setScopes(user.scopes ?? []);
          setCapabilities(user.capabilities ?? []);
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
    // Fetch level/scopes/capabilities — the login response only carries
    // username/role/expiry, but the UI needs capabilities to gate actions.
    try {
      const me = await getCurrentUser();
      if (me) {
        setLevel(me.level ?? 0);
        setScopes(me.scopes ?? []);
        setCapabilities(me.capabilities ?? []);
      }
    } catch {
      // Best-effort — leave capabilities empty if the follow-up fails.
    }
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
    setLevel(0);
    setScopes([]);
    setCapabilities([]);
    setExpiresAt(null);
    clearPersistedExpiry();
  }, []);

  const isAuthenticated = username !== null;

  return (
    <AuthContext.Provider
      value={{
        username,
        role,
        level,
        scopes,
        capabilities,
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
