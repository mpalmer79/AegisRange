// ============================================================
// AegisRange API Client — Live-First with Mock Fallback
//
// Every endpoint tries the real backend first. If the backend
// is reachable and returns a valid response, that's what gets
// rendered. If the backend is unreachable, the request fails,
// or the response is malformed, we fall back to realistic mock
// data from lib/mock-data.ts so the UI is never empty.
//
// This lets the recruiter demo work in three deployment modes:
//   1. Full live backend           → real data everywhere
//   2. Partial backend (some 401)  → real where allowed, mock elsewhere
//   3. No backend at all           → mock data everywhere
//
// On the first call a single `/health` probe (with a 2.5s
// timeout) decides whether the backend is reachable. If the
// probe fails, subsequent calls skip the network entirely and
// return mock data instantly — no hanging, no error toasts.
//
// Data is populated in slices:
//   A.1 — metrics + health                (this commit)
//   A.2 — events + alerts
//   A.3 — incidents
//   B   — analytics
//   C   — MITRE / killchain / campaigns / reports
// ============================================================

import {
  HealthStatus,
  Event,
  Alert,
  Incident,
  Metrics,
  ScenarioResult,
  LoginRequest,
  LoginResponse,
  DocumentRequest,
  IncidentStatus,
  IncidentResponse,
  RiskProfile,
  RuleEffectiveness,
  ScenarioHistoryEntry,
  IncidentNote,
  EventExport,
  TTPMapping,
  MitreCoverageEntry,
  TacticCoverage,
  MitreTechnique,
  KillChainAnalysis,
  Campaign,
  ExerciseReport,
  AuthToken,
  CurrentUser,
  PlatformUser,
  MissionDifficulty,
  MissionPerspective,
  MissionSnapshot,
  MissionCommandResponse,
  MissionHelp,
} from './types';

// ------------------------------------------------------------
// Typed API error — carries the HTTP status code so callers
// can distinguish 401 / 403 / 5xx without parsing strings.
// The optional `detail` is pulled from a JSON `{ "detail": "..." }`
// body when the backend supplies one, so UI surfaces can render
// the real reason instead of a bare status line.
// ------------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    statusText: string,
    public readonly detail?: string,
  ) {
    super(`API ${status}: ${detail ?? statusText}`);
    this.name = 'ApiError';
  }
}

/** Map a scenario-execution error to a user-facing message. */
export function getScenarioErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Please sign in to run scenarios.';
      case 403:
        return 'Your account does not have permission to run scenarios.';
      case 429:
        return 'Rate limit exceeded. Please wait before running another scenario.';
      default:
        return `Scenario execution failed (${error.status}).`;
    }
  }
  if (error instanceof Error) {
    if (error.message.includes('Backend unavailable')) {
      return 'Scenario execution is unavailable right now.';
    }
  }
  return 'An unexpected error occurred.';
}
import {
  filterAlerts,
  filterEvents,
  MOCK_ALERTS,
  MOCK_CAMPAIGNS,
  MOCK_EVENTS,
  MOCK_EXERCISE_REPORT,
  MOCK_HEALTH,
  MOCK_INCIDENTS,
  MOCK_KILL_CHAIN_ANALYSES,
  MOCK_METRICS,
  MOCK_MITRE_COVERAGE,
  MOCK_MITRE_TECHNIQUES,
  MOCK_PLATFORM_USERS,
  MOCK_RESPONSES,
  MOCK_RISK_PROFILES,
  MOCK_RULE_EFFECTIVENESS,
  MOCK_SCENARIO_HISTORY,
  MOCK_TACTIC_COVERAGE,
  MOCK_TTP_MAPPINGS,
  REFERENCE_NOW_ISO,
} from './mock-data';

// ------------------------------------------------------------
// Base URL resolution
//
// Production: talks to Next.js proxy (/api/proxy/*) so cookies
// stay same-origin. Local dev: talks directly to backend on
// localhost:8000.
// ------------------------------------------------------------
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api/proxy'
    : 'http://localhost:8000');

