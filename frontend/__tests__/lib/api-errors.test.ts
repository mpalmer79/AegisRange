import { ApiError, getScenarioErrorMessage } from '@/lib/api';

describe('ApiError', () => {
  it('carries status code', () => {
    const err = new ApiError(401, 'Unauthorized');
    expect(err.status).toBe(401);
    expect(err.message).toBe('API 401: Unauthorized');
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
    expect(err.detail).toBeUndefined();
  });

  it('prefers the backend detail in the message when provided', () => {
    const err = new ApiError(401, 'Unauthorized', 'Missing authentication token');
    expect(err.detail).toBe('Missing authentication token');
    expect(err.message).toBe('API 401: Missing authentication token');
  });

  it('falls back to statusText when detail is absent', () => {
    const err = new ApiError(500, 'Internal Server Error');
    expect(err.message).toBe('API 500: Internal Server Error');
  });
});

describe('getScenarioErrorMessage', () => {
  it('maps 401 to sign-in message', () => {
    expect(getScenarioErrorMessage(new ApiError(401, 'Unauthorized'))).toBe(
      'Please sign in to run scenarios.',
    );
  });

  it('maps 403 to permission message', () => {
    expect(getScenarioErrorMessage(new ApiError(403, 'Forbidden'))).toBe(
      'Your account does not have permission to run scenarios.',
    );
  });

  it('maps 429 to rate-limit message', () => {
    expect(getScenarioErrorMessage(new ApiError(429, 'Too Many Requests'))).toBe(
      'Rate limit exceeded. Please wait before running another scenario.',
    );
  });

  it('maps other status codes to generic failure', () => {
    expect(getScenarioErrorMessage(new ApiError(500, 'Internal Server Error'))).toBe(
      'Scenario execution failed (500).',
    );
  });

  it('maps backend-unavailable errors', () => {
    expect(
      getScenarioErrorMessage(new Error('Backend unavailable — scenario execution requires a live authenticated backend')),
    ).toBe('Scenario execution is unavailable right now.');
  });

  it('handles non-Error values', () => {
    expect(getScenarioErrorMessage('oops')).toBe('An unexpected error occurred.');
    expect(getScenarioErrorMessage(null)).toBe('An unexpected error occurred.');
    expect(getScenarioErrorMessage(undefined)).toBe('An unexpected error occurred.');
  });

  it('does not leak raw API error text', () => {
    const msg = getScenarioErrorMessage(new ApiError(401, 'Unauthorized'));
    expect(msg).not.toContain('API 401');
    expect(msg).not.toContain('Unauthorized');
  });
});
