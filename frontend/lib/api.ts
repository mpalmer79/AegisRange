// ============================================================
// AegisRange API Client
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
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
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

// Admin
export async function resetSystem(): Promise<{ status: string }> {
  return request<{ status: string }>('/admin/reset', {
    method: 'POST',
  });
}
