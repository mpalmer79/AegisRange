// ============================================================
// AegisRange — Demo Mock Data
//
// Everything the frontend renders in recruiter-demo mode comes
// from this file. No backend, no fetches, no auth. The narrative
// is a fictional satellite-comms company ("Vanta Orbital") with
// a 72-hour SOC window that contains a realistic mix of active
// threats, investigations, and contained incidents.
//
// This file is populated in slices so each commit is independently
// shippable:
//   A.1 — metrics + health skeleton                      (this commit)
//   A.2 — events + alerts feed
//   A.3 — incidents list + drill-down with notes
//   B   — analytics (risk profiles, rules, scenario history)
//   C   — MITRE / kill chain / campaigns / reports
// ============================================================

import type {
  Alert,
  Campaign,
  Event,
  ExerciseReport,
  HealthStatus,
  Incident,
  IncidentResponse,
  KillChainAnalysis,
  KillChainStage,
  Metrics,
  MitreCoverageEntry,
  MitreTactic,
  MitreTechnique,
  PlatformUser,
  RiskProfile,
  RuleEffectiveness,
  ScenarioHistoryEntry,
  TacticCoverage,
  TTPMapping,
} from './types';

// ------------------------------------------------------------
// Reference time
//
// Every relative timestamp in this file is computed off a single
// fixed reference. This guarantees the demo is deterministic: a
// recruiter reloading the page never sees timestamps drift or
// hydration mismatches between SSR and CSR.
// ------------------------------------------------------------

/** Fixed "now" the demo is frozen to. All relative times are offsets from this. */
export const REFERENCE_NOW = new Date('2026-04-10T14:00:00Z').getTime();

/** Returns an ISO string N minutes before the reference "now". */
export function minutesAgo(minutes: number): string {
  return new Date(REFERENCE_NOW - minutes * 60_000).toISOString();
}

/** Returns an ISO string N hours before the reference "now". */
export function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

/** Returns an ISO string N days before the reference "now". */
export function daysAgo(days: number): string {
  return minutesAgo(days * 24 * 60);
}

/** The reference now itself, as an ISO string. */
export const REFERENCE_NOW_ISO = new Date(REFERENCE_NOW).toISOString();

// ------------------------------------------------------------
// Org context (constants the other slices will key off of)
// ------------------------------------------------------------

export const ORG = {
  name: 'Vanta Orbital',
  tagline: 'Low-earth-orbit comms infrastructure',
  primary_domain: 'vanta-orbital.io',
  soc_tier: 'Tier 2',
} as const;

// ------------------------------------------------------------
// Health
// ------------------------------------------------------------

export const MOCK_HEALTH: HealthStatus = {
  status: 'healthy',
  timestamp: REFERENCE_NOW_ISO,
};

// ------------------------------------------------------------
// Metrics
//
// Totals are intentionally higher than the array lengths we'll
// ship in A.2/A.3. That's realistic for a SOC dashboard — the
// feed pages only render a paginated window, not the full set.
// ------------------------------------------------------------

export const MOCK_METRICS: Metrics = {
  total_events: 847,
  total_alerts: 142,
  total_incidents: 16,
  total_responses: 58,
  active_containments: 7,

  events_by_category: {
    authentication: 312,
    session: 158,
    document: 201,
    service: 87,
    network: 89,
  },

  alerts_by_severity: {
    critical: 12,
    high: 34,
    medium: 61,
    low: 28,
    informational: 7,
  },

  incidents_by_status: {
    open: 3,
    investigating: 4,
    contained: 4,
    resolved: 3,
    closed: 2,
  },
};

// ------------------------------------------------------------
// Correlation IDs
//
// Each id below names one narrative chain that ties events,
// alerts, and (in A.3) an incident together. The chains span
// the 72-hour SOC window with a deliberate mix of statuses so
// the demo always shows old/contained activity alongside a
// fresh, still-firing investigation.
//
//   Chain          Status         Window
//   ─────────────────────────────────────
//   AUTH_BRUTE     contained      T-66h
//   SESSION_HIJACK investigating  T-48h
//   DOC_EXFIL      investigating  T-30h
//   SVC_ABUSE      contained      T-20h
//   POLICY_CHANGE  open           T-8h
//   MULTI_STAGE    open (live)    T-2h
//
// Subsequent slices reference these by name so renaming a
// chain only requires touching this object.
// ------------------------------------------------------------

export const CORRELATION_IDS = {
  AUTH_BRUTE: 'corr-auth-brute-001',
  SESSION_HIJACK: 'corr-session-hijack-002',
  DOC_EXFIL: 'corr-doc-exfil-003',
  SVC_ABUSE: 'corr-svc-abuse-004',
  POLICY_CHANGE: 'corr-policy-005',
  MULTI_STAGE: 'corr-multi-stage-006',
} as const;

// ------------------------------------------------------------
// Events
//
// Numbering convention:
//   evt-0001..0009  Chain 1 (AUTH_BRUTE)
//   evt-0010..0019  Chain 2 (SESSION_HIJACK)
//   evt-0020..0029  Chain 3 (DOC_EXFIL)
//   evt-0030..0039  Chain 4 (SVC_ABUSE)
//   evt-0040..0049  Chain 5 (POLICY_CHANGE)
//   evt-0050..0059  Chain 6 (MULTI_STAGE)
//   evt-0100+       baseline noise (uncorrelated)
//
// Every event_type below matches a real backend rule trigger
// in backend/app/services/detection_service.py — when the
// alerts slice lands, contributing_event_ids will point at
// these ids, so nothing dangles.
// ------------------------------------------------------------

const INLINE_EVENTS: Event[] = [
  // ── Chain 1 — AUTH_BRUTE ────────────────────────────────
  // wade.hollis (contractor) hammered from a Tor exit. Six
  // failures inside three minutes followed by a successful
  // login from the same IP — fires DET-AUTH-001 + DET-AUTH-002.
  {
    event_id: 'evt-0001',
    timestamp: minutesAgo(3962),
    event_type: 'authentication.login.failure',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'failure',
    status_code: '401',
    request_id: 'req-3a91',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    error_message: 'invalid_credentials',
    severity: 'low',
    payload: { attempt: 1 },
  },
  {
    event_id: 'evt-0002',
    timestamp: minutesAgo(3961),
    event_type: 'authentication.login.failure',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'failure',
    status_code: '401',
    request_id: 'req-3a92',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    error_message: 'invalid_credentials',
    severity: 'low',
    payload: { attempt: 2 },
  },
  {
    event_id: 'evt-0003',
    timestamp: minutesAgo(3961),
    event_type: 'authentication.login.failure',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'failure',
    status_code: '401',
    request_id: 'req-3a93',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    error_message: 'invalid_credentials',
    severity: 'low',
    payload: { attempt: 3 },
  },
  {
    event_id: 'evt-0004',
    timestamp: minutesAgo(3960),
    event_type: 'authentication.login.failure',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'failure',
    status_code: '401',
    request_id: 'req-3a94',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    error_message: 'invalid_credentials',
    severity: 'medium',
    payload: { attempt: 4 },
  },
  {
    event_id: 'evt-0005',
    timestamp: minutesAgo(3960),
    event_type: 'authentication.login.failure',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'failure',
    status_code: '401',
    request_id: 'req-3a95',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    error_message: 'invalid_credentials',
    severity: 'medium',
    payload: { attempt: 5 },
  },
  {
    event_id: 'evt-0006',
    timestamp: minutesAgo(3960),
    event_type: 'authentication.login.failure',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'failure',
    status_code: '401',
    request_id: 'req-3a96',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    error_message: 'invalid_credentials',
    severity: 'medium',
    payload: { attempt: 6 },
  },
  {
    event_id: 'evt-0007',
    timestamp: minutesAgo(3959),
    event_type: 'authentication.login.success',
    category: 'authentication',
    actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    source_ip: '185.220.101.42',
    status: 'success',
    status_code: '200',
    request_id: 'req-3a97',
    session_id: 'sess-wh-tor-aa11',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    user_agent: 'curl/7.79.1',
    severity: 'high',
    confidence: 'high',
    risk_score: 78,
    payload: { mfa: false, anomaly: 'tor_exit_node' },
  },

  // ── Chain 2 — SESSION_HIJACK ────────────────────────────
  // alex.nguyen issued a token from the corp VPN, then the
  // same token reappears from a Hong Kong IP minutes later —
  // fires DET-SESSION-003.
  {
    event_id: 'evt-0010',
    timestamp: minutesAgo(2880),
    event_type: 'session.token.issued',
    category: 'session',
    actor_id: 'alex.nguyen',
    actor_type: 'user',
    actor_role: 'engineer',
    source_ip: '10.20.4.21',
    status: 'success',
    status_code: '200',
    request_id: 'req-7c10',
    session_id: 'sess-an-corp-7c10',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    origin: 'corp-vpn',
    user_agent: 'Mozilla/5.0 (Macintosh)',
    severity: 'informational',
    payload: { issuer: 'sso-okta', mfa_method: 'webauthn' },
  },
  {
    event_id: 'evt-0011',
    timestamp: minutesAgo(2870),
    event_type: 'authorization.check.success',
    category: 'session',
    actor_id: 'alex.nguyen',
    actor_type: 'user',
    actor_role: 'engineer',
    source_ip: '10.20.4.21',
    status: 'success',
    status_code: '200',
    request_id: 'req-7c11',
    session_id: 'sess-an-corp-7c10',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    origin: 'corp-vpn',
    user_agent: 'Mozilla/5.0 (Macintosh)',
    severity: 'informational',
    payload: { route: '/api/missions/list' },
  },
  {
    event_id: 'evt-0012',
    timestamp: minutesAgo(2865),
    event_type: 'authorization.check.success',
    category: 'session',
    actor_id: 'alex.nguyen',
    actor_type: 'user',
    actor_role: 'engineer',
    source_ip: '203.0.113.77',
    status: 'success',
    status_code: '200',
    request_id: 'req-7c20',
    session_id: 'sess-an-corp-7c10',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    origin: 'external',
    user_agent: 'python-requests/2.31',
    severity: 'high',
    confidence: 'high',
    risk_score: 81,
    payload: { route: '/api/missions/export', geo: 'HK' },
  },
  {
    event_id: 'evt-0013',
    timestamp: minutesAgo(2864),
    event_type: 'authorization.check.failure',
    category: 'session',
    actor_id: 'alex.nguyen',
    actor_type: 'user',
    actor_role: 'engineer',
    source_ip: '203.0.113.77',
    status: 'failure',
    status_code: '403',
    request_id: 'req-7c21',
    session_id: 'sess-an-corp-7c10',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    origin: 'external',
    user_agent: 'python-requests/2.31',
    severity: 'high',
    confidence: 'high',
    risk_score: 82,
    error_message: 'insufficient_scope',
    payload: { route: '/api/admin/users' },
  },

  // ── Chain 3 — DOC_EXFIL ─────────────────────────────────
  // priya.shah failed a classification check on doc-blueprint-Z,
  // then walked through three payload docs read-then-download —
  // fires DET-DOC-004 + DET-DOC-006.
  {
    event_id: 'evt-0020',
    timestamp: minutesAgo(1810),
    event_type: 'document.read.failure',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-blueprint-Z',
    status: 'failure',
    status_code: '403',
    request_id: 'req-d040',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    error_message: 'classification_mismatch',
    severity: 'high',
    confidence: 'high',
    payload: { classification: 'restricted', actor_clearance: 'standard' },
  },
  {
    event_id: 'evt-0021',
    timestamp: minutesAgo(1805),
    event_type: 'document.read.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-payload-A',
    status: 'success',
    status_code: '200',
    request_id: 'req-d041',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    severity: 'medium',
    payload: { classification: 'internal' },
  },
  {
    event_id: 'evt-0022',
    timestamp: minutesAgo(1804),
    event_type: 'document.read.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-payload-B',
    status: 'success',
    status_code: '200',
    request_id: 'req-d042',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    severity: 'medium',
    payload: { classification: 'internal' },
  },
  {
    event_id: 'evt-0023',
    timestamp: minutesAgo(1803),
    event_type: 'document.read.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-payload-C',
    status: 'success',
    status_code: '200',
    request_id: 'req-d043',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    severity: 'medium',
    payload: { classification: 'internal' },
  },
  {
    event_id: 'evt-0024',
    timestamp: minutesAgo(1802),
    event_type: 'document.download.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-payload-A',
    status: 'success',
    status_code: '200',
    request_id: 'req-d044',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    severity: 'high',
    confidence: 'high',
    risk_score: 71,
    payload: { bytes: 4_812_344 },
  },
  {
    event_id: 'evt-0025',
    timestamp: minutesAgo(1801),
    event_type: 'document.download.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-payload-B',
    status: 'success',
    status_code: '200',
    request_id: 'req-d045',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    severity: 'high',
    confidence: 'high',
    risk_score: 73,
    payload: { bytes: 6_120_001 },
  },
  {
    event_id: 'evt-0026',
    timestamp: minutesAgo(1800),
    event_type: 'document.download.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-payload-C',
    status: 'success',
    status_code: '200',
    request_id: 'req-d046',
    session_id: 'sess-ps-corp-d040',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    severity: 'critical',
    confidence: 'high',
    risk_score: 84,
    payload: { bytes: 5_440_902 },
  },

  // ── Chain 4 — SVC_ABUSE ─────────────────────────────────
  // svc-sat-telemetry probed four admin routes in 90 seconds,
  // each rejected — fires DET-SVC-007.
  {
    event_id: 'evt-0030',
    timestamp: minutesAgo(1205),
    event_type: 'authorization.failure',
    category: 'service',
    actor_id: 'svc-sat-telemetry',
    actor_type: 'service',
    source_ip: '10.30.7.4',
    target_type: 'route',
    target_id: '/api/admin/users',
    status: 'failure',
    status_code: '403',
    request_id: 'req-s401',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    severity: 'medium',
    confidence: 'medium',
    payload: { method: 'GET' },
  },
  {
    event_id: 'evt-0031',
    timestamp: minutesAgo(1204),
    event_type: 'authorization.failure',
    category: 'service',
    actor_id: 'svc-sat-telemetry',
    actor_type: 'service',
    source_ip: '10.30.7.4',
    target_type: 'route',
    target_id: '/api/admin/policies',
    status: 'failure',
    status_code: '403',
    request_id: 'req-s402',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    severity: 'medium',
    confidence: 'medium',
    payload: { method: 'GET' },
  },
  {
    event_id: 'evt-0032',
    timestamp: minutesAgo(1203),
    event_type: 'authorization.failure',
    category: 'service',
    actor_id: 'svc-sat-telemetry',
    actor_type: 'service',
    source_ip: '10.30.7.4',
    target_type: 'route',
    target_id: '/api/admin/secrets',
    status: 'failure',
    status_code: '403',
    request_id: 'req-s403',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    severity: 'high',
    confidence: 'high',
    payload: { method: 'GET' },
  },
  {
    event_id: 'evt-0033',
    timestamp: minutesAgo(1200),
    event_type: 'authorization.failure',
    category: 'service',
    actor_id: 'svc-sat-telemetry',
    actor_type: 'service',
    source_ip: '10.30.7.4',
    target_type: 'route',
    target_id: '/api/internal/keys',
    status: 'failure',
    status_code: '403',
    request_id: 'req-s404',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    severity: 'high',
    confidence: 'high',
    payload: { method: 'GET' },
  },

  // ── Chain 5 — POLICY_CHANGE ─────────────────────────────
  // robin.chen pushed three corrupt firmware artifacts and
  // then opened the egress firewall while still flagged for
  // step-up — fires DET-ART-008 + DET-POL-009.
  {
    event_id: 'evt-0040',
    timestamp: minutesAgo(510),
    event_type: 'artifact.validation.failed',
    category: 'service',
    actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    source_ip: '10.20.6.21',
    target_type: 'artifact',
    target_id: 'artifact-firmware-04',
    status: 'failure',
    status_code: '422',
    request_id: 'req-a801',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    severity: 'medium',
    error_message: 'signature_mismatch',
    payload: { sha256_actual: 'b8a1...', sha256_expected: '7c9f...' },
  },
  {
    event_id: 'evt-0041',
    timestamp: minutesAgo(505),
    event_type: 'artifact.validation.failed',
    category: 'service',
    actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    source_ip: '10.20.6.21',
    target_type: 'artifact',
    target_id: 'artifact-firmware-05',
    status: 'failure',
    status_code: '422',
    request_id: 'req-a802',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    severity: 'medium',
    error_message: 'signature_mismatch',
    payload: { sha256_actual: 'c3b2...', sha256_expected: '7c9f...' },
  },
  {
    event_id: 'evt-0042',
    timestamp: minutesAgo(500),
    event_type: 'artifact.validation.failed',
    category: 'service',
    actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    source_ip: '10.20.6.21',
    target_type: 'artifact',
    target_id: 'artifact-firmware-06',
    status: 'failure',
    status_code: '422',
    request_id: 'req-a803',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    severity: 'high',
    error_message: 'signature_mismatch',
    payload: { sha256_actual: 'd4e7...', sha256_expected: '7c9f...' },
  },
  {
    event_id: 'evt-0043',
    timestamp: minutesAgo(485),
    event_type: 'policy.change.executed',
    category: 'network',
    actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    source_ip: '10.20.6.21',
    target_type: 'policy',
    target_id: 'policy-firewall-egress',
    status: 'success',
    status_code: '200',
    request_id: 'req-p901',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    severity: 'critical',
    confidence: 'high',
    risk_score: 88,
    payload: {
      change: 'allow_egress',
      destination_cidr: '0.0.0.0/0',
      step_up_required: true,
    },
  },

  // ── Chain 6 — MULTI_STAGE (live) ────────────────────────
  // mira.delacroix has tripped four rules in fifteen minutes —
  // fires DET-CORR-010.
  {
    event_id: 'evt-0050',
    timestamp: minutesAgo(165),
    event_type: 'detection.rule.triggered',
    category: 'network',
    actor_id: 'mira.delacroix',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '198.51.100.14',
    status: 'observed',
    request_id: 'req-c001',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    severity: 'high',
    confidence: 'high',
    risk_score: 64,
    payload: { rule_id: 'DET-AUTH-002', matched_conditions: { source_ip: '198.51.100.14' } },
  },
  {
    event_id: 'evt-0051',
    timestamp: minutesAgo(150),
    event_type: 'detection.rule.triggered',
    category: 'network',
    actor_id: 'mira.delacroix',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '198.51.100.14',
    status: 'observed',
    request_id: 'req-c002',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    severity: 'high',
    confidence: 'high',
    risk_score: 71,
    payload: { rule_id: 'DET-SESSION-003', matched_conditions: { source_ip: '198.51.100.14' } },
  },
  {
    event_id: 'evt-0052',
    timestamp: minutesAgo(135),
    event_type: 'detection.rule.triggered',
    category: 'network',
    actor_id: 'mira.delacroix',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '198.51.100.14',
    status: 'observed',
    request_id: 'req-c003',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    severity: 'critical',
    confidence: 'high',
    risk_score: 79,
    payload: { rule_id: 'DET-DOC-006', matched_conditions: { source_ip: '198.51.100.14' } },
  },
  {
    event_id: 'evt-0053',
    timestamp: minutesAgo(120),
    event_type: 'detection.rule.triggered',
    category: 'network',
    actor_id: 'mira.delacroix',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '198.51.100.14',
    status: 'observed',
    request_id: 'req-c004',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    severity: 'critical',
    confidence: 'high',
    risk_score: 91,
    payload: { rule_id: 'DET-CORR-010', matched_conditions: { source_ip: '198.51.100.14' } },
  },

  // ── Baseline noise (uncorrelated) ───────────────────────
  // Routine activity so the events feed isn't 100% incidents.
  {
    event_id: 'evt-0100',
    timestamp: minutesAgo(720),
    event_type: 'authentication.login.success',
    category: 'authentication',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    status: 'success',
    status_code: '200',
    request_id: 'req-n001',
    user_agent: 'Mozilla/5.0 (Macintosh)',
    severity: 'informational',
  },
  {
    event_id: 'evt-0101',
    timestamp: minutesAgo(640),
    event_type: 'authentication.login.success',
    category: 'authentication',
    actor_id: 'operator-soc-01',
    actor_type: 'user',
    actor_role: 'operator',
    source_ip: '10.20.6.10',
    status: 'success',
    status_code: '200',
    request_id: 'req-n002',
    user_agent: 'Mozilla/5.0 (Windows)',
    severity: 'informational',
  },
  {
    event_id: 'evt-0102',
    timestamp: minutesAgo(420),
    event_type: 'session.token.issued',
    category: 'session',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    status: 'success',
    status_code: '200',
    request_id: 'req-n003',
    session_id: 'sess-ps-corp-d040',
    severity: 'informational',
    payload: { issuer: 'sso-okta', mfa_method: 'webauthn' },
  },
  {
    event_id: 'evt-0103',
    timestamp: minutesAgo(300),
    event_type: 'document.read.success',
    category: 'document',
    actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    source_ip: '10.20.5.42',
    target_type: 'document',
    target_id: 'doc-runbook-12',
    status: 'success',
    status_code: '200',
    request_id: 'req-n004',
    session_id: 'sess-ps-corp-d040',
    severity: 'informational',
  },
  {
    event_id: 'evt-0104',
    timestamp: minutesAgo(240),
    event_type: 'authentication.login.success',
    category: 'authentication',
    actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    source_ip: '10.20.6.21',
    status: 'success',
    status_code: '200',
    request_id: 'req-n005',
    user_agent: 'Mozilla/5.0 (Linux)',
    severity: 'informational',
  },
  {
    event_id: 'evt-0105',
    timestamp: minutesAgo(95),
    event_type: 'session.token.issued',
    category: 'session',
    actor_id: 'operator-soc-02',
    actor_type: 'user',
    actor_role: 'operator',
    source_ip: '10.20.6.11',
    status: 'success',
    status_code: '200',
    request_id: 'req-n006',
    session_id: 'sess-os02-corp-n006',
    severity: 'informational',
  },
];

