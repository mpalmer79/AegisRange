'use client';

/**
 * Demo-mode AuthGuard — always passes through.
 *
 * Authentication is disabled for the recruiter demo deployment
 * (see lib/auth-context.tsx). This component is kept only so
 * existing imports in AppShell continue to compile; it has no
 * runtime behavior beyond rendering its children.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
