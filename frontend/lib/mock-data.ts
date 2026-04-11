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
  Metrics,
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