export const MOCK_EVENTS: Event[] = [
  ...INLINE_EVENTS,
  ...generateBaselineNoise(),
];

// ------------------------------------------------------------
// Baseline noise factory
//
// Hand-crafting ~800 routine SOC events would bloat this file
// into the tens of thousands of lines with no review benefit —
// each event is identical to the next except for an id and a
// timestamp. Instead, we generate the bulk noise deterministically
// from a small set of templates at module-load time. Every
// invocation produces byte-identical output, so the demo stays
// stable across reloads (same event ids, same timestamps, same
// ordering) and downstream derivations (filterEvents, metrics
// category counts, exercise report totals) line up exactly.
//
// Category targets match MOCK_METRICS.events_by_category minus
// the events already contributed by the narrative chains and the
// inline noise above:
//
//   category        chain  inline  generated  total (target)
//   ─────────────────────────────────────────────────────────
//   authentication     7      3        302      312 (312)
//   session            4      2        152      158 (158)
//   document           7      1        193      201 (201)
//   service            7      0         80       87  (87)
//   network            5      0         84       89  (89)
//   ─────────────────────────────────────────────────────────
//   totals            30      6        811      847 (847)
//
// Generated event ids use the `evt-nNNNN` prefix so they never
// collide with hand-crafted ids (`evt-NNNN`).
// ------------------------------------------------------------

interface NoiseUser {
  id: string;
  role: string;
  ip: string;
  ua: string;
}

const NOISE_USERS: NoiseUser[] = [
  { id: 'operator-soc-01', role: 'operator', ip: '10.20.6.10', ua: 'Mozilla/5.0 (Windows)' },
  { id: 'operator-soc-02', role: 'operator', ip: '10.20.6.11', ua: 'Mozilla/5.0 (Windows)' },
  { id: 'alex.nguyen', role: 'engineer', ip: '10.20.4.21', ua: 'Mozilla/5.0 (Macintosh)' },
  { id: 'eli.kwon', role: 'engineer', ip: '10.20.4.33', ua: 'Mozilla/5.0 (Macintosh)' },
  { id: 'li.wei', role: 'engineer', ip: '10.20.4.71', ua: 'Mozilla/5.0 (Windows)' },
  { id: 'priya.shah', role: 'analyst', ip: '10.20.5.42', ua: 'Mozilla/5.0 (Macintosh)' },
  { id: 'mira.delacroix', role: 'analyst', ip: '10.20.5.14', ua: 'Mozilla/5.0 (Linux)' },
  { id: 'dana.obi', role: 'analyst', ip: '10.20.5.55', ua: 'Mozilla/5.0 (Windows)' },
  { id: 'robin.chen', role: 'platform-admin', ip: '10.20.6.21', ua: 'Mozilla/5.0 (Linux)' },
  { id: 'jessie.park', role: 'contractor', ip: '10.20.7.12', ua: 'Mozilla/5.0 (Linux)' },
];

const NOISE_DOCS = [
  'doc-runbook-01',
  'doc-runbook-02',
  'doc-policy-11',
  'doc-policy-12',
  'doc-internal-21',
  'doc-internal-22',
  'doc-metrics-31',
  'doc-metrics-32',
  'doc-handbook-41',
  'doc-handbook-42',
  'doc-postmortem-51',
  'doc-postmortem-52',
];

interface NoiseService {
  id: string;
  ip: string;
}

const NOISE_SERVICES: NoiseService[] = [
  { id: 'svc-api-gateway', ip: '10.30.1.1' },
  { id: 'svc-cache-redis', ip: '10.30.1.2' },
  { id: 'svc-metrics-collector', ip: '10.30.1.3' },
  { id: 'svc-log-forwarder', ip: '10.30.1.4' },
  { id: 'svc-telemetry-ingest', ip: '10.30.1.5' },
];

/** Spread `count` events linearly across a 30-min-to-~71-hr window. */
function spreadOffset(i: number, count: number): number {
  const MIN = 30;
  const MAX = 4300;
  if (count <= 1) return MAX;
  return Math.floor(MIN + ((MAX - MIN) * (count - 1 - i)) / (count - 1));
}

function generateBaselineNoise(): Event[] {
  const events: Event[] = [];
  let seq = 0;

  function push(partial: Omit<Event, 'event_id'>): void {
    events.push({
      event_id: `evt-n${String(seq).padStart(4, '0')}`,
      ...partial,
    });
    seq += 1;
  }

  // ---- Authentication noise (302 events) ----
  // Mix ~80% login.success, ~10% benign login.failure, ~10% mfa
  // so the feed reads like real SOC traffic rather than a single
  // event type repeated 302 times.
  const AUTH_COUNT = 302;
  const authTypes = [
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.success',
    'authentication.login.failure',
    'authentication.mfa.success',
  ];
  for (let i = 0; i < AUTH_COUNT; i += 1) {
    const actor = NOISE_USERS[i % NOISE_USERS.length];
    const eventType = authTypes[i % authTypes.length];
    const isFailure = eventType === 'authentication.login.failure';
    push({
      timestamp: minutesAgo(spreadOffset(i, AUTH_COUNT)),
      event_type: eventType,
      category: 'authentication',
      actor_id: actor.id,
      actor_type: 'user',
      actor_role: actor.role,
      source_ip: actor.ip,
      status: isFailure ? 'failure' : 'success',
      status_code: isFailure ? '401' : '200',
      request_id: `req-nauth${i}`,
      user_agent: actor.ua,
      severity: isFailure ? 'low' : 'informational',
      ...(isFailure && { error_message: 'invalid_credentials' }),
    });
  }

  // ---- Session noise (152 events) ----
  const SESSION_COUNT = 152;
  const sessionTypes = [
    'session.token.issued',
    'authorization.check.success',
    'authorization.check.success',
    'session.token.refreshed',
  ];
  for (let i = 0; i < SESSION_COUNT; i += 1) {
    const actor = NOISE_USERS[i % NOISE_USERS.length];
    push({
      timestamp: minutesAgo(spreadOffset(i, SESSION_COUNT)),
      event_type: sessionTypes[i % sessionTypes.length],
      category: 'session',
      actor_id: actor.id,
      actor_type: 'user',
      actor_role: actor.role,
      source_ip: actor.ip,
      status: 'success',
      status_code: '200',
      request_id: `req-nsess${i}`,
      session_id: `sess-n-${actor.id}-${Math.floor(i / 4)}`,
      user_agent: actor.ua,
      severity: 'informational',
    });
  }

  // ---- Document noise (193 events) ----
  const DOC_COUNT = 193;
  const docTypes = [
    'document.read.success',
    'document.read.success',
    'document.read.success',
    'document.list.success',
  ];
  for (let i = 0; i < DOC_COUNT; i += 1) {
    const actor = NOISE_USERS[i % NOISE_USERS.length];
    push({
      timestamp: minutesAgo(spreadOffset(i, DOC_COUNT)),
      event_type: docTypes[i % docTypes.length],
      category: 'document',
      actor_id: actor.id,
      actor_type: 'user',
      actor_role: actor.role,
      source_ip: actor.ip,
      target_type: 'document',
      target_id: NOISE_DOCS[i % NOISE_DOCS.length],
      status: 'success',
      status_code: '200',
      request_id: `req-ndoc${i}`,
      session_id: `sess-n-${actor.id}-doc`,
      severity: 'informational',
    });
  }

  // ---- Service noise (80 events) ----
  const SVC_COUNT = 80;
  const svcTypes = [
    'service.health.check',
    'authorization.check.success',
    'service.config.reload',
  ];
  for (let i = 0; i < SVC_COUNT; i += 1) {
    const svc = NOISE_SERVICES[i % NOISE_SERVICES.length];
    push({
      timestamp: minutesAgo(spreadOffset(i, SVC_COUNT)),
      event_type: svcTypes[i % svcTypes.length],
      category: 'service',
      actor_id: svc.id,
      actor_type: 'service',
      source_ip: svc.ip,
      status: 'success',
      status_code: '200',
      request_id: `req-nsvc${i}`,
      severity: 'informational',
    });
  }

  // ---- Network noise (84 events) ----
  const NET_COUNT = 84;
  const netTypes = [
    'network.flow.observed',
    'firewall.rule.evaluated',
    'network.policy.audit',
  ];
  for (let i = 0; i < NET_COUNT; i += 1) {
    push({
      timestamp: minutesAgo(spreadOffset(i, NET_COUNT)),
      event_type: netTypes[i % netTypes.length],
      category: 'network',
      actor_id: 'firewall-edge-01',
      actor_type: 'service',
      source_ip: '10.20.1.1',
      status: 'observed',
      request_id: `req-nnet${i}`,
      severity: 'informational',
    });
  }

  return events;
}

