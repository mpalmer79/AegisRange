'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import AuthGuard from './AuthGuard';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <AuthProvider>
      <AuthGuard>
        {!isLoginPage && <Sidebar />}
        <main className={isLoginPage ? 'min-h-screen' : 'ml-56 min-h-screen'}>
          <div className={isLoginPage ? '' : 'p-6 max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </AuthGuard>
    </AuthProvider>
  );
}
