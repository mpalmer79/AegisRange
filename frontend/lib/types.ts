// ============================================================
// AegisRange Type Definitions
// ============================================================

export interface HealthStatus {
  status: string;
  version?: string;
  uptime?: number;
  components?: Record<string, string>;
}

export interface Event {
  event_id: string;
  timestamp: string;
  event_type: string;
  category: string;
  actor_id: string;
  actor_role?: string;
  source_ip?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  status: string;
  session_id?: string;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}

export interface Alert {
  alert_id: string;
  timestamp: string;
  rule_id: string;
  rule_name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  actor_id: string;
  correlation_id?: string;
  summary: string;
  details?: Record<string, unknown>;
  event_ids?: string[];
}

export interface TimelineEntry {
  timestamp: string;
  entry_type: string;
  entry_id: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface Incident {
  incident_id: string;
  correlation_id: string;
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  risk_score?: number;
  primary_actor?: string;
  title?: string;
  summary?: string;
  detection_ids?: string[];
  detection_summaries?: string[];
  response_ids?: string[];
  affected_resources?: AffectedResources;
  timeline?: TimelineEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface AffectedResources {
  documents?: string[];
  sessions?: string[];
  services?: string[];
  actors?: string[];
}

export interface Metrics {
  total_events: number;
  total_alerts: number;
  total_incidents: number;
  active_containments: number;
  events_by_category?: Record<string, number>;
  alerts_by_severity?: Record<string, number>;
  incidents_by_status?: Record<string, number>;
}

export interface ScenarioResult {
  scenario_id: string;
  scenario_name?: string;
  correlation_id: string;
  events_generated?: number;
  alerts_generated?: number;
  responses_generated?: number;
  incident_id?: string;
  summary?: string;
  details?: Record<string, unknown>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  session_id?: string;
  token?: string;
  actor_id?: string;
  status?: string;
  events?: Event[];
}

export interface DocumentRequest {
  actor_id: string;
  actor_role: string;
  session_id?: string;
}

export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';

export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['investigating'],
  investigating: ['contained', 'resolved'],
  contained: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

export interface RiskProfile {
  actor_id: string;
  current_score: number;
  peak_score: number;
  contributing_rules: string[];
  score_history: ScoreHistoryEntry[];
  last_updated: string;
}

export interface ScoreHistoryEntry {
  timestamp: string;
  rule_id: string;
  delta: number;
  new_score: number;
}

export interface RuleEffectiveness {
  rule_id: string;
  rule_name: string;
  trigger_count: number;
  severity: string;
  actors_affected: number;
}

export interface IncidentNote {
  note_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface EventExport {
  export_timestamp: string;
  total_events: number;
  events: Event[];
}

export interface ScenarioHistoryEntry {
  scenario_id: string;
  correlation_id: string;
  events_total: number;
  alerts_total: number;
  responses_total: number;
  incident_id: string | null;
  executed_at: string;
}

export const SCENARIO_DEFINITIONS = [
  {
    id: 'scn-auth-001',
    name: 'Brute Force Authentication',
    description: 'Simulates a brute-force login attack with multiple failed authentication attempts followed by a successful login from a suspicious IP.',
  },
  {
    id: 'scn-session-002',
    name: 'Session Hijacking',
    description: 'Simulates session token theft and reuse from a different IP address, triggering session anomaly detection.',
  },
  {
    id: 'scn-doc-003',
    name: 'Unauthorized Document Access',
    description: 'Simulates an unauthorized user attempting to access restricted documents, triggering access control alerts.',
  },
  {
    id: 'scn-doc-004',
    name: 'Bulk Document Exfiltration',
    description: 'Simulates rapid downloading of multiple sensitive documents, indicating potential data exfiltration.',
  },
  {
    id: 'scn-svc-005',
    name: 'Service Account Abuse',
    description: 'Simulates misuse of a service account for unauthorized operations outside its normal scope.',
  },
  {
    id: 'scn-corr-006',
    name: 'Correlated Multi-Stage Attack',
    description: 'Simulates a sophisticated multi-stage attack combining authentication, session, and document access vectors.',
  },
];