// ------------------------------------------------------------
// Alerts
//
// One alert per detection rule that fires across the six
// chains. Every contributing_event_id below points to a real
// event in MOCK_EVENTS — nothing dangling. rule_name strings
// match backend/app/services/detection_service.py verbatim so
// the alerts table reads identically in live and mock modes.
// ------------------------------------------------------------

export const MOCK_ALERTS: Alert[] = [
  // Chain 1 — AUTH_BRUTE
  {
    alert_id: 'alert-0001',
    created_at: minutesAgo(3960),
    rule_id: 'DET-AUTH-001',
    rule_name: 'Repeated Authentication Failure Burst',
    severity: 'medium',
    confidence: 'medium',
    actor_id: 'wade.hollis',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    contributing_event_ids: [
      'evt-0001',
      'evt-0002',
      'evt-0003',
      'evt-0004',
      'evt-0005',
      'evt-0006',
    ],
    summary: 'Detected 6 authentication failures in 2 minutes.',
    payload: { failure_count: 6, source_ip: '185.220.101.42' },
  },
  {
    alert_id: 'alert-0002',
    created_at: minutesAgo(3959),
    rule_id: 'DET-AUTH-002',
    rule_name: 'Suspicious Success After Failure Sequence',
    severity: 'high',
    confidence: 'high',
    actor_id: 'wade.hollis',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    contributing_event_ids: [
      'evt-0001',
      'evt-0002',
      'evt-0003',
      'evt-0004',
      'evt-0005',
      'evt-0006',
      'evt-0007',
    ],
    summary: 'Successful authentication followed repeated failures within 5 minutes.',
    payload: {
      failure_count: 6,
      success_event_id: 'evt-0007',
      time_delta_seconds: 60,
    },
  },

  // Chain 2 — SESSION_HIJACK
  {
    alert_id: 'alert-0003',
    created_at: minutesAgo(2864),
    rule_id: 'DET-SESSION-003',
    rule_name: 'Token Reuse From Conflicting Origins',
    severity: 'high',
    confidence: 'high',
    actor_id: 'alex.nguyen',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    contributing_event_ids: ['evt-0010', 'evt-0011', 'evt-0012', 'evt-0013'],
    summary: 'Session sess-an-corp-7c10 used from 2 different IPs within 5 minutes.',
    payload: {
      session_id: 'sess-an-corp-7c10',
      source_ip_list: ['10.20.4.21', '203.0.113.77'],
    },
  },

  // Chain 3 — DOC_EXFIL
  {
    alert_id: 'alert-0004',
    created_at: minutesAgo(1810),
    rule_id: 'DET-DOC-004',
    rule_name: 'Restricted Document Access Outside Role Scope',
    severity: 'high',
    confidence: 'high',
    actor_id: 'priya.shah',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    contributing_event_ids: ['evt-0020'],
    summary: 'Access attempt to document doc-blueprint-Z denied due to classification mismatch.',
    payload: {
      document_id: 'doc-blueprint-Z',
      classification: 'restricted',
      actor_role: 'analyst',
    },
  },
  {
    alert_id: 'alert-0005',
    created_at: minutesAgo(1800),
    rule_id: 'DET-DOC-006',
    rule_name: 'Read-To-Download Staging Pattern',
    severity: 'critical',
    confidence: 'high',
    actor_id: 'priya.shah',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    contributing_event_ids: [
      'evt-0021',
      'evt-0022',
      'evt-0023',
      'evt-0024',
      'evt-0025',
      'evt-0026',
    ],
    summary: 'Detected read-to-download staging: 3 overlapping documents.',
    payload: {
      read_count: 3,
      download_count: 3,
      overlapping_documents: ['doc-payload-A', 'doc-payload-B', 'doc-payload-C'],
    },
  },

  // Chain 4 — SVC_ABUSE
  {
    alert_id: 'alert-0006',
    created_at: minutesAgo(1203),
    rule_id: 'DET-SVC-007',
    rule_name: 'Unauthorized Service Identity Route Access',
    severity: 'high',
    confidence: 'medium',
    actor_id: 'svc-sat-telemetry',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    contributing_event_ids: ['evt-0030', 'evt-0031', 'evt-0032', 'evt-0033'],
    summary: 'Service svc-sat-telemetry made 4 unauthorized route attempts in 2 minutes.',
    payload: {
      service_id: 'svc-sat-telemetry',
      route_list: [
        '/api/admin/policies',
        '/api/admin/secrets',
        '/api/admin/users',
        '/api/internal/keys',
      ],
      failure_count: 4,
    },
  },

  // Chain 5 — POLICY_CHANGE
  {
    alert_id: 'alert-0007',
    created_at: minutesAgo(500),
    rule_id: 'DET-ART-008',
    rule_name: 'Artifact Validation Failure Pattern',
    severity: 'medium',
    confidence: 'medium',
    actor_id: 'robin.chen',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    contributing_event_ids: ['evt-0040', 'evt-0041', 'evt-0042'],
    summary: 'Detected 3 artifact validation failures in 10 minutes.',
    payload: {
      artifact_ids: [
        'artifact-firmware-04',
        'artifact-firmware-05',
        'artifact-firmware-06',
      ],
      failure_count: 3,
    },
  },
  {
    alert_id: 'alert-0008',
    created_at: minutesAgo(485),
    rule_id: 'DET-POL-009',
    rule_name: 'Privileged Policy Change With Elevated Risk Context',
    severity: 'critical',
    confidence: 'high',
    actor_id: 'robin.chen',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    contributing_event_ids: ['evt-0043'],
    summary: 'Policy change by robin.chen while under elevated risk (step_up_required).',
    payload: {
      policy_id: 'policy-firewall-egress',
      actor_risk_context: 'step_up_required',
    },
  },

  // Chain 6 — MULTI_STAGE
  {
    alert_id: 'alert-0009',
    created_at: minutesAgo(120),
    rule_id: 'DET-CORR-010',
    rule_name: 'Multi-Signal Compromise Sequence',
    severity: 'critical',
    confidence: 'high',
    actor_id: 'mira.delacroix',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    contributing_event_ids: ['evt-0050', 'evt-0051', 'evt-0052', 'evt-0053'],
    summary: 'Correlated 4 distinct detections within 15 minutes.',
    payload: {
      detection_ids: [
        'DET-AUTH-002',
        'DET-CORR-010',
        'DET-DOC-006',
        'DET-SESSION-003',
      ],
      actor_id: 'mira.delacroix',
      timeline_summary: '4 detection events across 4 rules',
    },
  },
];

// ------------------------------------------------------------
// Incidents
//
// One incident per correlation chain. Every incident stitches
// together the events and alerts that belong to its chain into
// a chronological timeline so the drill-down view tells a
// coherent story end-to-end.
//
// Status mix is intentional — recruiters always see at least
// one open, one investigating, one contained incident no
// matter when they load the demo.
//
//   inc-0001  AUTH_BRUTE      contained      (T-66h, closed loop)
//   inc-0002  SESSION_HIJACK  investigating  (T-48h, no response yet)
//   inc-0003  DOC_EXFIL       investigating  (T-30h, download blocked)
//   inc-0004  SVC_ABUSE       contained      (T-20h, service disabled)
//   inc-0005  POLICY_CHANGE   open           (T-8h, awaiting triage)
//   inc-0006  MULTI_STAGE     open           (T-2h, still firing)
// ------------------------------------------------------------

