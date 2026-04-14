import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, canRunScenarios } from '@/lib/auth-context';

// ---------------------------------------------------------------------------
// Mocks — intercept the real api.ts functions so tests run without a backend.
// ---------------------------------------------------------------------------
const mockGetCurrentUser = jest.fn();
const mockPlatformLogin = jest.fn();
const mockPlatformLogout = jest.fn();
const mockResetBackendProbe = jest.fn();

jest.mock('@/lib/api', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  platformLogin: (...args: unknown[]) => mockPlatformLogin(...args),
  platformLogout: (...args: unknown[]) => mockPlatformLogout(...args),
  resetBackendProbe: (...args: unknown[]) => mockResetBackendProbe(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no existing session.
  mockGetCurrentUser.mockResolvedValue(null);
});

describe('AuthProvider', () => {
  it('starts in loading state and resolves to unauthenticated when no session exists', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Initially loading.
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.username).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('hydrates auth state from existing backend session', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'red_team1',
      role: 'red_team',
      display_name: 'Red Team Operator',
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.username).toBe('red_team1');
    expect(result.current.role).toBe('red_team');
  });

  it('login() sets auth state from backend response', async () => {
    mockPlatformLogin.mockResolvedValue({
      username: 'analyst1',
      role: 'analyst',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login('analyst1', 'analyst1_pass');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.username).toBe('analyst1');
    expect(result.current.role).toBe('analyst');
    expect(mockResetBackendProbe).toHaveBeenCalled();
  });

  it('login() propagates errors on invalid credentials', async () => {
    const apiError = new Error('API 401: Unauthorized');
    mockPlatformLogin.mockRejectedValue(apiError);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('bad', 'creds');
      }),
    ).rejects.toThrow('API 401');

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout() clears auth state', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'admin',
      role: 'admin',
      display_name: 'Admin',
    });
    mockPlatformLogout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.username).toBeNull();
    expect(result.current.role).toBeNull();
    expect(mockResetBackendProbe).toHaveBeenCalled();
  });

  it('logout() clears state even when backend call fails', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'admin',
      role: 'admin',
      display_name: 'Admin',
    });
    mockPlatformLogout.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    // State is cleared regardless.
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns expected context shape', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('username');
    expect(result.current).toHaveProperty('role');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
  });

  it('throws when useAuth is called outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});

describe('canRunScenarios', () => {
  it('returns true for roles with level >= 50', () => {
    expect(canRunScenarios('admin')).toBe(true);
    expect(canRunScenarios('soc_manager')).toBe(true);
    expect(canRunScenarios('analyst')).toBe(true);
    expect(canRunScenarios('red_team')).toBe(true);
  });

  it('returns false for viewer role', () => {
    expect(canRunScenarios('viewer')).toBe(false);
  });

  it('returns false for null role', () => {
    expect(canRunScenarios(null)).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(canRunScenarios('unknown')).toBe(false);
  });
});
