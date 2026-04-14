'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard.
  if (isAuthenticated) {
    router.replace('/');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 401:
            setError('Invalid username or password.');
            break;
          case 429:
            setError('Too many login attempts. Please wait and try again.');
            break;
          default:
            setError(`Login failed (${err.status}).`);
        }
      } else if (err instanceof Error) {
        if (err.message.includes('abort') || err.message.includes('timeout')) {
          setError('Unable to reach the server. Please try again.');
        } else {
          setError('Login service is unavailable.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight text-cyan-600 dark:text-cyan-400">
              Aegis
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-700 dark:text-gray-300">
              Range
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg shadow-sm p-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-1">
            Sign in
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mb-6">
            Authenticate to access the simulation platform.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Role reference — dev-only hint */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-gray-800">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-gray-600 mb-2">
              Platform Roles
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['admin', 'soc_manager', 'analyst', 'red_team', 'viewer'].map(
                (r) => (
                  <span
                    key={r}
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500"
                  >
                    {r}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