export const MOCK_INCIDENTS: Incident[] = [
  // ── Incident 1 — AUTH_BRUTE (contained) ───────────────────
  {
    incident_id: 'inc-0001',
    incident_type: 'credential_compromise',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    status: 'contained',
    severity: 'high',
    confidence: 'high',
    risk_score: 78,
    primary_actor_id: 'wade.hollis',
    actor_type: 'user',
    actor_role: 'contractor',
    detection_ids: ['DET-AUTH-001', 'DET-AUTH-002'],
    detection_summary: [
      '6 authentication failures in 2 minutes from a Tor exit',
      'Successful login immediately after the failure burst',
    ],
    response_ids: ['resp-0001'],
    containment_status: 'session_revoked',
    event_ids: [
      'evt-0001',
      'evt-0002',
      'evt-0003',
      'evt-0004',
      'evt-0005',
      'evt-0006',
      'evt-0007',
    ],
    affected_documents: [],
    affected_sessions: ['sess-wh-tor-aa11'],
    affected_services: [],
    affected_resources: {
      sessions: ['sess-wh-tor-aa11'],
      actors: ['wade.hollis'],
    },
    timeline: [
      {
        timestamp: minutesAgo(3962),
        entry_type: 'event',
        entry_id: 'evt-0001',
        summary: 'First authentication failure for wade.hollis from 185.220.101.42.',
      },
      {
        timestamp: minutesAgo(3960),
        entry_type: 'alert',
        entry_id: 'alert-0001',
        summary: 'DET-AUTH-001 fired: 6 failures in 2 minutes.',
      },
      {
        timestamp: minutesAgo(3959),
        entry_type: 'event',
        entry_id: 'evt-0007',
        summary: 'Authentication succeeded from the same Tor exit.',
      },
      {
        timestamp: minutesAgo(3959),
        entry_type: 'alert',
        entry_id: 'alert-0002',
        summary: 'DET-AUTH-002 fired: success after failure sequence.',
      },
      {
        timestamp: minutesAgo(3955),
        entry_type: 'response',
        entry_id: 'resp-0001',
        summary: 'Session sess-wh-tor-aa11 force-revoked; password reset required.',
      },
      {
        timestamp: minutesAgo(3950),
        entry_type: 'status_change',
        entry_id: 'inc-0001-sc-1',
        summary: 'Status moved to contained after session revocation confirmed.',
      },
    ],
    created_at: minutesAgo(3960),
    updated_at: minutesAgo(3950),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0001',
        author: 'priya.shah',
        content:
          'Source IP is a known Tor exit from the public list. Forced reset and revoked all wade.hollis sessions; awaiting password update before re-enabling.',
        created_at: minutesAgo(3949),
      },
      {
        note_id: 'note-0002',
        author: 'operator-soc-01',
        content: 'No lateral movement observed in the 6h window after revocation. Holding contained.',
        created_at: minutesAgo(3700),
      },
    ],
  },

  // ── Incident 2 — SESSION_HIJACK (investigating) ───────────
  {
    incident_id: 'inc-0002',
    incident_type: 'session_hijack',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    status: 'investigating',
    severity: 'high',
    confidence: 'high',
    risk_score: 82,
    primary_actor_id: 'alex.nguyen',
    actor_type: 'user',
    actor_role: 'engineer',
    detection_ids: ['DET-SESSION-003'],
    detection_summary: ['Same session token used from 2 IPs (US corp + HK external) in 5 minutes'],
    response_ids: [],
    containment_status: 'pending',
    event_ids: ['evt-0010', 'evt-0011', 'evt-0012', 'evt-0013'],
    affected_documents: [],
    affected_sessions: ['sess-an-corp-7c10'],
    affected_services: [],
    affected_resources: {
      sessions: ['sess-an-corp-7c10'],
      actors: ['alex.nguyen'],
    },
    timeline: [
      {
        timestamp: minutesAgo(2880),
        entry_type: 'event',
        entry_id: 'evt-0010',
        summary: 'Session token issued to alex.nguyen from corp VPN.',
      },
      {
        timestamp: minutesAgo(2865),
        entry_type: 'event',
        entry_id: 'evt-0012',
        summary: 'Same token used from 203.0.113.77 (HK).',
      },
      {
        timestamp: minutesAgo(2864),
        entry_type: 'alert',
        entry_id: 'alert-0003',
        summary: 'DET-SESSION-003 fired: token reuse from conflicting origins.',
      },
      {
        timestamp: minutesAgo(2860),
        entry_type: 'status_change',
        entry_id: 'inc-0002-sc-1',
        summary: 'Status moved to investigating; awaiting decision on session revocation.',
      },
    ],
    created_at: minutesAgo(2864),
    updated_at: minutesAgo(2860),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0003',
        author: 'priya.shah',
        content:
          'alex.nguyen confirmed via Slack they are at the corp office in SF. The HK origin is not legitimate. Recommend revoke + force re-auth pending IR sign-off.',
        created_at: minutesAgo(2700),
      },
    ],
  },

  // ── Incident 3 — DOC_EXFIL (investigating) ────────────────
  {
    incident_id: 'inc-0003',
    incident_type: 'data_exfiltration',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    status: 'investigating',
    severity: 'critical',
    confidence: 'high',
    risk_score: 84,
    primary_actor_id: 'priya.shah',
    actor_type: 'user',
    actor_role: 'analyst',
    detection_ids: ['DET-DOC-004', 'DET-DOC-006'],
    detection_summary: [
      'Restricted document access denied (classification mismatch)',
      'Read-to-download staging across 3 overlapping documents',
    ],
    response_ids: ['resp-0003'],
    containment_status: 'download_restricted',
    event_ids: [
      'evt-0020',
      'evt-0021',
      'evt-0022',
      'evt-0023',
      'evt-0024',
      'evt-0025',
      'evt-0026',
    ],
    affected_documents: [
      'doc-blueprint-Z',
      'doc-payload-A',
      'doc-payload-B',
      'doc-payload-C',
    ],
    affected_sessions: ['sess-ps-corp-d040'],
    affected_services: [],
    affected_resources: {
      documents: [
        'doc-blueprint-Z',
        'doc-payload-A',
        'doc-payload-B',
        'doc-payload-C',
      ],
      sessions: ['sess-ps-corp-d040'],
      actors: ['priya.shah'],
    },
    timeline: [
      {
        timestamp: minutesAgo(1810),
        entry_type: 'alert',
        entry_id: 'alert-0004',
        summary: 'DET-DOC-004 fired: priya.shah denied access to doc-blueprint-Z.',
      },
      {
        timestamp: minutesAgo(1805),
        entry_type: 'event',
        entry_id: 'evt-0021',
        summary: 'priya.shah read doc-payload-A.',
      },
      {
        timestamp: minutesAgo(1802),
        entry_type: 'event',
        entry_id: 'evt-0024',
        summary: 'priya.shah downloaded doc-payload-A.',
      },
      {
        timestamp: minutesAgo(1800),
        entry_type: 'alert',
        entry_id: 'alert-0005',
        summary: 'DET-DOC-006 fired: read-to-download staging on 3 docs.',
      },
      {
        timestamp: minutesAgo(1795),
        entry_type: 'response',
        entry_id: 'resp-0003',
        summary: 'Download privilege revoked for priya.shah.',
      },
      {
        timestamp: minutesAgo(1790),
        entry_type: 'status_change',
        entry_id: 'inc-0003-sc-1',
        summary: 'Status moved to investigating pending interview with priya.shah.',
      },
    ],
    created_at: minutesAgo(1810),
    updated_at: minutesAgo(1790),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0004',
        author: 'operator-soc-01',
        content: 'priya.shah account flagged after the blueprint denial. Download restriction is in place.',
        created_at: minutesAgo(1789),
      },
      {
        note_id: 'note-0005',
        author: 'mira.delacroix',
        content:
          'Reviewed doc-payload-A through C — all three are draft launch slides marked internal. Possible legitimate prep work, but the staging pattern still warrants interview.',
        created_at: minutesAgo(1500),
      },
    ],
  },

  // ── Incident 4 — SVC_ABUSE (contained) ────────────────────
  {
    incident_id: 'inc-0004',
    incident_type: 'service_account_abuse',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    status: 'contained',
    severity: 'high',
    confidence: 'medium',
    risk_score: 65,
    primary_actor_id: 'svc-sat-telemetry',
    actor_type: 'service',
    actor_role: null,
    detection_ids: ['DET-SVC-007'],
    detection_summary: ['svc-sat-telemetry probed 4 admin routes in 90 seconds'],
    response_ids: ['resp-0004'],
    containment_status: 'service_disabled',
    event_ids: ['evt-0030', 'evt-0031', 'evt-0032', 'evt-0033'],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['svc-sat-telemetry'],
    affected_resources: {
      services: ['svc-sat-telemetry'],
    },
    timeline: [
      {
        timestamp: minutesAgo(1205),
        entry_type: 'event',
        entry_id: 'evt-0030',
        summary: 'svc-sat-telemetry hit /api/admin/users (403).',
      },
      {
        timestamp: minutesAgo(1203),
        entry_type: 'alert',
        entry_id: 'alert-0006',
        summary: 'DET-SVC-007 fired: 4 unauthorized admin routes in 2 minutes.',
      },
      {
        timestamp: minutesAgo(1200),
        entry_type: 'response',
        entry_id: 'resp-0004',
        summary: 'svc-sat-telemetry disabled and rotated.',
      },
      {
        timestamp: minutesAgo(1198),
        entry_type: 'status_change',
        entry_id: 'inc-0004-sc-1',
        summary: 'Status moved to contained after service disable confirmed.',
      },
    ],
    created_at: minutesAgo(1203),
    updated_at: minutesAgo(1198),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0006',
        author: 'robin.chen',
        content:
          'Service account had drifted past its declared scope after a deployment rollback. Disabled and pending owner sign-off before re-enabling.',
        created_at: minutesAgo(1190),
      },
    ],
  },

  // ── Incident 5 — POLICY_CHANGE (open) ─────────────────────
  {
    incident_id: 'inc-0005',
    incident_type: 'privileged_policy_change',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    status: 'open',
    severity: 'critical',
    confidence: 'high',
    risk_score: 88,
    primary_actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    detection_ids: ['DET-ART-008', 'DET-POL-009'],
    detection_summary: [
      '3 firmware artifacts failed signature validation',
      'Egress firewall opened by an actor under step-up requirement',
    ],
    response_ids: [],
    containment_status: 'pending',
    event_ids: ['evt-0040', 'evt-0041', 'evt-0042', 'evt-0043'],
    affected_documents: [],
    affected_sessions: [],
    affected_services: [],
    affected_resources: {
      actors: ['robin.chen'],
    },
    timeline: [
      {
        timestamp: minutesAgo(510),
        entry_type: 'event',
        entry_id: 'evt-0040',
        summary: 'artifact-firmware-04 failed signature check.',
      },
      {
        timestamp: minutesAgo(500),
        entry_type: 'alert',
        entry_id: 'alert-0007',
        summary: 'DET-ART-008 fired: 3 artifact validation failures in 10 minutes.',
      },
      {
        timestamp: minutesAgo(485),
        entry_type: 'event',
        entry_id: 'evt-0043',
        summary: 'robin.chen pushed allow_egress 0.0.0.0/0 to policy-firewall-egress.',
      },
      {
        timestamp: minutesAgo(484),
        entry_type: 'alert',
        entry_id: 'alert-0008',
        summary: 'DET-POL-009 fired: privileged policy change under elevated risk.',
      },
    ],
    created_at: minutesAgo(500),
    updated_at: minutesAgo(484),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0007',
        author: 'operator-soc-02',
        content:
          'robin.chen is on step_up_required from a prior risk event — the policy change should not have been allowed. Paged platform on-call.',
        created_at: minutesAgo(470),
      },
    ],
  },

  // ── Incident 6 — MULTI_STAGE (open, live) ─────────────────
  {
    incident_id: 'inc-0006',
    incident_type: 'multi_signal_compromise',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    status: 'open',
    severity: 'critical',
    confidence: 'high',
    risk_score: 91,
    primary_actor_id: 'mira.delacroix',
    actor_type: 'user',
    actor_role: 'analyst',
    detection_ids: ['DET-CORR-010'],
    detection_summary: ['4 distinct detection rules tripped within 15 minutes'],
    response_ids: [],
    containment_status: 'pending',
    event_ids: ['evt-0050', 'evt-0051', 'evt-0052', 'evt-0053'],
    affected_documents: [],
    affected_sessions: [],
    affected_services: [],
    affected_resources: {
      actors: ['mira.delacroix'],
    },
    timeline: [
      {
        timestamp: minutesAgo(165),
        entry_type: 'event',
        entry_id: 'evt-0050',
        summary: 'DET-AUTH-002 trigger observed for mira.delacroix.',
      },
      {
        timestamp: minutesAgo(150),
        entry_type: 'event',
        entry_id: 'evt-0051',
        summary: 'DET-SESSION-003 trigger observed for mira.delacroix.',
      },
      {
        timestamp: minutesAgo(135),
        entry_type: 'event',
        entry_id: 'evt-0052',
        summary: 'DET-DOC-006 trigger observed for mira.delacroix.',
      },
      {
        timestamp: minutesAgo(120),
        entry_type: 'event',
        entry_id: 'evt-0053',
        summary: 'DET-CORR-010 self-reference in the multi-signal sequence.',
      },
      {
        timestamp: minutesAgo(120),
        entry_type: 'alert',
        entry_id: 'alert-0009',
        summary: 'DET-CORR-010 fired: 4 distinct detections within 15 minutes.',
      },
    ],
    created_at: minutesAgo(165),
    updated_at: minutesAgo(120),
    closed_at: null,
    notes: [],
  },

  // ============================================================
  // Background incidents (inc-0007 .. inc-0016)
  //
  // Ten historical / lower-priority incidents that bring the
  // total to MOCK_METRICS.total_incidents (16) with the exact
  // status distribution from MOCK_METRICS.incidents_by_status:
  //
  //   status         chain  background  total (target)
  //   ─────────────────────────────────────────────────
  //   open              2        1         3  (3)
  //   investigating     2        2         4  (4)
  //   contained         2        2         4  (4)
  //   resolved          0        3         3  (3)
  //   closed            0        2         2  (2)
  //   ─────────────────────────────────────────────────
  //   totals            6       10        16  (16)
  //
  // Background incidents are intentionally sparse: empty
  // event_ids, no contributing alerts in MOCK_ALERTS, minimal
  // timelines. They exist to populate the incidents feed /
  // metrics panel realistically — a recruiter sees 16 rows in
  // the incidents drawer instead of 6, but the narrative focus
  // stays on the six correlation chains above.
  //
  // Every detection_id references a real DET-* rule from the
  // backend ruleset; response_ids are forward references to
  // MOCK_RESPONSES entries added in a later commit.
  // ============================================================

  // ── Incident 7 — benign scheduled-job retries (resolved) ──
  {
    incident_id: 'inc-0007',
    incident_type: 'credential_compromise',
    correlation_id: 'corr-bg-auth-007',
    status: 'resolved',
    severity: 'low',
    confidence: 'low',
    risk_score: 12,
    primary_actor_id: 'cron-jobs-scheduler',
    actor_type: 'service',
    actor_role: null,
    detection_ids: ['DET-AUTH-001'],
    detection_summary: [
      'Repeated Authentication Failure Burst triggered by scheduled-job credential refresh backoff.',
    ],
    response_ids: ['resp-0005'],
    containment_status: 'false_positive_closed',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['cron-jobs-scheduler'],
    affected_resources: { services: ['cron-jobs-scheduler'] },
    timeline: [
      {
        timestamp: daysAgo(5),
        entry_type: 'alert',
        entry_id: 'inc-0007-a1',
        summary: 'DET-AUTH-001 fired on cron-jobs-scheduler credential retries.',
      },
      {
        timestamp: daysAgo(5),
        entry_type: 'status_change',
        entry_id: 'inc-0007-sc1',
        summary: 'Status moved to investigating.',
      },
      {
        timestamp: daysAgo(4),
        entry_type: 'response',
        entry_id: 'resp-0005',
        summary: 'Marked false positive after identifying backoff loop.',
      },
      {
        timestamp: daysAgo(4),
        entry_type: 'status_change',
        entry_id: 'inc-0007-sc2',
        summary: 'Status moved to resolved.',
      },
    ],
    created_at: daysAgo(5),
    updated_at: daysAgo(4),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0007-1',
        author: 'operator-soc-02',
        content:
          'Scheduler was retrying a stale credential after a secret-rotation window. Added rate-limit exemption for the service account to prevent future false positives.',
        created_at: daysAgo(4),
      },
    ],
  },

  // ── Incident 8 — contractor offboarding miss (resolved) ──
  {
    incident_id: 'inc-0008',
    incident_type: 'access_policy_violation',
    correlation_id: 'corr-bg-auth-008',
    status: 'resolved',
    severity: 'medium',
    confidence: 'high',
    risk_score: 35,
    primary_actor_id: 'jessie.park',
    actor_type: 'user',
    actor_role: 'contractor',
    detection_ids: ['DET-AUTH-002'],
    detection_summary: [
      'Successful authentication after contractor offboarding checkpoint.',
    ],
    response_ids: ['resp-0006'],
    containment_status: 'access_revoked',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: [],
    affected_resources: { actors: ['jessie.park'] },
    timeline: [
      {
        timestamp: daysAgo(4),
        entry_type: 'alert',
        entry_id: 'inc-0008-a1',
        summary: 'DET-AUTH-002 fired — contractor login after scheduled offboarding.',
      },
      {
        timestamp: daysAgo(4),
        entry_type: 'status_change',
        entry_id: 'inc-0008-sc1',
        summary: 'Status moved to investigating.',
      },
      {
        timestamp: daysAgo(3),
        entry_type: 'response',
        entry_id: 'resp-0006',
        summary: 'Access revoked; identity records reconciled against HR offboard list.',
      },
      {
        timestamp: daysAgo(3),
        entry_type: 'status_change',
        entry_id: 'inc-0008-sc2',
        summary: 'Status moved to resolved.',
      },
    ],
    created_at: daysAgo(4),
    updated_at: daysAgo(3),
    closed_at: null,
    notes: [],
  },

  // ── Incident 9 — low-and-slow credential spray (resolved) ──
  {
    incident_id: 'inc-0009',
    incident_type: 'credential_compromise',
    correlation_id: 'corr-bg-auth-009',
    status: 'resolved',
    severity: 'medium',
    confidence: 'medium',
    risk_score: 42,
    primary_actor_id: 'unknown-external',
    actor_type: 'external',
    actor_role: null,
    detection_ids: ['DET-AUTH-001'],
    detection_summary: [
      'Low-and-slow credential spray against the identity edge over ~4 hours from a residential proxy range.',
    ],
    response_ids: ['resp-0007'],
    containment_status: 'ip_blocked',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['svc-identity-edge'],
    affected_resources: { services: ['svc-identity-edge'] },
    timeline: [
      {
        timestamp: daysAgo(3),
        entry_type: 'alert',
        entry_id: 'inc-0009-a1',
        summary: 'DET-AUTH-001 fired — sustained failure pattern from external range.',
      },
      {
        timestamp: daysAgo(2),
        entry_type: 'response',
        entry_id: 'resp-0007',
        summary: 'Source CIDR blocked at the identity edge firewall.',
      },
      {
        timestamp: daysAgo(2),
        entry_type: 'status_change',
        entry_id: 'inc-0009-sc1',
        summary: 'Status moved to resolved.',
      },
    ],
    created_at: daysAgo(3),
    updated_at: daysAgo(2),
    closed_at: null,
    notes: [],
  },

  // ── Incident 10 — certificate-rotation false positive (closed) ──
  {
    incident_id: 'inc-0010',
    incident_type: 'policy_change_anomaly',
    correlation_id: 'corr-bg-net-010',
    status: 'closed',
    severity: 'low',
    confidence: 'low',
    risk_score: 8,
    primary_actor_id: 'cert-rotator-01',
    actor_type: 'service',
    actor_role: null,
    detection_ids: ['DET-POL-009'],
    detection_summary: [
      'Privileged policy change flagged during an automated certificate rotation window.',
    ],
    response_ids: ['resp-0008'],
    containment_status: 'false_positive_closed',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['cert-rotator-01'],
    affected_resources: { services: ['cert-rotator-01'] },
    timeline: [
      {
        timestamp: daysAgo(7),
        entry_type: 'alert',
        entry_id: 'inc-0010-a1',
        summary: 'DET-POL-009 fired during the cert-rotator maintenance window.',
      },
      {
        timestamp: daysAgo(6),
        entry_type: 'response',
        entry_id: 'resp-0008',
        summary: 'Cleared after matching the rotation schedule; added maintenance window allowlist.',
      },
      {
        timestamp: daysAgo(6),
        entry_type: 'status_change',
        entry_id: 'inc-0010-sc1',
        summary: 'Status moved to closed.',
      },
    ],
    created_at: daysAgo(7),
    updated_at: daysAgo(6),
    closed_at: daysAgo(6),
    notes: [],
  },

  // ── Incident 11 — backup script bulk read (closed) ──
  {
    incident_id: 'inc-0011',
    incident_type: 'data_access_anomaly',
    correlation_id: 'corr-bg-doc-011',
    status: 'closed',
    severity: 'informational',
    confidence: 'low',
    risk_score: 5,
    primary_actor_id: 'backup-agent-02',
    actor_type: 'service',
    actor_role: null,
    detection_ids: ['DET-DOC-005'],
    detection_summary: [
      'Abnormal Bulk Document Access triggered during the nightly backup run.',
    ],
    response_ids: ['resp-0009'],
    containment_status: 'false_positive_closed',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['backup-agent-02'],
    affected_resources: { services: ['backup-agent-02'] },
    timeline: [
      {
        timestamp: daysAgo(6),
        entry_type: 'alert',
        entry_id: 'inc-0011-a1',
        summary: 'DET-DOC-005 fired on backup-agent-02 nightly scan.',
      },
      {
        timestamp: daysAgo(5),
        entry_type: 'response',
        entry_id: 'resp-0009',
        summary: 'Threshold adjusted and service account allowlisted for bulk-read rule.',
      },
      {
        timestamp: daysAgo(5),
        entry_type: 'status_change',
        entry_id: 'inc-0011-sc1',
        summary: 'Status moved to closed.',
      },
    ],
    created_at: daysAgo(6),
    updated_at: daysAgo(5),
    closed_at: daysAgo(5),
    notes: [],
  },

  // ── Incident 12 — residential-proxy brute force (contained) ──
  {
    incident_id: 'inc-0012',
    incident_type: 'credential_compromise',
    correlation_id: 'corr-bg-auth-012',
    status: 'contained',
    severity: 'medium',
    confidence: 'medium',
    risk_score: 38,
    primary_actor_id: 'unknown-external',
    actor_type: 'external',
    actor_role: null,
    detection_ids: ['DET-AUTH-001'],
    detection_summary: [
      'Burst of 40+ failed logins from a residential proxy range against a handful of analyst accounts.',
    ],
    response_ids: ['resp-0010'],
    containment_status: 'ip_blocked',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['svc-identity-edge'],
    affected_resources: { services: ['svc-identity-edge'] },
    timeline: [
      {
        timestamp: hoursAgo(60),
        entry_type: 'alert',
        entry_id: 'inc-0012-a1',
        summary: 'DET-AUTH-001 fired — 40+ failures from residential proxy range.',
      },
      {
        timestamp: hoursAgo(48),
        entry_type: 'response',
        entry_id: 'resp-0010',
        summary: 'Source range blocked at identity edge; monitoring for shift.',
      },
      {
        timestamp: hoursAgo(48),
        entry_type: 'status_change',
        entry_id: 'inc-0012-sc1',
        summary: 'Status moved to contained.',
      },
    ],
    created_at: hoursAgo(60),
    updated_at: hoursAgo(48),
    closed_at: null,
    notes: [],
  },

  // ── Incident 13 — operator token reuse precaution (contained) ──
  {
    incident_id: 'inc-0013',
    incident_type: 'session_anomaly',
    correlation_id: 'corr-bg-sess-013',
    status: 'contained',
    severity: 'low',
    confidence: 'low',
    risk_score: 18,
    primary_actor_id: 'operator-soc-01',
    actor_type: 'user',
    actor_role: 'operator',
    detection_ids: ['DET-SESSION-003'],
    detection_summary: [
      'Token reuse flagged between corp VPN and BYOD laptop; benign after verification.',
    ],
    response_ids: ['resp-0011'],
    containment_status: 'session_revoked',
    event_ids: [],
    affected_documents: [],
    affected_sessions: ['sess-bg-op01-7713'],
    affected_services: [],
    affected_resources: {
      sessions: ['sess-bg-op01-7713'],
      actors: ['operator-soc-01'],
    },
    timeline: [
      {
        timestamp: hoursAgo(50),
        entry_type: 'alert',
        entry_id: 'inc-0013-a1',
        summary: 'DET-SESSION-003 fired — token reuse between two origins.',
      },
      {
        timestamp: hoursAgo(49),
        entry_type: 'response',
        entry_id: 'resp-0011',
        summary: 'Session revoked as a precaution; operator re-issued immediately.',
      },
      {
        timestamp: hoursAgo(49),
        entry_type: 'status_change',
        entry_id: 'inc-0013-sc1',
        summary: 'Status moved to contained.',
      },
    ],
    created_at: hoursAgo(50),
    updated_at: hoursAgo(49),
    closed_at: null,
    notes: [
      {
        note_id: 'note-0013-1',
        author: 'operator-soc-02',
        content:
          'Verified directly with operator-soc-01 that both devices were in use concurrently. Token was revoked out of an abundance of caution and re-issued within two minutes.',
        created_at: hoursAgo(49),
      },
    ],
  },

  // ── Incident 14 — svc-telemetry-ingest 403 drip (investigating) ──
  {
    incident_id: 'inc-0014',
    incident_type: 'service_anomaly',
    correlation_id: 'corr-bg-svc-014',
    status: 'investigating',
    severity: 'medium',
    confidence: 'medium',
    risk_score: 32,
    primary_actor_id: 'svc-telemetry-ingest',
    actor_type: 'service',
    actor_role: null,
    detection_ids: ['DET-SVC-007'],
    detection_summary: [
      'Steady drip of 403s from svc-telemetry-ingest probing admin routes; unclear if misconfig or recon.',
    ],
    response_ids: [],
    containment_status: 'active_monitoring',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: ['svc-telemetry-ingest'],
    affected_resources: { services: ['svc-telemetry-ingest'] },
    timeline: [
      {
        timestamp: hoursAgo(14),
        entry_type: 'alert',
        entry_id: 'inc-0014-a1',
        summary: 'DET-SVC-007 fired — slow drip of unauthorized route attempts.',
      },
      {
        timestamp: hoursAgo(13),
        entry_type: 'status_change',
        entry_id: 'inc-0014-sc1',
        summary: 'Status moved to investigating.',
      },
    ],
    created_at: hoursAgo(14),
    updated_at: hoursAgo(13),
    closed_at: null,
    notes: [],
  },

  // ── Incident 15 — off-hours admin login (investigating) ──
  {
    incident_id: 'inc-0015',
    incident_type: 'access_anomaly',
    correlation_id: 'corr-bg-sess-015',
    status: 'investigating',
    severity: 'medium',
    confidence: 'low',
    risk_score: 25,
    primary_actor_id: 'robin.chen',
    actor_type: 'user',
    actor_role: 'platform-admin',
    detection_ids: ['DET-AUTH-002'],
    detection_summary: [
      'Successful platform-admin login at 02:00 local time; outside normal working hours.',
    ],
    response_ids: [],
    containment_status: 'under_review',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: [],
    affected_resources: { actors: ['robin.chen'] },
    timeline: [
      {
        timestamp: hoursAgo(12),
        entry_type: 'alert',
        entry_id: 'inc-0015-a1',
        summary: 'Off-hours platform-admin authentication flagged for review.',
      },
      {
        timestamp: hoursAgo(11),
        entry_type: 'status_change',
        entry_id: 'inc-0015-sc1',
        summary: 'Status moved to investigating.',
      },
    ],
    created_at: hoursAgo(12),
    updated_at: hoursAgo(11),
    closed_at: null,
    notes: [],
  },

  // ── Incident 16 — analyst forbidden-doc uptick (open) ──
  {
    incident_id: 'inc-0016',
    incident_type: 'data_access_anomaly',
    correlation_id: 'corr-bg-doc-016',
    status: 'open',
    severity: 'medium',
    confidence: 'low',
    risk_score: 22,
    primary_actor_id: 'aggregate',
    actor_type: 'user',
    actor_role: null,
    detection_ids: ['DET-DOC-004'],
    detection_summary: [
      'Uptick in document.read.failure events across three analysts; classification mismatch cluster.',
    ],
    response_ids: [],
    containment_status: 'triage_pending',
    event_ids: [],
    affected_documents: [],
    affected_sessions: [],
    affected_services: [],
    affected_resources: {},
    timeline: [
      {
        timestamp: hoursAgo(4),
        entry_type: 'alert',
        entry_id: 'inc-0016-a1',
        summary: 'Cluster of DET-DOC-004 firings detected across 3 analysts.',
      },
    ],
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
    closed_at: null,
    notes: [],
  },
];

