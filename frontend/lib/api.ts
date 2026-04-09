// ============================================================
// AegisRange API Client
//
// Authentication uses httpOnly cookies set by the backend.
// The JWT token never touches JavaScript.  All requests include
// credentials: 'include' so the browser sends the cookie
// automatically.
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

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${res.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
  }

  return res.json();
}

// Health
export async function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

// Identity
export async function login(body: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/identity/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Documents
export async function readDocument(documentId: string, body: DocumentRequest): Promise<unknown> {
  return request(`/documents/${documentId}/read`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function downloadDocument(documentId: string, body: DocumentRequest): Promise<unknown> {
  return request(`/documents/${documentId}/download`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Scenarios
export async function runScenario(scenarioId: string): Promise<ScenarioResult> {
  return request<ScenarioResult>(`/scenarios/${scenarioId}`, {
    method: 'POST',
  });
}

// Events
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
  return request<Event[]>(`/events${query ? `?${query}` : ''}`);
}

// Alerts
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
  return request<Alert[]>(`/alerts${query ? `?${query}` : ''}`);
}

// Incidents
export async function getIncidents(): Promise<Incident[]> {
  return request<Incident[]>('/incidents');
}

export async function getIncident(correlationId: string): Promise<Incident> {
  return request<Incident>(`/incidents/${correlationId}`);
}

export async function updateIncidentStatus(
  correlationId: string,
  status: IncidentStatus
): Promise<Incident> {
  return request<Incident>(`/incidents/${correlationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Metrics
export async function getMetrics(): Promise<Metrics> {
  return request<Metrics>('/metrics');
}

// Analytics
export async function getRiskProfiles(): Promise<RiskProfile[]> {
  return request<RiskProfile[]>('/analytics/risk-profiles');
}

export async function getRiskProfile(actorId: string): Promise<RiskProfile> {
  return request<RiskProfile>(`/analytics/risk-profiles/${actorId}`);
}

export async function getRuleEffectiveness(): Promise<RuleEffectiveness[]> {
  return request<RuleEffectiveness[]>('/analytics/rule-effectiveness');
}

export async function getScenarioHistory(): Promise<ScenarioHistoryEntry[]> {
  return request<ScenarioHistoryEntry[]>('/analytics/scenario-history');
}

// Incident Notes
export async function addIncidentNote(
  correlationId: string,
  author: string,
  content: string
): Promise<IncidentNote> {
  return request<IncidentNote>(`/incidents/${correlationId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ author, content }),
  });
}

export async function getIncidentNotes(correlationId: string): Promise<IncidentNote[]> {
  return request<IncidentNote[]>(`/incidents/${correlationId}/notes`);
}

// Events Export
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
  return request<EventExport>(`/events/export${query ? `?${query}` : ''}`);
}

// MITRE ATT&CK
export async function getMitreMappings(): Promise<TTPMapping[]> {
  return request<TTPMapping[]>('/mitre/mappings');
}

export async function getMitreMapping(ruleId: string): Promise<TTPMapping> {
  return request<TTPMapping>(`/mitre/mappings/${ruleId}`);
}

export async function getMitreCoverageMatrix(): Promise<MitreCoverageEntry[]> {
  return request<MitreCoverageEntry[]>('/mitre/coverage');
}

export async function getMitreTacticCoverage(): Promise<TacticCoverage[]> {
  return request<TacticCoverage[]>('/mitre/tactics/coverage');
}

export async function getMitreScenarioTTPs(scenarioId: string): Promise<MitreTechnique[]> {
  return request<MitreTechnique[]>(`/mitre/scenarios/${scenarioId}/ttps`);
}

// Kill Chain
export async function getKillChainAnalysis(correlationId: string): Promise<KillChainAnalysis> {
  return request<KillChainAnalysis>(`/killchain/${correlationId}`);
}

export async function getAllKillChainAnalyses(): Promise<KillChainAnalysis[]> {
  return request<KillChainAnalysis[]>('/killchain');
}

// Campaigns
export async function getCampaigns(): Promise<Campaign[]> {
  return request<Campaign[]>('/campaigns');
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  return request<Campaign>(`/campaigns/${campaignId}`);
}

// Exercise Reports
export async function generateReport(title?: string): Promise<ExerciseReport> {
  const body = title ? { title } : {};
  return request<ExerciseReport>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Platform Auth
export async function platformLogin(username: string, password: string): Promise<AuthToken> {
  return request<AuthToken>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function platformLogout(): Promise<void> {
  await request<{ status: string }>('/auth/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me');
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  return request<PlatformUser[]>('/auth/users');
}

// Admin
export async function resetSystem(): Promise<{ status: string }> {
  return request<{ status: string }>('/admin/reset', {
    method: 'POST',
  });
}
