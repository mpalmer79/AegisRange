'use client';

import { createContext, useContext, ReactNode } from 'react';

// ============================================================
// Demo-mode auth context.
//
// This deployment is a read-only recruiter demo — authentication is
// disabled entirely. The context still exists so components that
// historically called useAuth() keep compiling, but it returns a
// static "Demo Operator" identity and no-op login/logout functions.
// No backend calls, no redirects, no login page.
// ============================================================

interface AuthContextType {
  username: string | null;
  role: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const DEMO_IDENTITY: Omit<AuthContextType, 'login' | 'logout'> = {
  username: 'Demo Operator',
  role: 'analyst',
  isAuthenticated: true,
};

const noop = async () => {
  /* demo mode */
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ ...DEMO_IDENTITY, login: noop, logout: noop }}>
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
