'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { platformLogin } from './api';

interface AuthState {
  token: string | null;
  username: string | null;
  role: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  authHeaders: Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Session-scoped storage key.  We use sessionStorage (not localStorage)
 * so tokens are scoped to the browser tab and cleared on close.
 * This reduces the exposure window compared to localStorage which
 * persists across tabs and browser restarts.
 *
 * NOTE: Any JS-accessible storage is vulnerable to XSS.  The real
 * mitigation is the strict CSP and input sanitisation enforced by
 * the Next.js framework.  A full httpOnly-cookie auth flow would
 * require backend Set-Cookie support (future enhancement).
 */
const STORAGE_KEY = 'aegisrange_auth';

function loadAuth(): AuthState {
  if (typeof window === 'undefined') {
    return { token: null, username: null, role: null, isAuthenticated: false };
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.token && parsed.expires_at) {
        const expiry = new Date(parsed.expires_at);
        if (expiry > new Date()) {
          return {
            token: parsed.token,
            username: parsed.username,
            role: parsed.role,
            isAuthenticated: true,
          };
        }
      }
    }
  } catch {
    // Corrupted storage
  }
  return { token: null, username: null, role: null, isAuthenticated: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => loadAuth());

  const login = useCallback(async (username: string, password: string) => {
    const result = await platformLogin(username, password);
    const state: AuthState = {
      token: result.token,
      username: result.username,
      role: result.role,
      isAuthenticated: true,
    };
    setAuth(state);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: result.token,
      username: result.username,
      role: result.role,
      expires_at: result.expires_at,
    }));
  }, []);

  const logout = useCallback(() => {
    setAuth({ token: null, username: null, role: null, isAuthenticated: false });
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const authHeaders: Record<string, string> = auth.token
    ? { Authorization: `Bearer ${auth.token}` }
    : {};

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, authHeaders }}>
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
