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

const STORAGE_KEY = 'aegisrange_auth';

function loadAuth(): AuthState {
  if (typeof window === 'undefined') {
    return { token: null, username: null, role: null, isAuthenticated: false };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: result.token,
      username: result.username,
      role: result.role,
      expires_at: result.expires_at,
    }));
  }, []);

  const logout = useCallback(() => {
    setAuth({ token: null, username: null, role: null, isAuthenticated: false });
    localStorage.removeItem(STORAGE_KEY);
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
