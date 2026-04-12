import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@/lib/hooks/useApi';

describe('useApi', () => {
  it('returns loading state initially', () => {
    const fetcher = jest.fn(() => new Promise<string>(() => {})); // never resolves
    const { result } = renderHook(() => useApi(fetcher));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns data on success', async () => {
    const fetcher = jest.fn(() => Promise.resolve({ items: [1, 2, 3] }));
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error('Network error')));
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('refetch triggers a new fetch', async () => {
    let callCount = 0;
    const fetcher = jest.fn(() => Promise.resolve(++callCount));
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(1);

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
  });
});