// ------------------------------------------------------------
// Backend reachability probe
//
// Fired at most once per page load. Hits /health with a short
// timeout. If it succeeds, we know the backend exists and each
// request gets to try live first. If it fails, every request
// skips the network entirely.
// ------------------------------------------------------------
const PROBE_TIMEOUT_MS = 2500;
const REQUEST_TIMEOUT_MS = 5000;

let backendAvailablePromise: Promise<boolean> | null = null;

/**
 * @internal — test-only escape hatch.
 *
 * Tests that exercise API functions (``startMission``, ``runScenario``,
 * etc.) need ``liveOrThrow`` to proceed past the health probe without
 * actually hitting ``/health``. Calling this with ``true`` preseeds the
 * cached probe promise so subsequent calls skip the real fetch; calling
 * with ``null`` clears the cache so the next probe will fire for real.
 *
 * Not intended for production code. Keep in this module rather than a
 * separate test helper because it needs direct access to module state.
 */
export function __setBackendAvailableForTests(
  available: boolean | null,
): void {
  backendAvailablePromise = available === null ? null : Promise.resolve(available);
}

function probeBackend(): Promise<boolean> {
  if (backendAvailablePromise) return backendAvailablePromise;
  backendAvailablePromise = (async () => {
    if (typeof window === 'undefined') return false; // SSR: always mock
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(`${BASE_URL}/health`, {
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  })();
  return backendAvailablePromise;
}

/** Force a re-probe on the next call (used by a manual REFRESH). */
export function resetBackendProbe(): void {
  backendAvailablePromise = null;
}

// ------------------------------------------------------------
// Typed request helper with timeout
// ------------------------------------------------------------
function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(
    /(?:^|;\s*)aegisrange_csrf=([^;]*)/
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

async function extractErrorDetail(res: Response): Promise<string | undefined> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return undefined;
  try {
    const body = (await res.json()) as unknown;
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }
    }
  } catch {
    // Body was advertised as JSON but didn't parse — ignore.
  }
  return undefined;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) ?? {}),
    };
    // Include CSRF token on state-changing requests
    if (
      csrfToken &&
      options?.method &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)
    ) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers,
    });
    if (!res.ok) {
      throw new ApiError(res.status, res.statusText, await extractErrorDetail(res));
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// live()  — tries the backend, falls back to mock on any error
//
// Usage:
//   return live(
//     () => request<Metrics>('/metrics'),
//     MOCK_METRICS,
//   );
// ------------------------------------------------------------
async function live<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!(await probeBackend())) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * liveOrThrow — tries the backend, rethrows on failure.
 *
 * Used for POST/PATCH endpoints where "fall back to mock" doesn't
 * make sense yet (the mock state layer is added in A.3). On a
 * non-live deployment these simply reject and the UI shows its
 * existing error state.
 */
async function liveOrThrow<T>(fn: () => Promise<T>, mockReason: string): Promise<T> {
  if (!(await probeBackend())) {
    throw new Error(`Backend unavailable — ${mockReason}`);
  }
  return fn();
}

/**
 * liveListWithFallback — list-endpoint convenience wrapper around
 * `live()`. Tries the backend for `path`; falls back to the mock
 * list when the backend is unreachable, the fetch errors, OR the
 * backend returns an empty array. An empty live response is
 * treated as "backend has nothing to show" because a demo UI
 * rendering an empty table looks broken to a recruiter.
 *
 * Endpoints with subtler fallback semantics — conditional empty
 * checks, response shape validation, or single-entity lookups —
 * should stay bespoke and use `live()` / `liveOrThrow()` directly.
 */
async function liveListWithFallback<T>(
  path: string,
  fallback: T[]
): Promise<T[]> {
  return live(
    async () => {
      const result = await request<T[]>(path);
      if (!result || result.length === 0) {
        throw new Error(`empty response from ${path}`);
      }
      return result;
    },
    fallback
  );
}

