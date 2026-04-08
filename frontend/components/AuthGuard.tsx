'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && pathname !== '/login') {
      router.replace('/login');
    }
  }, [isAuthenticated, pathname, router]);

  // Login page is always accessible
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show nothing while redirecting to login
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
