'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password.trim());
      router.push('/');
    } catch {
      setError('Invalid credentials. Try admin / admin_pass');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-cyan-600 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">
            <span className="text-cyan-400">Aegis</span>
            <span className="text-gray-300">Range</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">Security Operations Platform</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2.5 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="admin_pass"
              className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2.5 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-sm uppercase tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick reference */}
        <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Demo Credentials</p>
          <div className="space-y-1 text-xs font-mono text-gray-400">
            <div className="flex justify-between"><span>admin</span><span className="text-gray-600">admin_pass</span></div>
            <div className="flex justify-between"><span>analyst1</span><span className="text-gray-600">analyst1_pass</span></div>
            <div className="flex justify-between"><span>red_team1</span><span className="text-gray-600">red_team1_pass</span></div>
            <div className="flex justify-between"><span>viewer1</span><span className="text-gray-600">viewer1_pass</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
