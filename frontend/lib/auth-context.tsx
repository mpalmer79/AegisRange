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
// Auth context
// ------------------------------------------------------------
export interface AuthContextType {
  username: string | null;
  role: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if the user already has a valid session cookie.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled && user) {
          setUsername(user.username);
          setRole(user.role);
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
    const token = await apiLogin(user, password);
    // After login the backend sets an httpOnly auth cookie.
    // Re-probe backend availability now that credentials exist.
    resetBackendProbe();
    setUsername(token.username);
    setRole(token.role);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort — clear local state regardless.
    }
    resetBackendProbe();
    setUsername(null);
    setRole(null);
  }, []);

  const isAuthenticated = username !== null;

  return (
    <AuthContext.Provider
      value={{ username, role, isAuthenticated, loading, login, logout }}
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