// ------------------------------------------------------------
// Incident responses
//
// First-class records for every response_id referenced by an
// incident above. Previously responses were implicit — just a
// string id on the incident and a count in scenario history.
// Promoting them to full objects lets the responses view render
// real playbook data and keeps the count consistent with
// MOCK_EXERCISE_REPORT.response_effectiveness.
//
//   response_id  incident   type                          in-window?
//   ─────────────────────────────────────────────────────────────────
//   resp-0001    inc-0001   session_revoke                yes (~66h)
//   resp-0003    inc-0003   download_restriction          yes (~30h)
//   resp-0004    inc-0004   service_disable               yes (~20h)
//   resp-0005    inc-0007   false_positive_resolution     no (4d)
//   resp-0006    inc-0008   access_revoke                 no (3d)
//   resp-0007    inc-0009   ip_block                      no (2d edge)
//   resp-0008    inc-0010   false_positive_resolution     no (6d)
//   resp-0009    inc-0011   false_positive_resolution     no (5d)
//   resp-0010    inc-0012   ip_block                      yes (~48h)
//   resp-0011    inc-0013   session_revoke                yes (~49h)
//
// resp-0002 is intentionally absent — inc-0002 (SESSION_HIJACK)
// is still investigating and has no response yet, matching its
// empty response_ids array.
//
// In-window count drives MOCK_EXERCISE_REPORT.response_effectiveness:
// chain responses (resp-0001/3/4) + in-window background responses
// (resp-0010/11) = 5 executed in the 72-hour exercise window.
// ------------------------------------------------------------

export const MOCK_RESPONSES: IncidentResponse[] = [
  {
    response_id: 'resp-0001',
    incident_id: 'inc-0001',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    response_type: 'session_revoke',
    status: 'verified',
    triggered_at: minutesAgo(3955),
    executed_at: minutesAgo(3955),
    operator: 'operator-soc-01',
    target: 'sess-wh-tor-aa11',
    summary:
      'Revoked wade.hollis session after Tor-origin brute force success; actor locked out pending review.',
    playbook_id: 'pb-session-revoke-v1',
  },
  {
    response_id: 'resp-0003',
    incident_id: 'inc-0003',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    response_type: 'download_restriction',
    status: 'executed',
    triggered_at: minutesAgo(1795),
    executed_at: minutesAgo(1795),
    operator: 'operator-soc-01',
    target: 'priya.shah',
    summary:
      'Applied download restriction on priya.shah pending investigation of read-to-download staging pattern.',
    playbook_id: 'pb-download-restrict-v1',
  },
  {
    response_id: 'resp-0004',
    incident_id: 'inc-0004',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    response_type: 'service_disable',
    status: 'verified',
    triggered_at: minutesAgo(1195),
    executed_at: minutesAgo(1195),
    operator: 'operator-soc-02',
    target: 'svc-sat-telemetry',
    summary:
      'Disabled svc-sat-telemetry after 4 unauthorized admin-route probes within 90 seconds.',
    playbook_id: 'pb-service-disable-v1',
  },
  {
    response_id: 'resp-0005',
    incident_id: 'inc-0007',
    correlation_id: 'corr-bg-auth-007',
    response_type: 'false_positive_resolution',
    status: 'executed',
    triggered_at: daysAgo(4),
    executed_at: daysAgo(4),
    operator: 'operator-soc-02',
    target: 'cron-jobs-scheduler',
    summary:
      'Marked DET-AUTH-001 alert as false positive after identifying secret-rotation backoff loop; added rate-limit exemption.',
  },
  {
    response_id: 'resp-0006',
    incident_id: 'inc-0008',
    correlation_id: 'corr-bg-auth-008',
    response_type: 'access_revoke',
    status: 'verified',
    triggered_at: daysAgo(3),
    executed_at: daysAgo(3),
    operator: 'operator-soc-01',
    target: 'jessie.park',
    summary:
      'Revoked contractor access and reconciled identity records against HR offboarding list.',
    playbook_id: 'pb-offboard-sweep-v1',
  },
  {
    response_id: 'resp-0007',
    incident_id: 'inc-0009',
    correlation_id: 'corr-bg-auth-009',
    response_type: 'ip_block',
    status: 'verified',
    triggered_at: daysAgo(2),
    executed_at: daysAgo(2),
    operator: 'operator-soc-02',
    target: 'external-residential-proxy-cidr',
    summary:
      'Blocked residential proxy range at the identity edge firewall after sustained failure pattern.',
    playbook_id: 'pb-edge-ip-block-v1',
  },
  {
    response_id: 'resp-0008',
    incident_id: 'inc-0010',
    correlation_id: 'corr-bg-net-010',
    response_type: 'false_positive_resolution',
    status: 'executed',
    triggered_at: daysAgo(6),
    executed_at: daysAgo(6),
    operator: 'operator-soc-01',
    target: 'cert-rotator-01',
    summary:
      'Cleared after matching the certificate rotation schedule; added maintenance window allowlist.',
  },
  {
    response_id: 'resp-0009',
    incident_id: 'inc-0011',
    correlation_id: 'corr-bg-doc-011',
    response_type: 'false_positive_resolution',
    status: 'executed',
    triggered_at: daysAgo(5),
    executed_at: daysAgo(5),
    operator: 'operator-soc-02',
    target: 'backup-agent-02',
    summary:
      'Adjusted DET-DOC-005 threshold and allowlisted backup-agent-02 for the nightly scan window.',
  },
  {
    response_id: 'resp-0010',
    incident_id: 'inc-0012',
    correlation_id: 'corr-bg-auth-012',
    response_type: 'ip_block',
    status: 'verified',
    triggered_at: hoursAgo(49),
    executed_at: hoursAgo(48),
    operator: 'operator-soc-01',
    target: 'external-residential-proxy-cidr-2',
    summary:
      'Blocked source CIDR at the identity edge after 40+ failed logins from a residential proxy range.',
    playbook_id: 'pb-edge-ip-block-v1',
  },
  {
    response_id: 'resp-0011',
    incident_id: 'inc-0013',
    correlation_id: 'corr-bg-sess-013',
    response_type: 'session_revoke',
    status: 'verified',
    triggered_at: hoursAgo(49),
    executed_at: hoursAgo(49),
    operator: 'operator-soc-02',
    target: 'sess-bg-op01-7713',
    summary:
      'Revoked operator session as a precaution; re-issued within two minutes after device verification.',
    playbook_id: 'pb-session-revoke-v1',
  },
];

