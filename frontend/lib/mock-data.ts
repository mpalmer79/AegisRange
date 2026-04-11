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
  Event,
  HealthStatus,
  Incident,
  Metrics,
  RiskProfile,
  RuleEffectiveness,
  ScenarioHistoryEntry,
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

export const MOCK_EVENTS: Event[] = [
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
