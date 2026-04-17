import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, canRunScenarios, DEMO_MODE } from '@/lib/auth-context';

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
  // Clear sessionStorage between tests.
  sessionStorage.clear();
});

describe('AuthProvider', () => {
  it('starts in loading state and resolves to unauthenticated when no session exists', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Initially loading (unless demo mode).
    if (!DEMO_MODE) {
      expect(result.current.loading).toBe(true);
    }

    await waitFor(() => expect(result.current.loading).toBe(false));

    if (!DEMO_MODE) {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.username).toBeNull();
      expect(result.current.role).toBeNull();
    }
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
    expect(result.current.username).toBe(DEMO_MODE ? 'demo-operator' : 'red_team1');
    expect(result.current.role).toBe(DEMO_MODE ? 'red_team' : 'red_team');
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

    await act(async () => {
      await result.current.login('analyst1', 'analyst1_pass');
    });

    if (!DEMO_MODE) {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.username).toBe('analyst1');
      expect(result.current.role).toBe('analyst');
      expect(result.current.expiresAt).toBeTruthy();
      expect(mockResetBackendProbe).toHaveBeenCalled();
    }
  });

  it('login() persists expiresAt to sessionStorage', async () => {
    const expiry = new Date(Date.now() + 3_600_000).toISOString();
    mockPlatformLogin.mockResolvedValue({
      username: 'analyst1',
      role: 'analyst',
      expires_at: expiry,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('analyst1', 'analyst1_pass');
    });

    if (!DEMO_MODE) {
      expect(sessionStorage.getItem('aegisrange_session_expires')).toBe(expiry);
    }
  });

  it('login() propagates errors on invalid credentials', async () => {
    if (DEMO_MODE) return; // demo mode login is a no-op

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

    if (!DEMO_MODE) {
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.username).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.expiresAt).toBeNull();
      expect(mockResetBackendProbe).toHaveBeenCalled();
    }
  });

  it('logout() clears state even when backend call fails', async () => {
    if (DEMO_MODE) return; // demo mode logout is a no-op

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

  it('logout() clears sessionStorage expiry', async () => {
    if (DEMO_MODE) return;

    sessionStorage.setItem('aegisrange_session_expires', '2099-01-01T00:00:00Z');
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

    expect(sessionStorage.getItem('aegisrange_session_expires')).toBeNull();
  });

  it('exposes demoMode flag', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.demoMode).toBe(DEMO_MODE);
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
    expect(result.current).toHaveProperty('demoMode');
    expect(result.current).toHaveProperty('expiresAt');
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
  it('returns true when the user carries the run_scenarios capability', () => {
    expect(canRunScenarios({ capabilities: ['run_scenarios'] })).toBe(true);
    expect(
      canRunScenarios({
        capabilities: ['run_scenarios', 'manage_incidents', 'view_analytics'],
      }),
    ).toBe(true);
  });

  it('returns false when the capability is absent', () => {
    expect(canRunScenarios({ capabilities: [] })).toBe(false);
    expect(canRunScenarios({ capabilities: ['view_analytics'] })).toBe(false);
  });

  it('returns false for null or undefined input', () => {
    expect(canRunScenarios(null)).toBe(false);
    expect(canRunScenarios(undefined)).toBe(false);
  });

  it('returns false when capabilities field is missing', () => {
    expect(canRunScenarios({})).toBe(false);
  });
});