// ------------------------------------------------------------
// Risk profiles
//
// One profile per primary actor across the six correlation
// chains. Each score_history entry is keyed off a DET-* rule
// that actually fires in MOCK_ALERTS for that actor, with a
// delta sized to the rule's severity/confidence pair so the
// math is internally consistent:
//
//   Rule             Severity   Confidence   Delta
//   ─────────────────────────────────────────────
//   DET-AUTH-001     medium     medium         15
//   DET-AUTH-002     high       high           30
//   DET-SESSION-003  high       high           35
//   DET-DOC-004      high       high           30
//   DET-DOC-006      critical   high           45
//   DET-SVC-007      high       medium         25
//   DET-ART-008      medium     medium         15
//   DET-POL-009      critical   high           50
//   DET-CORR-010     critical   high           55
//
// Contained chains (AUTH_BRUTE, SVC_ABUSE) show a current_score
// lower than peak_score to reflect post-containment decay —
// the response playbooks revoked the session / disabled the
// account, so live risk is no longer actively accumulating.
// Active investigations and open incidents keep current == peak.
// ------------------------------------------------------------

export const MOCK_RISK_PROFILES: RiskProfile[] = [
  // Chain 1 — AUTH_BRUTE (contained, session revoked)
  {
    actor_id: 'wade.hollis',
    current_score: 20,
    peak_score: 45,
    contributing_rules: ['DET-AUTH-001', 'DET-AUTH-002'],
    score_history: [
      {
        timestamp: minutesAgo(3960),
        rule_id: 'DET-AUTH-001',
        delta: 15,
        new_score: 15,
      },
      {
        timestamp: minutesAgo(3959),
        rule_id: 'DET-AUTH-002',
        delta: 30,
        new_score: 45,
      },
    ],
    last_updated: minutesAgo(3959),
  },

  // Chain 2 — SESSION_HIJACK (investigating)
  {
    actor_id: 'alex.nguyen',
    current_score: 35,
    peak_score: 35,
    contributing_rules: ['DET-SESSION-003'],
    score_history: [
      {
        timestamp: minutesAgo(2864),
        rule_id: 'DET-SESSION-003',
        delta: 35,
        new_score: 35,
      },
    ],
    last_updated: minutesAgo(2864),
  },

  // Chain 3 — DOC_EXFIL (investigating, downloads blocked)
  {
    actor_id: 'priya.shah',
    current_score: 75,
    peak_score: 75,
    contributing_rules: ['DET-DOC-004', 'DET-DOC-006'],
    score_history: [
      {
        timestamp: minutesAgo(1810),
        rule_id: 'DET-DOC-004',
        delta: 30,
        new_score: 30,
      },
      {
        timestamp: minutesAgo(1800),
        rule_id: 'DET-DOC-006',
        delta: 45,
        new_score: 75,
      },
    ],
    last_updated: minutesAgo(1800),
  },

  // Chain 4 — SVC_ABUSE (contained, service disabled)
  {
    actor_id: 'svc-sat-telemetry',
    current_score: 10,
    peak_score: 25,
    contributing_rules: ['DET-SVC-007'],
    score_history: [
      {
        timestamp: minutesAgo(1203),
        rule_id: 'DET-SVC-007',
        delta: 25,
        new_score: 25,
      },
    ],
    last_updated: minutesAgo(1203),
  },

  // Chain 5 — POLICY_CHANGE (open, awaiting triage)
  {
    actor_id: 'robin.chen',
    current_score: 65,
    peak_score: 65,
    contributing_rules: ['DET-ART-008', 'DET-POL-009'],
    score_history: [
      {
        timestamp: minutesAgo(500),
        rule_id: 'DET-ART-008',
        delta: 15,
        new_score: 15,
      },
      {
        timestamp: minutesAgo(485),
        rule_id: 'DET-POL-009',
        delta: 50,
        new_score: 65,
      },
    ],
    last_updated: minutesAgo(485),
  },

  // Chain 6 — MULTI_STAGE (open, still firing)
  {
    actor_id: 'mira.delacroix',
    current_score: 55,
    peak_score: 55,
    contributing_rules: ['DET-CORR-010'],
    score_history: [
      {
        timestamp: minutesAgo(120),
        rule_id: 'DET-CORR-010',
        delta: 55,
        new_score: 55,
      },
    ],
    last_updated: minutesAgo(120),
  },
];

// ------------------------------------------------------------
// Rule effectiveness
//
// One entry per detection rule defined in the backend
// (backend/app/services/detection_service.py). Both
// trigger_count and actors_affected are derived directly
// from MOCK_ALERTS — no invented numbers. In the current
// narrative each firing rule produces exactly one alert for
// one actor, so trigger_count === actors_affected === 1 for
// every rule that appears in MOCK_ALERTS.
//
// DET-DOC-005 ("Abnormal Bulk Document Access") intentionally
// has zero triggers: it exists in the backend ruleset but the
// doc-exfil chain only reads three payloads, below the
// 20-read threshold the rule enforces. Showing it at 0/0 is
// honest — recruiters see a dormant rule alongside the ones
// that actually fired.
//
//   rule_id         severity   trigger_count  actors_affected  source
//   ─────────────────────────────────────────────────────────────
//   DET-AUTH-001    medium             1            1          alert-0001
//   DET-AUTH-002    high               1            1          alert-0002
//   DET-SESSION-003 high               1            1          alert-0003
//   DET-DOC-004     high               1            1          alert-0004
//   DET-DOC-005     high               0            0          (dormant)
//   DET-DOC-006     critical           1            1          alert-0005
//   DET-SVC-007     high               1            1          alert-0006
//   DET-ART-008     medium             1            1          alert-0007
//   DET-POL-009     critical           1            1          alert-0008
//   DET-CORR-010    critical           1            1          alert-0009
// ------------------------------------------------------------

export const MOCK_RULE_EFFECTIVENESS: RuleEffectiveness[] = [
  {
    rule_id: 'DET-AUTH-001',
    rule_name: 'Repeated Authentication Failure Burst',
    trigger_count: 1,
    severity: 'medium',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-AUTH-002',
    rule_name: 'Suspicious Success After Failure Sequence',
    trigger_count: 1,
    severity: 'high',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-SESSION-003',
    rule_name: 'Token Reuse From Conflicting Origins',
    trigger_count: 1,
    severity: 'high',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-DOC-004',
    rule_name: 'Restricted Document Access Outside Role Scope',
    trigger_count: 1,
    severity: 'high',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-DOC-005',
    rule_name: 'Abnormal Bulk Document Access',
    trigger_count: 0,
    severity: 'high',
    actors_affected: 0,
  },
  {
    rule_id: 'DET-DOC-006',
    rule_name: 'Read-To-Download Staging Pattern',
    trigger_count: 1,
    severity: 'critical',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-SVC-007',
    rule_name: 'Unauthorized Service Identity Route Access',
    trigger_count: 1,
    severity: 'high',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-ART-008',
    rule_name: 'Artifact Validation Failure Pattern',
    trigger_count: 1,
    severity: 'medium',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-POL-009',
    rule_name: 'Privileged Policy Change With Elevated Risk Context',
    trigger_count: 1,
    severity: 'critical',
    actors_affected: 1,
  },
  {
    rule_id: 'DET-CORR-010',
    rule_name: 'Multi-Signal Compromise Sequence',
    trigger_count: 1,
    severity: 'critical',
    actors_affected: 1,
  },
];

// ------------------------------------------------------------
// Scenario history
//
// One historical run per correlation chain. Each entry is a
// past execution of a scenario (or an invented policy-change
// exercise for POLICY_CHANGE, which has no matching entry in
// SCENARIO_DEFINITIONS). The counts below are derived directly
// from MOCK_EVENTS and MOCK_ALERTS so a recruiter comparing
// tabs sees consistent numbers:
//
//   chain          events  alerts  incident   scenario_id     status
//   ─────────────────────────────────────────────────────────────────
//   AUTH_BRUTE        7      2     inc-0001   scn-auth-001    contained
//   SESSION_HIJACK    4      1     inc-0002   scn-session-002 investigating
//   DOC_EXFIL         7      2     inc-0003   scn-doc-004     investigating
//   SVC_ABUSE         4      1     inc-0004   scn-svc-005     contained
//   POLICY_CHANGE     4      2     inc-0005   scn-pol-007     open
//   MULTI_STAGE       4      1     inc-0006   scn-corr-006    open
//
// `executed_at` is set to each chain's first event timestamp
// so the history tab reads in the same order as the incidents
// drawer. State arrays (revoked_sessions, disabled_services,
// etc.) mirror the `affected_*` fields on the matching
// MOCK_INCIDENT — contained chains populate them, active
// investigations leave them empty.
//
// scn-doc-003 ("Unauthorized Document Access") is intentionally
// absent: it's defined but has no historical run in the
// current 72-hour window. Recruiters see it as a runnable
// scenario in the scenarios tab without a history row.
// ------------------------------------------------------------

export const MOCK_SCENARIO_HISTORY: ScenarioHistoryEntry[] = [
  // Chain 1 — AUTH_BRUTE (contained, session revoked)
  {
    scenario_id: 'scn-auth-001',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    events_total: 7,
    events_generated: 7,
    alerts_total: 2,
    alerts_generated: 2,
    responses_total: 1,
    responses_generated: 1,
    incident_id: 'inc-0001',
    step_up_required: true,
    revoked_sessions: ['sess-wh-tor-aa11'],
    download_restricted_actors: [],
    disabled_services: [],
    quarantined_artifacts: [],
    policy_change_restricted_actors: [],
    operated_by: 'operator-soc-01',
    executed_at: minutesAgo(3962),
  },

  // Chain 2 — SESSION_HIJACK (investigating)
  {
    scenario_id: 'scn-session-002',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    events_total: 4,
    events_generated: 4,
    alerts_total: 1,
    alerts_generated: 1,
    responses_total: 0,
    responses_generated: 0,
    incident_id: 'inc-0002',
    step_up_required: true,
    revoked_sessions: [],
    download_restricted_actors: [],
    disabled_services: [],
    quarantined_artifacts: [],
    policy_change_restricted_actors: [],
    operated_by: 'operator-soc-02',
    executed_at: minutesAgo(2880),
  },

  // Chain 3 — DOC_EXFIL (investigating, downloads restricted)
  {
    scenario_id: 'scn-doc-004',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    events_total: 7,
    events_generated: 7,
    alerts_total: 2,
    alerts_generated: 2,
    responses_total: 1,
    responses_generated: 1,
    incident_id: 'inc-0003',
    step_up_required: true,
    revoked_sessions: [],
    download_restricted_actors: ['priya.shah'],
    disabled_services: [],
    quarantined_artifacts: [],
    policy_change_restricted_actors: [],
    operated_by: 'operator-soc-01',
    executed_at: minutesAgo(1810),
  },

  // Chain 4 — SVC_ABUSE (contained, service disabled)
  {
    scenario_id: 'scn-svc-005',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    events_total: 4,
    events_generated: 4,
    alerts_total: 1,
    alerts_generated: 1,
    responses_total: 1,
    responses_generated: 1,
    incident_id: 'inc-0004',
    step_up_required: false,
    revoked_sessions: [],
    download_restricted_actors: [],
    disabled_services: ['svc-sat-telemetry'],
    quarantined_artifacts: [],
    policy_change_restricted_actors: [],
    operated_by: 'operator-soc-02',
    executed_at: minutesAgo(1205),
  },

  // Chain 5 — POLICY_CHANGE (open, awaiting triage)
  {
    scenario_id: 'scn-pol-007',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    events_total: 4,
    events_generated: 4,
    alerts_total: 2,
    alerts_generated: 2,
    responses_total: 0,
    responses_generated: 0,
    incident_id: 'inc-0005',
    step_up_required: true,
    revoked_sessions: [],
    download_restricted_actors: [],
    disabled_services: [],
    quarantined_artifacts: [
      'artifact-firmware-04',
      'artifact-firmware-05',
      'artifact-firmware-06',
    ],
    policy_change_restricted_actors: [],
    operated_by: 'operator-soc-01',
    executed_at: minutesAgo(510),
  },

  // Chain 6 — MULTI_STAGE (open, still firing)
  {
    scenario_id: 'scn-corr-006',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    events_total: 4,
    events_generated: 4,
    alerts_total: 1,
    alerts_generated: 1,
    responses_total: 0,
    responses_generated: 0,
    incident_id: 'inc-0006',
    step_up_required: true,
    revoked_sessions: [],
    download_restricted_actors: [],
    disabled_services: [],
    quarantined_artifacts: [],
    policy_change_restricted_actors: [],
    operated_by: 'operator-soc-02',
    executed_at: minutesAgo(165),
  },
];

// ------------------------------------------------------------
// MITRE ATT&CK — tactics
//
// Subset of the real MITRE ATT&CK Enterprise tactic catalog
// covering the domains AegisRange's detection rules touch.
// Ids, names, and descriptions match attack.mitre.org so the
// coverage matrix reads truthfully in the demo.
// ------------------------------------------------------------

export const MOCK_MITRE_TACTICS: MitreTactic[] = [
  {
    id: 'TA0001',
    name: 'Initial Access',
    description:
      'Techniques used to gain an initial foothold within a network.',
    url: 'https://attack.mitre.org/tactics/TA0001/',
  },
  {
    id: 'TA0003',
    name: 'Persistence',
    description:
      'Techniques used to maintain access across restarts and credential rotation.',
    url: 'https://attack.mitre.org/tactics/TA0003/',
  },
  {
    id: 'TA0005',
    name: 'Defense Evasion',
    description:
      'Techniques used to avoid detection throughout the compromise.',
    url: 'https://attack.mitre.org/tactics/TA0005/',
  },
  {
    id: 'TA0006',
    name: 'Credential Access',
    description:
      'Techniques used to steal credentials such as passwords and keys.',
    url: 'https://attack.mitre.org/tactics/TA0006/',
  },
  {
    id: 'TA0007',
    name: 'Discovery',
    description:
      'Techniques used to learn about the internal environment.',
    url: 'https://attack.mitre.org/tactics/TA0007/',
  },
  {
    id: 'TA0008',
    name: 'Lateral Movement',
    description:
      'Techniques used to enter and control remote systems on a network.',
    url: 'https://attack.mitre.org/tactics/TA0008/',
  },
  {
    id: 'TA0009',
    name: 'Collection',
    description:
      'Techniques used to gather information relevant to the adversary objective.',
    url: 'https://attack.mitre.org/tactics/TA0009/',
  },
  {
    id: 'TA0010',
    name: 'Exfiltration',
    description:
      'Techniques used to steal data from the target network.',
    url: 'https://attack.mitre.org/tactics/TA0010/',
  },
];

// ------------------------------------------------------------
// MITRE ATT&CK — techniques
//
// Nine techniques drawn from the real ATT&CK Enterprise catalog.
// Eight are covered by at least one firing detection rule in
// MOCK_ALERTS. T1190 ("Exploit Public-Facing Application") is
// intentionally included as an *uncovered* technique so the
// coverage matrix has a gap to render — it's a realistic blind
// spot for a SOC that hasn't yet deployed a WAF-layer rule.
// ------------------------------------------------------------

