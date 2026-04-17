/**
 * Mission API client: Phase 1–3 contract.
 *
 * These tests assert the request shape and response parsing of the
 * mission endpoints. They stub ``global.fetch`` per test and inspect
 * ``fetchMock.mock.calls`` after the fact — no assertions inside the
 * mock, no dynamic imports, so there's nothing timing-sensitive.
 */

import {
  startMission,
  getMissionIncident,
  submitMissionCommand,
  __setBackendAvailableForTests,
} from '@/lib/api';

/**
 * Minimal duck-typed Response for jsdom envs where ``global.Response``
 * isn't polyfilled. The production ``request()`` helper only reads
 * ``ok`` / ``status`` / ``statusText`` / ``headers.get('content-type')``
 * / ``json()`` / ``text()``, so a plain object that exposes those is
 * enough to drive the code under test.
 */
function jsonResponse(body: unknown, status = 200): Response {
  const headersMap: Record<string, string> = {
    'content-type': 'application/json',
  };
  const fake = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: {
      get: (key: string) => headersMap[key.toLowerCase()] ?? null,
      forEach: (_cb: (value: string, key: string) => void) => {
        /* no-op */
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  return fake as unknown as Response;
}

function snapshotFixture(perspective: 'red' | 'blue' = 'blue') {
  return {
    run_id: 'run-abc',
    scenario_id: 'scn-auth-001',
    perspective,
    difficulty: 'analyst',
    correlation_id: 'corr-xyz',
    status: 'complete',
    created_at: '2026-04-17T00:00:00Z',
    operated_by: null,
    summary: null,
    commands_issued: [],
    xp_delta: 0,
  };
}

function incidentFixture() {
  return {
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
  };
}

function commandResponseFixture() {
  return {
    kind: 'ok' as const,
    lines: ['2 alert(s):', '  AL-1  DET-AUTH-001  high  actor=user-alice'],
    effects: {},
    verb_key: 'alerts list',
    commands_issued: ['alerts list'],
    xp_delta: 0,
  };
}

describe('missions API client', () => {
  let fetchMock: jest.Mock;
  const ORIGINAL_FETCH = global.fetch;

  beforeAll(() => {
    // Skip the real /health probe — we're only asserting request shape,
    // not reachability. Keeps the test deterministic regardless of
    // jsdom fetch polyfills.
    __setBackendAvailableForTests(true);
  });

  afterAll(() => {
    __setBackendAvailableForTests(null);
    global.fetch = ORIGINAL_FETCH;
  });

  beforeEach(() => {
    fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      // Return an incident for /missions/<id>/incident, a command
      // response for /missions/<id>/commands, and a mission snapshot
      // for anything else under /missions.
      if (url.endsWith('/incident')) return jsonResponse(incidentFixture());
      if (url.endsWith('/commands')) return jsonResponse(commandResponseFixture());
      if (/\/missions(?:\/.*)?$/.test(url)) return jsonResponse(snapshotFixture());
      return jsonResponse({}, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('startMission POSTs to /missions with the expected body', async () => {
    const result = await startMission({
      scenario_id: 'scn-auth-001',
      perspective: 'red',
    });
    expect(result.run_id).toBe('run-abc');

    const missionsCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/missions'),
    );
    expect(missionsCalls.length).toBe(1);
    const init = missionsCalls[0][1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({
      scenario_id: 'scn-auth-001',
      perspective: 'red',
    });
  });

  it('getMissionIncident GETs /missions/{runId}/incident', async () => {
    const incident = await getMissionIncident('run-abc');
    expect(incident.incident_id).toBe('inc-1');

    const incidentCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/missions/run-abc/incident'),
    );
    expect(incidentCalls.length).toBe(1);
  });

  it('submitMissionCommand POSTs the raw command to /missions/{runId}/commands', async () => {
    const response = await submitMissionCommand('run-abc', 'alerts list');
    expect(response.kind).toBe('ok');
    expect(response.commands_issued).toEqual(['alerts list']);

    const commandCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/missions/run-abc/commands'),
    );
    expect(commandCalls.length).toBe(1);
    const init = commandCalls[0][1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({
      command: 'alerts list',
    });
  });
});
