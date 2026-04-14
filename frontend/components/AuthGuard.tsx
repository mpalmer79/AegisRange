'use client';

import { useAuth } from '@/lib/auth-context';

/**
 * AuthGuard — shows a loading indicator while the initial
 * session check is in flight. Once resolved, renders children
 * regardless of auth state (individual pages decide their own
 * access requirements).
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-950">
        <div className="text-cyan-600 dark:text-cyan-400 font-mono text-sm animate-pulse">
          Initializing...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