// ============================================================
// Health
// ============================================================
export async function getHealth(): Promise<HealthStatus> {
  return live(() => request<HealthStatus>('/health'), MOCK_HEALTH);
}

// ============================================================
// Identity
// ============================================================
export async function login(body: LoginRequest): Promise<LoginResponse> {
  return live(
    () =>
      request<LoginResponse>('/identity/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    {
      success: true,
      actor_id: 'demo-operator',
      actor_role: 'analyst',
      session_id: 'demo-session',
      step_up_required: false,
    }
  );
}

// ============================================================
// Documents
// ============================================================
export async function readDocument(documentId: string, body: DocumentRequest): Promise<unknown> {
  return live(
    () =>
      request<unknown>(`/documents/${documentId}/read`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    { status: 'demo' }
  );
}
// ============================================================
// Scenarios
//
// Live only. No mock fallback.
// ============================================================
export async function runScenario(scenarioId: string): Promise<ScenarioResult> {
  return liveOrThrow(
    () =>
      request<ScenarioResult>(`/scenarios/${scenarioId}`, {
        method: 'POST',
      }),
    'scenario execution requires a live authenticated backend'
  );
}

// ============================================================
// Missions — anonymous-friendly, keyed by run_id (UUID capability)
// ============================================================
export async function startMission(payload: {
  scenario_id: string;
  perspective?: MissionPerspective;
  difficulty?: MissionDifficulty;
  mode?: 'async' | 'sync';
}): Promise<MissionSnapshot> {
  return liveOrThrow(
    () =>
      request<MissionSnapshot>('/missions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    'mission execution requires a live backend'
  );
}

export async function getMission(runId: string): Promise<MissionSnapshot> {
  return liveOrThrow(
    () => request<MissionSnapshot>(`/missions/${runId}`),
    `unknown run_id: ${runId}`
  );
}

export async function getMissionIncident(runId: string): Promise<Incident> {
  return liveOrThrow(
    () => request<Incident>(`/missions/${runId}/incident`),
    `unknown run_id: ${runId}`
  );
}

/** URL for the mission SSE stream. Use with ``new EventSource(...)``. */
export function missionStreamUrl(runId: string): string {
  return `${BASE_URL}/missions/${runId}/stream`;
}

export async function submitMissionCommand(
  runId: string,
  command: string,
): Promise<MissionCommandResponse> {
  return liveOrThrow(
    () =>
      request<MissionCommandResponse>(`/missions/${runId}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      }),
    `unknown run_id: ${runId}`,
  );
}

export async function getMissionHelp(
  runId: string,
  topic?: string,
): Promise<MissionHelp> {
  const qs = topic ? `?topic=${encodeURIComponent(topic)}` : '';
  return liveOrThrow(
    () => request<MissionHelp>(`/missions/${runId}/help${qs}`),
    `unknown run_id: ${runId}`,
  );
}

export async function downloadDocument(documentId: string, body: DocumentRequest): Promise<unknown> {
  return live(
    () =>
      request<unknown>(`/documents/${documentId}/download`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    { status: 'demo' }
  );
}



// ============================================================
// Events — content in A.2
// ============================================================
const DEFAULT_FEED_LIMIT = 200;

/** Sort-in-place-safe descending timestamp sort for feed fallbacks. */
function sortByTimestampDesc<T extends { timestamp?: string; created_at?: string }>(
  items: T[],
  key: 'timestamp' | 'created_at'
): T[] {
  return [...items].sort((a, b) => {
    const av = (a[key] ?? '') as string;
    const bv = (b[key] ?? '') as string;
    return bv.localeCompare(av);
  });
}

export async function getEvents(params?: {
  actor_id?: string;
  correlation_id?: string;
  event_type?: string;
  since_minutes?: number;
  limit?: number;
  offset?: number;
}): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
  if (params?.correlation_id) searchParams.set('correlation_id', params.correlation_id);
  if (params?.event_type) searchParams.set('event_type', params.event_type);
  if (params?.since_minutes) searchParams.set('since_minutes', String(params.since_minutes));
  const limit = params?.limit ?? DEFAULT_FEED_LIMIT;
  const offset = params?.offset ?? 0;
  searchParams.set('page_size', String(limit));
  searchParams.set('page', String(Math.floor(offset / limit) + 1));
  const query = searchParams.toString();
  // Mock fallback matches live semantics: apply filter, sort
  // newest-first, then slice to the requested window.
  const filtered = filterEvents(MOCK_EVENTS, params);
  const fallback = sortByTimestampDesc(filtered, 'timestamp').slice(
    offset,
    offset + limit
  );
  return live(
    async () => {
      const result = await request<{ items: Event[]; total: number }>(`/events?${query}`);
      const items = result?.items ?? [];
      if (items.length === 0) {
        throw new Error(`empty response from /events`);
      }
      return items;
    },
    fallback
  );
}

// ============================================================
// Alerts — content in A.2
// ============================================================
export async function getAlerts(params?: {
  actor_id?: string;
  correlation_id?: string;
  rule_id?: string;
  limit?: number;
  offset?: number;
}): Promise<Alert[]> {
  const searchParams = new URLSearchParams();
  if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
  if (params?.correlation_id) searchParams.set('correlation_id', params.correlation_id);
  if (params?.rule_id) searchParams.set('rule_id', params.rule_id);
  const limit = params?.limit ?? DEFAULT_FEED_LIMIT;
  const offset = params?.offset ?? 0;
  searchParams.set('page_size', String(limit));
  searchParams.set('page', String(Math.floor(offset / limit) + 1));
  const query = searchParams.toString();
  const filtered = filterAlerts(MOCK_ALERTS, params);
  const fallback = sortByTimestampDesc(filtered, 'created_at').slice(
    offset,
    offset + limit
  );
  return live(
    async () => {
      const result = await request<{ items: Alert[]; total: number }>(`/alerts?${query}`);
      const items = result?.items ?? [];
      if (items.length === 0) {
        throw new Error(`empty response from /alerts`);
      }
      return items;
    },
    fallback
  );
}

// ============================================================
// Mock state layer
//
// updateIncidentStatus / addIncidentNote need somewhere to
// land when the backend is unreachable. We keep a JSON-cloned
// snapshot of MOCK_INCIDENTS at module load and let the
// mutation helpers below mutate it in place. The imported
// MOCK_INCIDENTS object itself is never touched, so reloading
// the page resets the demo.
// ============================================================

const mockIncidentsState: Incident[] = JSON.parse(
  JSON.stringify(MOCK_INCIDENTS)
) as Incident[];

function findMockIncident(correlationId: string): Incident | undefined {
  return mockIncidentsState.find(
    (incident) => incident.correlation_id === correlationId
  );
}

function mutateIncidentStatus(
  correlationId: string,
  status: IncidentStatus
): Incident {
  const incident = findMockIncident(correlationId);
  if (!incident) {
    throw new Error(`unknown correlation_id: ${correlationId}`);
  }
  const now = new Date().toISOString();
  incident.status = status;
  incident.updated_at = now;
  if (status === 'closed') {
    incident.closed_at = now;
  }
  incident.timeline.push({
    timestamp: now,
    entry_type: 'status_change',
    entry_id: `${incident.incident_id}-sc-${incident.timeline.length + 1}`,
    summary: `Status moved to ${status}.`,
  });
  return incident;
}

function mutateIncidentNote(
  correlationId: string,
  author: string,
  content: string
): IncidentNote {
  const incident = findMockIncident(correlationId);
  if (!incident) {
    throw new Error(`unknown correlation_id: ${correlationId}`);
  }
  const now = new Date().toISOString();
  const note: IncidentNote = {
    note_id: `note-${Date.now().toString(36)}`,
    author,
    content,
    created_at: now,
  };
  incident.notes.push(note);
  incident.updated_at = now;
  return note;
}

// ============================================================
// Incidents — content in A.3
// ============================================================
export async function getIncidents(): Promise<Incident[]> {
  // Pass mockIncidentsState (the mutable clone) as the fallback
  // so session mutations from updateIncidentStatus /
  // addIncidentNote remain visible on the list view.
  return liveListWithFallback('/incidents', mockIncidentsState);
}

export async function getIncident(correlationId: string): Promise<Incident> {
  // Look up the chain in MOCK_INCIDENTS first so we know whether
  // a fallback is even possible. When the backend is reachable
  // we still try it — but fall back to the mock if the request
  // fails or comes back without a usable correlation_id.
  const mockIncident = findMockIncident(correlationId);
  if (!mockIncident) {
    return liveOrThrow(
      () => request<Incident>(`/incidents/${correlationId}`),
      `unknown correlation_id: ${correlationId}`
    );
  }
  return live(
    async () => {
      const result = await request<Incident>(`/incidents/${correlationId}`);
      if (!result || !result.correlation_id) {
        throw new Error('empty incident response');
      }
      return result;
    },
    mockIncident
  );
}

export async function updateIncidentStatus(
  correlationId: string,
  status: IncidentStatus
): Promise<Incident> {
  if (await probeBackend()) {
    try {
      return await request<Incident>(`/incidents/${correlationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch {
      // Backend reachable but the mutation failed — fall through
      // to the in-memory mock so the demo still moves forward.
    }
  }
  return mutateIncidentStatus(correlationId, status);
}

// ============================================================
// Metrics
// ============================================================
export async function getMetrics(): Promise<Metrics> {
  return live(() => request<Metrics>('/metrics'), MOCK_METRICS);
}

// ============================================================
// Analytics — content in Slice B
// ============================================================
export async function getRiskProfiles(): Promise<RiskProfile[]> {
  return liveListWithFallback('/analytics/risk-profiles', MOCK_RISK_PROFILES);
}

export async function getRiskProfile(actorId: string): Promise<RiskProfile> {
  // Look up the matching mock profile up front so we can fall
  // back to it on an unreachable backend or a live error. If
  // neither live nor mock has the actor, throw so the UI can
  // render its not-found state.
  const mockProfile = MOCK_RISK_PROFILES.find(
    (profile) => profile.actor_id === actorId
  );
  if (await probeBackend()) {
    try {
      return await request<RiskProfile>(
        `/analytics/risk-profiles/${actorId}`
      );
    } catch {
      // Backend reachable but lookup failed — fall through to
      // the mock so the demo still renders.
    }
  }
  if (!mockProfile) {
    throw new Error(`unknown actor_id: ${actorId}`);
  }
  return mockProfile;
}

export async function getRuleEffectiveness(): Promise<RuleEffectiveness[]> {
  return liveListWithFallback(
    '/analytics/rule-effectiveness',
    MOCK_RULE_EFFECTIVENESS
  );
}

export async function getScenarioHistory(): Promise<ScenarioHistoryEntry[]> {
  return liveListWithFallback(
    '/analytics/scenario-history',
    MOCK_SCENARIO_HISTORY
  );
}

// ============================================================
// Incident Notes — content in A.3
// ============================================================
export async function addIncidentNote(
  correlationId: string,
  author: string,
  content: string
): Promise<IncidentNote> {
  if (await probeBackend()) {
    try {
      return await request<IncidentNote>(`/incidents/${correlationId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ author, content }),
      });
    } catch {
      // Backend reachable but the mutation failed — fall through
      // to the in-memory mock so the demo still moves forward.
    }
  }
  return mutateIncidentNote(correlationId, author, content);
}

export async function getIncidentNotes(correlationId: string): Promise<IncidentNote[]> {
  // Pull notes off the matching MOCK_INCIDENT (if any). If the
  // live backend returns an empty array but the mock has notes,
  // surface the mock notes so the demo isn't an empty pane.
  const mockNotes = findMockIncident(correlationId)?.notes ?? [];
  return live(
    async () => {
      const result = await request<IncidentNote[]>(
        `/incidents/${correlationId}/notes`
      );
      if ((!result || result.length === 0) && mockNotes.length > 0) {
        throw new Error('empty notes response');
      }
      return result ?? [];
    },
    mockNotes
  );
}

// ============================================================
// Responses — first-class response records
// ============================================================
export async function getResponses(): Promise<IncidentResponse[]> {
  return liveListWithFallback('/responses', MOCK_RESPONSES);
}

export async function getResponse(
  responseId: string
): Promise<IncidentResponse> {
  const mockResponse = MOCK_RESPONSES.find(
    (response) => response.response_id === responseId
  );
  if (await probeBackend()) {
    try {
      return await request<IncidentResponse>(`/responses/${responseId}`);
    } catch {
      // Backend reachable but lookup failed — fall through to
      // the mock so the demo still renders.
    }
  }
  if (!mockResponse) {
    throw new Error(`unknown response_id: ${responseId}`);
  }
  return mockResponse;
}

// ============================================================
// Events Export — content in Slice B
// ============================================================
export async function exportEvents(params?: {
  correlation_id?: string;
  actor_id?: string;
  since_minutes?: number;
}): Promise<EventExport> {
  const searchParams = new URLSearchParams();
  if (params?.correlation_id) searchParams.set('correlation_id', params.correlation_id);
  if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
  if (params?.since_minutes) searchParams.set('since_minutes', String(params.since_minutes));
  const query = searchParams.toString();
  return live(
    () => request<EventExport>(`/events/export${query ? `?${query}` : ''}`),
    {
      export_timestamp: REFERENCE_NOW_ISO,
      total_events: 0,
      events: [],
    }
  );
}

// ============================================================
// MITRE ATT&CK — content in Slice C
// ============================================================

/**
 * computeScenarioTTPs — walks from a scenario id through its
 * correlation chain → rules that fired in MOCK_ALERTS →
 * technique ids in MOCK_TTP_MAPPINGS → full MitreTechnique
 * objects. Used as the mock fallback for getMitreScenarioTTPs
 * so the returned techniques stay consistent with whatever
 * rules/chains exist elsewhere in the demo data.
 */
function computeScenarioTTPs(scenarioId: string): MitreTechnique[] {
  const historyEntry = MOCK_SCENARIO_HISTORY.find(
    (entry) => entry.scenario_id === scenarioId
  );
  if (!historyEntry) return [];
  const firedRuleIds = new Set(
    MOCK_ALERTS.filter(
      (alert) => alert.correlation_id === historyEntry.correlation_id
    ).map((alert) => alert.rule_id)
  );
  const techniqueIds = new Set<string>();
  for (const mapping of MOCK_TTP_MAPPINGS) {
    if (!firedRuleIds.has(mapping.rule_id)) continue;
    for (const techId of mapping.technique_ids) {
      techniqueIds.add(techId);
    }
  }
  return MOCK_MITRE_TECHNIQUES.filter((technique) =>
    techniqueIds.has(technique.id)
  );
}

export async function getMitreMappings(): Promise<TTPMapping[]> {
  return liveListWithFallback('/mitre/mappings', MOCK_TTP_MAPPINGS);
}

export async function getMitreMapping(ruleId: string): Promise<TTPMapping> {
  const mockMapping = MOCK_TTP_MAPPINGS.find(
    (mapping) => mapping.rule_id === ruleId
  );
  if (await probeBackend()) {
    try {
      return await request<TTPMapping>(`/mitre/mappings/${ruleId}`);
    } catch {
      // Backend reachable but lookup failed — fall through to
      // the mock so the demo still renders.
    }
  }
  if (!mockMapping) {
    throw new Error(`unknown rule_id: ${ruleId}`);
  }
  return mockMapping;
}

export async function getMitreCoverageMatrix(): Promise<MitreCoverageEntry[]> {
  return liveListWithFallback('/mitre/coverage', MOCK_MITRE_COVERAGE);
}

export async function getMitreTacticCoverage(): Promise<TacticCoverage[]> {
  return liveListWithFallback(
    '/mitre/tactics/coverage',
    MOCK_TACTIC_COVERAGE
  );
}

export async function getMitreScenarioTTPs(
  scenarioId: string
): Promise<MitreTechnique[]> {
  return liveListWithFallback(
    `/mitre/scenarios/${scenarioId}/ttps`,
    computeScenarioTTPs(scenarioId)
  );
}

// ============================================================
// Kill Chain — content in Slice C
// ============================================================
export async function getKillChainAnalysis(
  correlationId: string
): Promise<KillChainAnalysis> {
  const mockAnalysis = MOCK_KILL_CHAIN_ANALYSES.find(
    (analysis) => analysis.correlation_id === correlationId
  );
  if (await probeBackend()) {
    try {
      return await request<KillChainAnalysis>(`/killchain/${correlationId}`);
    } catch {
      // Backend reachable but lookup failed — fall through to
      // the mock so the demo still renders.
    }
  }
  if (!mockAnalysis) {
    throw new Error(`unknown correlation_id: ${correlationId}`);
  }
  return mockAnalysis;
}

export async function getAllKillChainAnalyses(): Promise<KillChainAnalysis[]> {
  return liveListWithFallback('/killchain', MOCK_KILL_CHAIN_ANALYSES);
}

// ============================================================
// Campaigns — content in Slice C
// ============================================================
export async function getCampaigns(): Promise<Campaign[]> {
  return liveListWithFallback('/campaigns', MOCK_CAMPAIGNS);
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  const mockCampaign = MOCK_CAMPAIGNS.find(
    (campaign) => campaign.campaign_id === campaignId
  );
  if (await probeBackend()) {
    try {
      return await request<Campaign>(`/campaigns/${campaignId}`);
    } catch {
      // Backend reachable but lookup failed — fall through to
      // the mock so the demo still renders.
    }
  }
  if (!mockCampaign) {
    throw new Error(`unknown campaign_id: ${campaignId}`);
  }
  return mockCampaign;
}

// ============================================================
// Exercise Reports — content in Slice C
// ============================================================
export async function generateReport(title?: string): Promise<ExerciseReport> {
  // Fall back to MOCK_EXERCISE_REPORT on unreachable backend or
  // live errors. If a title was supplied and we're using the
  // mock, surface it in the returned report so the UI's custom
  // title still renders. MOCK_EXERCISE_REPORT derives every
  // numeric field from other mock constants (MOCK_METRICS,
  // MOCK_SCENARIO_HISTORY, MOCK_RULE_EFFECTIVENESS,
  // MOCK_RISK_PROFILES, MOCK_TACTIC_COVERAGE) so recruiters
  // see consistent numbers across the report, metrics, and
  // MITRE tabs.
  const body = title ? { title } : {};
  return live(
    () =>
      request<ExerciseReport>('/reports/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    title ? { ...MOCK_EXERCISE_REPORT, title } : MOCK_EXERCISE_REPORT
  );
}

// ============================================================
// Platform Auth
// ============================================================
export async function platformLogin(username: string, password: string): Promise<AuthToken> {
  return request<AuthToken>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function platformLogout(): Promise<void> {
  await request<{ status: string }>('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!(await probeBackend())) return null;
  try {
    return await request<CurrentUser>('/auth/me');
  } catch {
    return null;
  }
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  return liveListWithFallback('/auth/users', MOCK_PLATFORM_USERS);
}

// ============================================================
// Admin
// ============================================================
export async function resetSystem(): Promise<{ status: string }> {
  return live(
    () => request<{ status: string }>('/admin/reset', { method: 'POST' }),
    { status: 'demo-noop' }
  );
}
