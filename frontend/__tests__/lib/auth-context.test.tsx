import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

describe('AuthProvider', () => {
  it('provides demo identity', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.username).toBe('Demo Operator');
    expect(result.current.role).toBe('analyst');
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });
    expect(result.current).toHaveProperty('username');
    expect(result.current).toHaveProperty('role');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
  });

  it('throws when useAuth is called outside provider', () => {
    // Suppress console.error for the expected error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});
