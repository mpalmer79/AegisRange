'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { platformLogin, platformLogout, getCurrentUser } from './api';

interface AuthState {
  username: string | null;
  role: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Authentication is cookie-based.  The JWT token is stored in an
 * httpOnly cookie set by the backend — it never touches JavaScript.
 *
 * React state holds only non-secret UI metadata (username, role)
 * needed for rendering role-gated components.  On mount we call
 * GET /auth/me to check if the cookie is still valid.
 */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    username: null,
    role: null,
    isAuthenticated: false,
  });

  // On mount, check if the httpOnly cookie is still valid
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setAuth({
          username: user.username,
          role: user.role,
          isAuthenticated: true,
        });
      })
      .catch(() => {
        // No valid cookie — stay logged out
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await platformLogin(username, password);
    // The httpOnly cookie was set by the backend response.
    // We only store non-secret UI metadata in React state.
    setAuth({
      username: result.username,
      role: result.role,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await platformLogout();
    } catch {
      // Best-effort — clear local state regardless
    }
    setAuth({ username: null, role: null, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
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