export const MOCK_MITRE_TECHNIQUES: MitreTechnique[] = [
  {
    id: 'T1041',
    name: 'Exfiltration Over C2 Channel',
    description:
      'Adversaries steal data by exfiltrating it over an existing command-and-control channel.',
    tactic_ids: ['TA0010'],
    url: 'https://attack.mitre.org/techniques/T1041/',
  },
  {
    id: 'T1046',
    name: 'Network Service Discovery',
    description:
      'Adversaries attempt to list services running on remote hosts and networks.',
    tactic_ids: ['TA0007'],
    url: 'https://attack.mitre.org/techniques/T1046/',
  },
  {
    id: 'T1078',
    name: 'Valid Accounts',
    description:
      'Adversaries abuse legitimate credentials to bypass access controls.',
    tactic_ids: ['TA0001', 'TA0003', 'TA0005'],
    url: 'https://attack.mitre.org/techniques/T1078/',
  },
  {
    id: 'T1110',
    name: 'Brute Force',
    description:
      'Adversaries attempt repeated authentication to guess passwords.',
    tactic_ids: ['TA0006'],
    url: 'https://attack.mitre.org/techniques/T1110/',
  },
  {
    id: 'T1190',
    name: 'Exploit Public-Facing Application',
    description:
      'Adversaries exploit weaknesses in internet-facing software.',
    tactic_ids: ['TA0001'],
    url: 'https://attack.mitre.org/techniques/T1190/',
  },
  {
    id: 'T1213',
    name: 'Data from Information Repositories',
    description:
      'Adversaries leverage information repositories to collect sensitive data.',
    tactic_ids: ['TA0009'],
    url: 'https://attack.mitre.org/techniques/T1213/',
  },
  {
    id: 'T1550',
    name: 'Use Alternate Authentication Material',
    description:
      'Adversaries use stolen tokens or session material to bypass authentication.',
    tactic_ids: ['TA0005', 'TA0008'],
    url: 'https://attack.mitre.org/techniques/T1550/',
  },
  {
    id: 'T1554',
    name: 'Compromise Host Software Binary',
    description:
      'Adversaries modify host software binaries to gain persistent access.',
    tactic_ids: ['TA0003'],
    url: 'https://attack.mitre.org/techniques/T1554/',
  },
  {
    id: 'T1562',
    name: 'Impair Defenses',
    description:
      'Adversaries maliciously modify defensive components to evade detection.',
    tactic_ids: ['TA0005'],
    url: 'https://attack.mitre.org/techniques/T1562/',
  },
];

// ------------------------------------------------------------
// TTP mappings
//
// One mapping per DET-* rule in the backend ruleset. Each rule
// lists the MITRE techniques and tactics it surfaces plus the
// Lockheed Martin kill-chain phases the activity touches. The
// technique_ids and tactic_ids here are the single source of
// truth for the coverage matrix (C.2) and kill chain analyses
// (C.3) — if a rule's mapping changes, downstream derivations
// pick it up automatically.
//
// DET-DOC-005 ("Abnormal Bulk Document Access") still gets a
// mapping even though it doesn't fire in MOCK_ALERTS — the
// catalog entry exists in the backend, and C.2 uses it to
// light up T1213 coverage via the sibling DET-DOC-004 rule
// that does fire.
// ------------------------------------------------------------

export const MOCK_TTP_MAPPINGS: TTPMapping[] = [
  {
    rule_id: 'DET-AUTH-001',
    technique_ids: ['T1110'],
    tactic_ids: ['TA0006'],
    kill_chain_phases: ['delivery'],
  },
  {
    rule_id: 'DET-AUTH-002',
    technique_ids: ['T1078'],
    tactic_ids: ['TA0001'],
    kill_chain_phases: ['exploitation'],
  },
  {
    rule_id: 'DET-SESSION-003',
    technique_ids: ['T1550'],
    tactic_ids: ['TA0005', 'TA0008'],
    kill_chain_phases: ['exploitation', 'command_and_control'],
  },
  {
    rule_id: 'DET-DOC-004',
    technique_ids: ['T1213'],
    tactic_ids: ['TA0009'],
    kill_chain_phases: ['actions_on_objectives'],
  },
  {
    rule_id: 'DET-DOC-005',
    technique_ids: ['T1213'],
    tactic_ids: ['TA0009'],
    kill_chain_phases: ['actions_on_objectives'],
  },
  {
    rule_id: 'DET-DOC-006',
    technique_ids: ['T1041'],
    tactic_ids: ['TA0010'],
    kill_chain_phases: ['actions_on_objectives'],
  },
  {
    rule_id: 'DET-SVC-007',
    technique_ids: ['T1046'],
    tactic_ids: ['TA0007'],
    kill_chain_phases: ['reconnaissance', 'delivery'],
  },
  {
    rule_id: 'DET-ART-008',
    technique_ids: ['T1554'],
    tactic_ids: ['TA0003'],
    kill_chain_phases: ['installation'],
  },
  {
    rule_id: 'DET-POL-009',
    technique_ids: ['T1562'],
    tactic_ids: ['TA0005'],
    kill_chain_phases: ['actions_on_objectives'],
  },
  {
    rule_id: 'DET-CORR-010',
    technique_ids: ['T1041', 'T1078', 'T1550'],
    tactic_ids: ['TA0001', 'TA0008', 'TA0010'],
    kill_chain_phases: [
      'delivery',
      'exploitation',
      'command_and_control',
      'actions_on_objectives',
    ],
  },
];

// ------------------------------------------------------------
// MITRE coverage matrix
//
// One entry per (tactic, technique) pair that exists in the
// current technique catalog. `rule_ids` lists every DET-* rule
// in MOCK_TTP_MAPPINGS whose tactic/technique sets intersect
// the pair. `scenario_ids` lists every scenario in
// MOCK_SCENARIO_HISTORY whose correlation chain contains at
// least one firing alert for those rules. `covered` is simply
// `rule_ids.length > 0` — a pair is "covered" if any rule
// maps to it, regardless of whether that rule has fired yet.
//
// Three pairs are intentionally uncovered so the matrix has
// gaps to render:
//   (TA0003, T1078)  catalog gap  no rule maps T1078 → Persistence
//   (TA0005, T1078)  catalog gap  no rule maps T1078 → Defense Evasion
//   (TA0001, T1190)  no rule at all — realistic WAF-layer gap
//
// T1213 is covered by DET-DOC-004 (which fires) and
// DET-DOC-005 (dormant); the scenario list only contains
// scn-doc-004 since DET-DOC-005 has no firing alerts.
// ------------------------------------------------------------

export const MOCK_MITRE_COVERAGE: MitreCoverageEntry[] = [
  {
    tactic_id: 'TA0001',
    technique_id: 'T1078',
    technique_name: 'Valid Accounts',
    rule_ids: ['DET-AUTH-002', 'DET-CORR-010'],
    scenario_ids: ['scn-auth-001', 'scn-corr-006'],
    covered: true,
  },
  {
    tactic_id: 'TA0001',
    technique_id: 'T1190',
    technique_name: 'Exploit Public-Facing Application',
    rule_ids: [],
    scenario_ids: [],
    covered: false,
  },
  {
    tactic_id: 'TA0003',
    technique_id: 'T1078',
    technique_name: 'Valid Accounts',
    rule_ids: [],
    scenario_ids: [],
    covered: false,
  },
  {
    tactic_id: 'TA0003',
    technique_id: 'T1554',
    technique_name: 'Compromise Host Software Binary',
    rule_ids: ['DET-ART-008'],
    scenario_ids: ['scn-pol-007'],
    covered: true,
  },
  {
    tactic_id: 'TA0005',
    technique_id: 'T1078',
    technique_name: 'Valid Accounts',
    rule_ids: [],
    scenario_ids: [],
    covered: false,
  },
  {
    tactic_id: 'TA0005',
    technique_id: 'T1550',
    technique_name: 'Use Alternate Authentication Material',
    rule_ids: ['DET-SESSION-003'],
    scenario_ids: ['scn-session-002'],
    covered: true,
  },
  {
    tactic_id: 'TA0005',
    technique_id: 'T1562',
    technique_name: 'Impair Defenses',
    rule_ids: ['DET-POL-009'],
    scenario_ids: ['scn-pol-007'],
    covered: true,
  },
  {
    tactic_id: 'TA0006',
    technique_id: 'T1110',
    technique_name: 'Brute Force',
    rule_ids: ['DET-AUTH-001'],
    scenario_ids: ['scn-auth-001'],
    covered: true,
  },
  {
    tactic_id: 'TA0007',
    technique_id: 'T1046',
    technique_name: 'Network Service Discovery',
    rule_ids: ['DET-SVC-007'],
    scenario_ids: ['scn-svc-005'],
    covered: true,
  },
  {
    tactic_id: 'TA0008',
    technique_id: 'T1550',
    technique_name: 'Use Alternate Authentication Material',
    rule_ids: ['DET-SESSION-003', 'DET-CORR-010'],
    scenario_ids: ['scn-session-002', 'scn-corr-006'],
    covered: true,
  },
  {
    tactic_id: 'TA0009',
    technique_id: 'T1213',
    technique_name: 'Data from Information Repositories',
    rule_ids: ['DET-DOC-004', 'DET-DOC-005'],
    scenario_ids: ['scn-doc-004'],
    covered: true,
  },
  {
    tactic_id: 'TA0010',
    technique_id: 'T1041',
    technique_name: 'Exfiltration Over C2 Channel',
    rule_ids: ['DET-DOC-006', 'DET-CORR-010'],
    scenario_ids: ['scn-doc-004', 'scn-corr-006'],
    covered: true,
  },
];

// ------------------------------------------------------------
// Tactic coverage rollup
//
// Aggregates MOCK_MITRE_COVERAGE by tactic. `total_techniques`
// counts every (tactic, technique) pair for that tactic;
// `covered_techniques` counts the subset where `covered === true`.
// Percentage is the integer floor of the ratio × 100, matching
// how the backend analytics rollup rounds.
//
//   tactic            covered / total   percentage
//   ─────────────────────────────────────────────
//   TA0001 Initial Access     1 / 2         50
//   TA0003 Persistence        1 / 2         50
//   TA0005 Defense Evasion    2 / 3         66
//   TA0006 Credential Access  1 / 1        100
//   TA0007 Discovery          1 / 1        100
//   TA0008 Lateral Movement   1 / 1        100
//   TA0009 Collection         1 / 1        100
//   TA0010 Exfiltration       1 / 1        100
// ------------------------------------------------------------

export const MOCK_TACTIC_COVERAGE: TacticCoverage[] = [
  {
    tactic_id: 'TA0001',
    tactic_name: 'Initial Access',
    covered_techniques: 1,
    total_techniques: 2,
    percentage: 50,
  },
  {
    tactic_id: 'TA0003',
    tactic_name: 'Persistence',
    covered_techniques: 1,
    total_techniques: 2,
    percentage: 50,
  },
  {
    tactic_id: 'TA0005',
    tactic_name: 'Defense Evasion',
    covered_techniques: 2,
    total_techniques: 3,
    percentage: 66,
  },
  {
    tactic_id: 'TA0006',
    tactic_name: 'Credential Access',
    covered_techniques: 1,
    total_techniques: 1,
    percentage: 100,
  },
  {
    tactic_id: 'TA0007',
    tactic_name: 'Discovery',
    covered_techniques: 1,
    total_techniques: 1,
    percentage: 100,
  },
  {
    tactic_id: 'TA0008',
    tactic_name: 'Lateral Movement',
    covered_techniques: 1,
    total_techniques: 1,
    percentage: 100,
  },
  {
    tactic_id: 'TA0009',
    tactic_name: 'Collection',
    covered_techniques: 1,
    total_techniques: 1,
    percentage: 100,
  },
  {
    tactic_id: 'TA0010',
    tactic_name: 'Exfiltration',
    covered_techniques: 1,
    total_techniques: 1,
    percentage: 100,
  },
];

// ------------------------------------------------------------
// Kill chain analyses
//
// One analysis per MOCK_INCIDENT, using the Lockheed Martin
// seven-stage Cyber Kill Chain. For each chain, the detected
// stages are the union of `kill_chain_phases` from every
// DET-* rule in MOCK_TTP_MAPPINGS that fires for that
// correlation id in MOCK_ALERTS. `detection_rule_ids` lists
// exactly the firing rules whose phase list contains that
// stage, and `first_seen` points at the earliest event in
// the chain that maps to the stage.
//
// `progression_percentage` is the integer floor of
// (detected_stages / 7) * 100 — matching how the backend
// rollup rounds — so the numbers always lie in {14, 28, 42,
// 57, 71, 85, 100} for demo chains.
// ------------------------------------------------------------

const KILL_CHAIN_STAGE_TEMPLATES: Array<
  Pick<KillChainStage, 'name' | 'display_name' | 'description' | 'order'>
> = [
  {
    name: 'reconnaissance',
    display_name: 'Reconnaissance',
    description: 'Adversary gathers information about the target environment.',
    order: 1,
  },
  {
    name: 'weaponization',
    display_name: 'Weaponization',
    description: 'Adversary crafts a deliverable payload.',
    order: 2,
  },
  {
    name: 'delivery',
    display_name: 'Delivery',
    description: 'Adversary transmits the payload to the target.',
    order: 3,
  },
  {
    name: 'exploitation',
    display_name: 'Exploitation',
    description: 'Adversary triggers code execution or credential reuse.',
    order: 4,
  },
  {
    name: 'installation',
    display_name: 'Installation',
    description: 'Adversary establishes a persistence mechanism.',
    order: 5,
  },
  {
    name: 'command_and_control',
    display_name: 'Command and Control',
    description: 'Adversary establishes a control channel over the compromised system.',
    order: 6,
  },
  {
    name: 'actions_on_objectives',
    display_name: 'Actions on Objectives',
    description: 'Adversary executes the goal of the intrusion.',
    order: 7,
  },
];

function buildStages(
  detections: Record<string, { rule_ids: string[]; first_seen: string }>
): KillChainStage[] {
  return KILL_CHAIN_STAGE_TEMPLATES.map((template) => {
    const hit = detections[template.name];
    return {
      ...template,
      detected: hit !== undefined,
      detection_rule_ids: hit?.rule_ids ?? [],
      first_seen: hit?.first_seen ?? null,
    };
  });
}

