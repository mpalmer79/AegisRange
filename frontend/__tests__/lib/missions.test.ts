/**
 * Mission API client: Phase 1 contract.
 *
 * These tests exercise the request shape rather than running a real
 * backend. We stub `fetch` and assert that the mission endpoints are
 * hit with the expected method / path / body.
 */

import type { MissionSnapshot } from '@/lib/types';

const ORIGINAL_FETCH = global.fetch;

function makeResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function snapshotFixture(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
    run_id: 'run-abc',
    scenario_id: 'scn-auth-001',
    perspective: 'blue',
    difficulty: 'analyst',
    correlation_id: 'corr-xyz',
    status: 'complete',
    created_at: '2026-04-17T00:00:00Z',
    operated_by: null,
    summary: null,
    ...overrides,
  };
}

describe('missions API client', () => {
  beforeEach(() => {
    jest.resetModules();
    // Treat the backend as reachable so liveOrThrow proceeds.
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return makeResponse({ status: 'ok' });
      }
      return makeResponse({});
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('startMission POSTs to /missions with the expected body', async () => {
    const mockFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) return makeResponse({ status: 'ok' });
      expect(url.endsWith('/missions')).toBe(true);
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(
        JSON.stringify({ scenario_id: 'scn-auth-001', perspective: 'red' }),
      );
      return makeResponse(snapshotFixture({ perspective: 'red' }));
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

    const { startMission } = await import('@/lib/api');
    const result = await startMission({
      scenario_id: 'scn-auth-001',
      perspective: 'red',
    });
    expect(result.run_id).toBe('run-abc');
    expect(result.perspective).toBe('red');
  });

  it('getMissionIncident GETs /missions/{runId}/incident', async () => {
    const mockFetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) return makeResponse({ status: 'ok' });
      expect(url.endsWith('/missions/run-abc/incident')).toBe(true);
      return makeResponse({
        incident_id: 'inc-1',
        correlation_id: 'corr-xyz',
        incident_type: 'credential_abuse',
        status: 'open',
        primary_actor_id: 'user-bob',
        actor_type: 'user',
        actor_role: 'employee',
        severity: 'high',
        confidence: 'high',
        risk_score: 80,
        detection_ids: [],
        detection_summary: [],
        response_ids: [],
        containment_status: 'none',
        event_ids: [],
        affected_documents: [],
        affected_sessions: [],
        affected_services: [],
        affected_resources: { documents: [], sessions: [], services: [], policies: [] },
        timeline: [],
        created_at: '2026-04-17T00:00:00Z',
        updated_at: '2026-04-17T00:00:00Z',
        notes: [],
      });
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

    const { getMissionIncident } = await import('@/lib/api');
    const incident = await getMissionIncident('run-abc');
    expect(incident.incident_id).toBe('inc-1');
  });
});
