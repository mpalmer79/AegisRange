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