export const MOCK_KILL_CHAIN_ANALYSES: KillChainAnalysis[] = [
  // Chain 1 — AUTH_BRUTE (wade.hollis)
  // DET-AUTH-001 → delivery, DET-AUTH-002 → exploitation
  {
    incident_id: 'inc-0001',
    correlation_id: CORRELATION_IDS.AUTH_BRUTE,
    actor_id: 'wade.hollis',
    stages: buildStages({
      delivery: {
        rule_ids: ['DET-AUTH-001'],
        first_seen: minutesAgo(3962),
      },
      exploitation: {
        rule_ids: ['DET-AUTH-002'],
        first_seen: minutesAgo(3959),
      },
    }),
    progression_percentage: 28,
    highest_stage: 'exploitation',
    first_activity: minutesAgo(3962),
    last_activity: minutesAgo(3959),
  },

  // Chain 2 — SESSION_HIJACK (alex.nguyen)
  // DET-SESSION-003 → exploitation + command_and_control
  {
    incident_id: 'inc-0002',
    correlation_id: CORRELATION_IDS.SESSION_HIJACK,
    actor_id: 'alex.nguyen',
    stages: buildStages({
      exploitation: {
        rule_ids: ['DET-SESSION-003'],
        first_seen: minutesAgo(2870),
      },
      command_and_control: {
        rule_ids: ['DET-SESSION-003'],
        first_seen: minutesAgo(2865),
      },
    }),
    progression_percentage: 28,
    highest_stage: 'command_and_control',
    first_activity: minutesAgo(2880),
    last_activity: minutesAgo(2864),
  },

  // Chain 3 — DOC_EXFIL (priya.shah)
  // DET-DOC-004 + DET-DOC-006 → actions_on_objectives
  {
    incident_id: 'inc-0003',
    correlation_id: CORRELATION_IDS.DOC_EXFIL,
    actor_id: 'priya.shah',
    stages: buildStages({
      actions_on_objectives: {
        rule_ids: ['DET-DOC-004', 'DET-DOC-006'],
        first_seen: minutesAgo(1810),
      },
    }),
    progression_percentage: 14,
    highest_stage: 'actions_on_objectives',
    first_activity: minutesAgo(1810),
    last_activity: minutesAgo(1800),
  },

  // Chain 4 — SVC_ABUSE (svc-sat-telemetry)
  // DET-SVC-007 → reconnaissance + delivery
  {
    incident_id: 'inc-0004',
    correlation_id: CORRELATION_IDS.SVC_ABUSE,
    actor_id: 'svc-sat-telemetry',
    stages: buildStages({
      reconnaissance: {
        rule_ids: ['DET-SVC-007'],
        first_seen: minutesAgo(1205),
      },
      delivery: {
        rule_ids: ['DET-SVC-007'],
        first_seen: minutesAgo(1205),
      },
    }),
    progression_percentage: 28,
    highest_stage: 'delivery',
    first_activity: minutesAgo(1205),
    last_activity: minutesAgo(1200),
  },

  // Chain 5 — POLICY_CHANGE (robin.chen)
  // DET-ART-008 → installation, DET-POL-009 → actions_on_objectives
  {
    incident_id: 'inc-0005',
    correlation_id: CORRELATION_IDS.POLICY_CHANGE,
    actor_id: 'robin.chen',
    stages: buildStages({
      installation: {
        rule_ids: ['DET-ART-008'],
        first_seen: minutesAgo(510),
      },
      actions_on_objectives: {
        rule_ids: ['DET-POL-009'],
        first_seen: minutesAgo(485),
      },
    }),
    progression_percentage: 28,
    highest_stage: 'actions_on_objectives',
    first_activity: minutesAgo(510),
    last_activity: minutesAgo(485),
  },

  // Chain 6 — MULTI_STAGE (mira.delacroix)
  // DET-CORR-010 composite rule — covers 4 stages
  {
    incident_id: 'inc-0006',
    correlation_id: CORRELATION_IDS.MULTI_STAGE,
    actor_id: 'mira.delacroix',
    stages: buildStages({
      delivery: {
        rule_ids: ['DET-CORR-010'],
        first_seen: minutesAgo(165),
      },
      exploitation: {
        rule_ids: ['DET-CORR-010'],
        first_seen: minutesAgo(150),
      },
      command_and_control: {
        rule_ids: ['DET-CORR-010'],
        first_seen: minutesAgo(135),
      },
      actions_on_objectives: {
        rule_ids: ['DET-CORR-010'],
        first_seen: minutesAgo(120),
      },
    }),
    progression_percentage: 57,
    highest_stage: 'actions_on_objectives',
    first_activity: minutesAgo(165),
    last_activity: minutesAgo(120),
  },
];

// ------------------------------------------------------------
// Campaigns
//
// Two campaigns cluster the six correlation chains by shared
// indicators. Four of six incidents are linked; AUTH_BRUTE and
// SESSION_HIJACK stand alone as isolated attacks that don't
// fit a broader pattern in this 72-hour window.
//
//   id        name                                 incidents
//   ──────────────────────────────────────────────────────────
//   CAM-0001  Insider Analyst Exfiltration Ring    DOC_EXFIL, MULTI_STAGE
//   CAM-0002  Privileged Infrastructure Tampering  SVC_ABUSE, POLICY_CHANGE
//
// CAM-0001 has a strong technique overlap (both chains share
// T1041 Exfiltration Over C2 Channel) and actor-role affinity
// (both primary actors are analysts). Confidence: high.
//
// CAM-0002 has NO shared MITRE techniques — the link is
// thematic: both chains involve non-standard-user identities
// (a service account and a platform admin) making
// unauthorized privileged operations against infrastructure
// controls. Confidence: medium. The summary documents the
// weaker link honestly so analysts don't overfit.
// ------------------------------------------------------------

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    campaign_id: 'CAM-0001',
    campaign_name: 'Insider Analyst Exfiltration Ring',
    campaign_type: 'insider_threat',
    incident_correlation_ids: [
      CORRELATION_IDS.DOC_EXFIL,
      CORRELATION_IDS.MULTI_STAGE,
    ],
    shared_actors: [],
    shared_ttps: ['T1041'],
    severity: 'critical',
    confidence: 'high',
    first_seen: minutesAgo(1810),
    last_seen: minutesAgo(120),
    summary:
      'Two analysts (priya.shah, mira.delacroix) exfiltrated restricted documents via Exfiltration Over C2 Channel (T1041) within a 28-hour window. The pattern suggests either coordinated action or copycat behavior following the first contained attempt — both actors share analyst role and overlapping document scope.',
  },
  {
    campaign_id: 'CAM-0002',
    campaign_name: 'Privileged Infrastructure Tampering',
    campaign_type: 'privilege_abuse',
    incident_correlation_ids: [
      CORRELATION_IDS.SVC_ABUSE,
      CORRELATION_IDS.POLICY_CHANGE,
    ],
    shared_actors: [],
    shared_ttps: [],
    severity: 'critical',
    confidence: 'medium',
    first_seen: minutesAgo(1205),
    last_seen: minutesAgo(485),
    summary:
      'Non-human and privileged identities (svc-sat-telemetry, robin.chen) performed unauthorized operations against infrastructure controls within a 12-hour window. No shared MITRE techniques; correlated by actor-class and target surface. Likely independent incidents worth tracking together as a privilege-abuse cluster.',
  },
];

// ------------------------------------------------------------
// Exercise report
//
// Single rolled-up report covering the 72-hour demo window.
// Every numeric field is derived from another mock constant so
// a recruiter checking the report tab against the metrics,
// analytics, or MITRE tabs sees the same numbers everywhere:
//
//   field                          source
//   ───────────────────────────────────────────────────────
//   summary.total_*                MOCK_METRICS
//   summary.scenarios_executed     MOCK_SCENARIO_HISTORY.length
//   scenario_results               MOCK_SCENARIO_HISTORY
//   detection_coverage.rules_total MOCK_RULE_EFFECTIVENESS.length
//   detection_coverage.rules_triggered  # of entries with trigger_count > 0
//   detection_coverage.rules_list  MOCK_RULE_EFFECTIVENESS
//   response_effectiveness         sum of responses_generated in history
//   risk_summary                   top actor + count from MOCK_RISK_PROFILES
//   mitre_coverage.tactics         MOCK_TACTIC_COVERAGE (all 8 present)
//   mitre_coverage.techniques      MOCK_MITRE_COVERAGE where covered (dedup)
//   mitre_coverage.coverage_%      mean of MOCK_TACTIC_COVERAGE percentages
//
// Because ExerciseReport.scenario_results and
// detection_coverage.rules_list are typed
// `Record<string, unknown>[]`, the concrete interfaces are
// cast via `unknown` — structurally compatible but TS can't
// infer the index signature from a named interface.
// ------------------------------------------------------------

export const MOCK_EXERCISE_REPORT: ExerciseReport = {
  report_id: 'report-72hr-001',
  title: 'Vanta Orbital 72-Hour SOC Exercise',
  generated_at: REFERENCE_NOW_ISO,
  exercise_window: {
    start: daysAgo(3),
    end: REFERENCE_NOW_ISO,
  },
  summary: {
    total_events: MOCK_METRICS.total_events,
    total_alerts: MOCK_METRICS.total_alerts,
    total_incidents: MOCK_METRICS.total_incidents,
    total_responses: MOCK_METRICS.total_responses,
    scenarios_executed: 6,
  },
  scenario_results: MOCK_SCENARIO_HISTORY as unknown as Record<
    string,
    unknown
  >[],
  detection_coverage: {
    rules_total: 10,
    rules_triggered: 9,
    rules_list: MOCK_RULE_EFFECTIVENESS as unknown as Record<
      string,
      unknown
    >[],
  },
  response_effectiveness: {
    // In-window responses (triggered within the 72-hour exercise
    // window). Chain: resp-0001/0003/0004. Background: resp-0010
    // (ip_block inc-0012) and resp-0011 (session_revoke inc-0013).
    responses_executed: 5,
    responses_total: 10,
    // 4 contained incidents (inc-0001, inc-0004 chain; inc-0012,
    // inc-0013 background) out of 11 in-window incidents.
    containment_rate: 0.36,
    mean_time_to_contain_minutes: 165,
    playbooks_invoked: [
      'pb-session-revoke-v1',
      'pb-download-restrict-v1',
      'pb-service-disable-v1',
      'pb-edge-ip-block-v1',
    ],
  },
  risk_summary: {
    highest_risk_actor: 'priya.shah',
    highest_peak_score: 75,
    actors_with_elevated_risk: 4,
    contained_actors: 2,
  },
  recommendations: [
    'Deploy a WAF-layer rule for T1190 (Exploit Public-Facing Application) to close the current TA0001 Initial Access coverage gap.',
    'Extend T1078 (Valid Accounts) detection to the Persistence (TA0003) and Defense Evasion (TA0005) tactics — the technique is currently mapped only under Initial Access.',
    'Review DET-DOC-005 (Abnormal Bulk Document Access) threshold — the rule is dormant despite observed bulk-read activity in the DOC_EXFIL chain.',
    'Investigate the CAM-0001 cluster: priya.shah and mira.delacroix both exfiltrated via T1041 within a 28-hour window.',
    'Tighten platform-admin change control following inc-0005 (policy-firewall-egress) — response still open at report generation.',
  ],
  mitre_coverage: {
    tactics_covered: [
      'TA0001',
      'TA0003',
      'TA0005',
      'TA0006',
      'TA0007',
      'TA0008',
      'TA0009',
      'TA0010',
    ],
    techniques_covered: [
      'T1041',
      'T1046',
      'T1078',
      'T1110',
      'T1213',
      'T1550',
      'T1554',
      'T1562',
    ],
    coverage_percentage: 83,
  },
};

// ------------------------------------------------------------
// Platform users
//
// Human accounts that appear in the SOC narrative. The
// service identity svc-sat-telemetry from Chain 4 is omitted
// intentionally — it shows up in the identities tab but not
// in the human-user roster. Seven entries keep the admin
// users view populated without implying the tenant is larger
// than the narrative supports.
//
// created_at timestamps are spread from ~45 days to ~2 years
// ago so the roster reads like an organically grown SOC team
// rather than everyone being provisioned at the same moment.
// ------------------------------------------------------------

export const MOCK_PLATFORM_USERS: PlatformUser[] = [
  {
    user_id: 'usr-0001',
    username: 'robin.chen',
    role: 'platform-admin',
    display_name: 'Robin Chen',
    created_at: daysAgo(730),
  },
  {
    user_id: 'usr-0002',
    username: 'operator-soc-01',
    role: 'operator',
    display_name: 'SOC Operator 01',
    created_at: daysAgo(620),
  },
  {
    user_id: 'usr-0003',
    username: 'operator-soc-02',
    role: 'operator',
    display_name: 'SOC Operator 02',
    created_at: daysAgo(560),
  },
  {
    user_id: 'usr-0004',
    username: 'alex.nguyen',
    role: 'engineer',
    display_name: 'Alex Nguyen',
    created_at: daysAgo(480),
  },
  {
    user_id: 'usr-0005',
    username: 'priya.shah',
    role: 'analyst',
    display_name: 'Priya Shah',
    created_at: daysAgo(380),
  },
  {
    user_id: 'usr-0006',
    username: 'mira.delacroix',
    role: 'analyst',
    display_name: 'Mira Delacroix',
    created_at: daysAgo(210),
  },
  {
    user_id: 'usr-0007',
    username: 'wade.hollis',
    role: 'contractor',
    display_name: 'Wade Hollis',
    created_at: daysAgo(45),
  },
];

// ------------------------------------------------------------
// Filter helpers
//
// Used by the api.ts mock fallback so the filtered shape
// matches what the live backend would return for the same
// query string. Each parameter is independently optional and
// applies AND semantics — passing no filter returns the full
// list unchanged.
// ------------------------------------------------------------

export function filterEvents(
  events: Event[],
  filter?: {
    actor_id?: string;
    correlation_id?: string;
    event_type?: string;
    since_minutes?: number;
  },
): Event[] {
  if (!filter) return events;
  const cutoff =
    filter.since_minutes !== undefined
      ? REFERENCE_NOW - filter.since_minutes * 60_000
      : null;
  return events.filter((event) => {
    if (filter.actor_id && event.actor_id !== filter.actor_id) return false;
    if (filter.correlation_id && event.correlation_id !== filter.correlation_id) {
      return false;
    }
    if (filter.event_type && event.event_type !== filter.event_type) return false;
    if (cutoff !== null && Date.parse(event.timestamp) < cutoff) return false;
    return true;
  });
}

export function filterAlerts(
  alerts: Alert[],
  filter?: {
    actor_id?: string;
    correlation_id?: string;
    rule_id?: string;
  },
): Alert[] {
  if (!filter) return alerts;
  return alerts.filter((alert) => {
    if (filter.actor_id && alert.actor_id !== filter.actor_id) return false;
    if (filter.correlation_id && alert.correlation_id !== filter.correlation_id) {
      return false;
    }
    if (filter.rule_id && alert.rule_id !== filter.rule_id) return false;
    return true;
  });
}
