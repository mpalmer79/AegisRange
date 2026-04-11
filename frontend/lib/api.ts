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
} from './types';
import {
  MOCK_ALERTS,
  MOCK_HEALTH,
  MOCK_INCIDENTS,
  MOCK_METRICS,
  MOCK_MITRE_TECHNIQUES,
  MOCK_RISK_PROFILES,
  MOCK_RULE_EFFECTIVENESS,
  MOCK_SCENARIO_HISTORY,
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
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${res.statusText}`);
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
// Scenarios — mock fallback is stubbed until Slice B
// ============================================================
export async function runScenario(scenarioId: string): Promise<ScenarioResult> {
  return live(
    () =>
      request<ScenarioResult>(`/scenarios/${scenarioId}`, {
        method: 'POST',
      }),
    {
      scenario_id: scenarioId,
      correlation_id: `demo-${scenarioId}-${Date.now().toString(36)}`,
      events_total: 0,
      events_generated: 0,
      alerts_total: 0,
      alerts_generated: 0,
      responses_total: 0,
      responses_generated: 0,
      incident_id: null,
      step_up_required: false,
      revoked_sessions: [],
      download_restricted_actors: [],
      disabled_services: [],
      quarantined_artifacts: [],
      policy_change_restricted_actors: [],
      operated_by: 'demo-operator',
    }
  );
}

// ============================================================
// Events — content in A.2
// ============================================================
export async function getEvents(params?: {
  actor_id?: string;
  correlation_id?: string;
  event_type?: string;
  since_minutes?: number;
}): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
  if (params?.correlation_id) searchParams.set('correlation_id', params.correlation_id);
  if (params?.event_type) searchParams.set('event_type', params.event_type);
  if (params?.since_minutes) searchParams.set('since_minutes', String(params.since_minutes));
  const query = searchParams.toString();
  return live(() => request<Event[]>(`/events${query ? `?${query}` : ''}`), []);
}

// ============================================================
// Alerts — content in A.2
// ============================================================
export async function getAlerts(params?: {
  actor_id?: string;
  correlation_id?: string;
  rule_id?: string;
}): Promise<Alert[]> {
  const searchParams = new URLSearchParams();
  if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
  if (params?.correlation_id) searchParams.set('correlation_id', params.correlation_id);
  if (params?.rule_id) searchParams.set('rule_id', params.rule_id);
  const query = searchParams.toString();
  return live(() => request<Alert[]>(`/alerts${query ? `?${query}` : ''}`), []);
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
  return live(() => request<Incident[]>('/incidents'), []);
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
  // Fall back to MOCK_RISK_PROFILES on unreachable backend, live
  // errors, or an empty live response. An empty analytics page
  // would look broken, and the mock covers every primary actor
  // across the six correlation chains.
  return live(
    async () => {
      const result = await request<RiskProfile[]>('/analytics/risk-profiles');
      if (!result || result.length === 0) {
        throw new Error('empty risk profiles response');
      }
      return result;
    },
    MOCK_RISK_PROFILES
  );
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
  // Fall back to MOCK_RULE_EFFECTIVENESS on unreachable backend,
  // live errors, or an empty live response — an empty list would
  // render a dashboard that looks broken, and the mock covers every
  // DET-* rule in the backend ruleset.
  return live(
    async () => {
      const result = await request<RuleEffectiveness[]>(
        '/analytics/rule-effectiveness'
      );
      if (!result || result.length === 0) {
        throw new Error('empty rule effectiveness response');
      }
      return result;
    },
    MOCK_RULE_EFFECTIVENESS
  );
}

export async function getScenarioHistory(): Promise<ScenarioHistoryEntry[]> {
  // Fall back to MOCK_SCENARIO_HISTORY on unreachable backend,
  // live errors, or an empty live response. One entry per
  // correlation chain keeps the history tab aligned with the
  // incidents drawer.
  return live(
    async () => {
      const result = await request<ScenarioHistoryEntry[]>(
        '/analytics/scenario-history'
      );
      if (!result || result.length === 0) {
        throw new Error('empty scenario history response');
      }
      return result;
    },
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
  return live(
    async () => {
      const result = await request<TTPMapping[]>('/mitre/mappings');
      if (!result || result.length === 0) {
        throw new Error('empty mitre mappings response');
      }
      return result;
    },
    MOCK_TTP_MAPPINGS
  );
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
  return live(() => request<MitreCoverageEntry[]>('/mitre/coverage'), []);
}

export async function getMitreTacticCoverage(): Promise<TacticCoverage[]> {
  return live(() => request<TacticCoverage[]>('/mitre/tactics/coverage'), []);
}

export async function getMitreScenarioTTPs(
  scenarioId: string
): Promise<MitreTechnique[]> {
  return live(
    async () => {
      const result = await request<MitreTechnique[]>(
        `/mitre/scenarios/${scenarioId}/ttps`
      );
      if (!result || result.length === 0) {
        throw new Error('empty mitre scenario ttps response');
      }
      return result;
    },
    computeScenarioTTPs(scenarioId)
  );
}

// ============================================================
// Kill Chain — content in Slice C
// ============================================================
export async function getKillChainAnalysis(correlationId: string): Promise<KillChainAnalysis> {
  return liveOrThrow(
    () => request<KillChainAnalysis>(`/killchain/${correlationId}`),
    'kill chain mock populated in Slice C'
  );
}

export async function getAllKillChainAnalyses(): Promise<KillChainAnalysis[]> {
  return live(() => request<KillChainAnalysis[]>('/killchain'), []);
}

// ============================================================
// Campaigns — content in Slice C
// ============================================================
export async function getCampaigns(): Promise<Campaign[]> {
  return live(() => request<Campaign[]>('/campaigns'), []);
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  return liveOrThrow(
    () => request<Campaign>(`/campaigns/${campaignId}`),
    'campaign mock populated in Slice C'
  );
}

// ============================================================
// Exercise Reports — content in Slice C
// ============================================================
export async function generateReport(title?: string): Promise<ExerciseReport> {
  const body = title ? { title } : {};
  return live(
    () =>
      request<ExerciseReport>('/reports/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    {
      report_id: 'demo-report',
      title: title ?? 'Demo Exercise Report',
      generated_at: REFERENCE_NOW_ISO,
      exercise_window: { start: REFERENCE_NOW_ISO, end: REFERENCE_NOW_ISO },
      summary: {
        total_events: 0,
        total_alerts: 0,
        total_incidents: 0,
        total_responses: 0,
        scenarios_executed: 0,
      },
      scenario_results: [],
      detection_coverage: { rules_total: 0, rules_triggered: 0, rules_list: [] },
      response_effectiveness: {},
      risk_summary: {},
      recommendations: [],
      mitre_coverage: { tactics_covered: [], techniques_covered: [], coverage_percentage: 0 },
    }
  );
}

// ============================================================
// Platform Auth
// ============================================================
export async function platformLogin(username: string, password: string): Promise<AuthToken> {
  return live(
    () =>
      request<AuthToken>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    {
      username,
      role: 'analyst',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    }
  );
}

export async function platformLogout(): Promise<void> {
  return live(
    async () => {
      await request<{ status: string }>('/auth/logout', { method: 'POST' });
    },
    undefined
  );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return live(() => request<CurrentUser>('/auth/me'), {
    username: 'demo-operator',
    role: 'analyst',
    display_name: 'Demo Operator',
  });
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  return live(() => request<PlatformUser[]>('/auth/users'), []);
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
