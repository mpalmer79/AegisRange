// ============================================================
// AegisRange Type Definitions
// ============================================================

export interface HealthStatus {
  status: string;
  timestamp: string;
}

export interface Event {
  event_id: string;
  timestamp: string;
  event_type: string;
  category: string;
  actor_id: string;
  actor_type?: string;
  actor_role?: string;
  source_ip?: string;
  target_type?: string;
  target_id?: string;
  request_id?: string;
  status: string;
  status_code?: string;
  session_id?: string;
  correlation_id?: string;
  user_agent?: string;
  origin?: string;
  error_message?: string;
  severity?: string;
  confidence?: string;
  risk_score?: number;
  payload?: Record<string, unknown>;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface Alert {
  alert_id: string;
  created_at: string;
  rule_id: string;
  rule_name: string;
  severity: Severity;
  confidence: string;
  actor_id: string;
  correlation_id: string;
  contributing_event_ids: string[];
  summary: string;
  payload: Record<string, unknown>;
}

export interface TimelineEntry {
  timestamp: string;
  entry_type: string;
  entry_id: string;
  summary: string;
}

export interface Incident {
  incident_id: string;
  incident_type: string;
  correlation_id: string;
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  severity: Severity;
  confidence: string;
  risk_score: number | null;
  primary_actor_id: string;
  actor_type: string;
  actor_role: string | null;
  detection_ids: string[];
  detection_summary: string[];
  response_ids: string[];
  containment_status: string;
  event_ids: string[];
  affected_documents: string[];
  affected_sessions: string[];
  affected_services: string[];
  affected_resources: AffectedResources;
  timeline: TimelineEntry[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  notes: IncidentNote[];
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
  total_responses: number;
  active_containments: number;
  events_by_category: Record<string, number>;
  alerts_by_severity: Record<string, number>;
  incidents_by_status: Record<string, number>;
}

export interface ScenarioResult {
  scenario_id: string;
  correlation_id: string;
  events_total: number;
  events_generated: number;
  alerts_total: number;
  alerts_generated: number;
  responses_total: number;
  responses_generated: number;
  incident_id: string | null;
  step_up_required: boolean;
  revoked_sessions: string[];
  download_restricted_actors: string[];
  disabled_services: string[];
  quarantined_artifacts: string[];
  policy_change_restricted_actors: string[];
  operated_by: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  actor_id: string;
  actor_role: string;
  session_id: string;
  step_up_required: boolean;
}

export interface DocumentRequest {
  actor_id: string;
  actor_role: string;
  session_id?: string;
}

export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';

export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['investigating', 'contained', 'resolved'],
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

export type IncidentResponseType =
  | 'session_revoke'
  | 'download_restriction'
  | 'service_disable'
  | 'artifact_quarantine'
  | 'policy_rollback'
  | 'ip_block'
  | 'access_revoke'
  | 'false_positive_resolution';

export type IncidentResponseStatus =
  | 'pending'
  | 'executed'
  | 'verified'
  | 'failed';

// Named IncidentResponse (not Response) to avoid shadowing the
// DOM-global Response type used by fetch() in api.ts.
export interface IncidentResponse {
  response_id: string;
  incident_id: string;
  correlation_id: string;
  response_type: IncidentResponseType;
  status: IncidentResponseStatus;
  triggered_at: string;
  executed_at: string | null;
  operator: string;
  target: string;
  summary: string;
  playbook_id?: string;
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
  events_generated: number;
  alerts_total: number;
  alerts_generated: number;
  responses_total: number;
  responses_generated: number;
  incident_id: string | null;
  step_up_required: boolean;
  revoked_sessions: string[];
  download_restricted_actors: string[];
  disabled_services: string[];
  quarantined_artifacts: string[];
  policy_change_restricted_actors: string[];
  operated_by: string | null;
  executed_at: string;
}

// ============================================================
// Phase 6: MITRE ATT&CK, Kill Chain, Campaign Types
// ============================================================

export interface MitreTactic {
  id: string;
  name: string;
  description: string;
  url: string;
}

export interface MitreTechnique {
  id: string;
  name: string;
  description: string;
  tactic_ids: string[];
  url: string;
}

export interface TTPMapping {
  rule_id: string;
  technique_ids: string[];
  tactic_ids: string[];
  kill_chain_phases: string[];
}

export interface MitreCoverageEntry {
  tactic_id: string;
  technique_id: string;
  technique_name: string;
  rule_ids: string[];
  scenario_ids: string[];
  covered: boolean;
}

export interface TacticCoverage {
  tactic_id: string;
  tactic_name: string;
  covered_techniques: number;
  total_techniques: number;
  percentage: number;
}

export interface KillChainStage {
  name: string;
  display_name: string;
  description: string;
  order: number;
  detected: boolean;
  detection_rule_ids: string[];
  first_seen: string | null;
}

export interface KillChainAnalysis {
  incident_id: string;
  correlation_id: string;
  actor_id: string;
  stages: KillChainStage[];
  progression_percentage: number;
  highest_stage: string;
  first_activity: string | null;
  last_activity: string | null;
}

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  incident_correlation_ids: string[];
  shared_actors: string[];
  shared_ttps: string[];
  severity: string;
  confidence: string;
  first_seen: string;
  last_seen: string;
  summary: string;
}

export interface ExerciseReport {
  report_id: string;
  title: string;
  generated_at: string;
  exercise_window: { start: string; end: string };
  summary: {
    total_events: number;
    total_alerts: number;
    total_incidents: number;
    total_responses: number;
    scenarios_executed: number;
  };
  scenario_results: Record<string, unknown>[];
  detection_coverage: {
    rules_total: number;
    rules_triggered: number;
    rules_list: Record<string, unknown>[];
  };
  response_effectiveness: Record<string, unknown>;
  risk_summary: Record<string, unknown>;
  recommendations: string[];
  mitre_coverage: {
    tactics_covered: string[];
    techniques_covered: string[];
    coverage_percentage: number;
  };
}

export interface AuthToken {
  username: string;
  role: string;
  expires_at: string;
}

export interface CurrentUser {
  username: string;
  role: string;
  display_name: string;
}

export interface PlatformUser {
  user_id: string;
  username: string;
  role: string;
  display_name: string;
  created_at: string;
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
  {
    id: 'scn-pol-007',
    name: 'Policy Tampering',
    description: 'Simulates an insider weakening security policy (firewall egress, retention, detection rules) to enable a longer-running campaign.',
  },
];
