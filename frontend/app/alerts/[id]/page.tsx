'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getAlerts, getEvents, getIncident, getResponses } from '@/lib/api';
import type { Alert, Event, Incident, IncidentResponse } from '@/lib/types';

const SEVERITY_STYLES: Record<
  string,
  { badge: string; border: string; text: string }
> = {
  critical: {
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    border: 'border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
  },
  high: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    border: 'border-orange-500/30',
    text: 'text-orange-700 dark:text-orange-400',
  },
  medium: {
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/30',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  low: {
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  informational: {
    badge: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
    border: 'border-gray-500/30',
    text: 'text-slate-600 dark:text-gray-400',
  },
};

function getSeverityStyle(severity?: string) {
  return SEVERITY_STYLES[severity?.toLowerCase() ?? ''] ?? SEVERITY_STYLES.low;
}

function formatTimestamp(ts?: string) {
  if (!ts) return 'Unknown';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatConfidence(confidence?: string) {
  if (!confidence) return 'unknown';
  return confidence;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getEventLabel(event: Event) {
  if (event.event_type) return event.event_type;

  if (event.payload && typeof event.payload === 'object') {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.event_type === 'string') {
      return payload.event_type;
    }
  }

  return 'unknown_event';
}

function getResponseLabel(response: IncidentResponse) {
  return response.response_type || response.summary || 'unknown_response';
}

export default function AlertDetailPage() {
  const params = useParams();
  const alertId = typeof params?.id === 'string' ? params.id : null;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [responses, setResponses] = useState<IncidentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const severityStyle = getSeverityStyle(alert?.severity);

  useEffect(() => {
    async function loadAlertDetail() {
      if (!alertId) {
        setError('Invalid alert id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const allAlerts = await getAlerts({ limit: 500 });
        const matchedAlert =
          Array.isArray(allAlerts)
            ? allAlerts.find((item) => item.alert_id === alertId) ?? null
            : null;

        if (!matchedAlert) {
          setAlert(null);
          setIncident(null);
          setEvents([]);
          setResponses([]);
          setLoading(false);
          return;
        }

        setAlert(matchedAlert);

        const correlationId = matchedAlert.correlation_id;
        const contributingIds = new Set(matchedAlert.contributing_event_ids ?? []);

        const [eventsResult, responsesResult] = await Promise.all([
          correlationId ? getEvents({ correlation_id: correlationId, limit: 100 }) : Promise.resolve([]),
          getResponses(),
        ]);

        const fetchedEvents = Array.isArray(eventsResult) ? eventsResult : [];
        const fetchedResponses = Array.isArray(responsesResult) ? responsesResult : [];

        const relatedEvents =
          contributingIds.size > 0
            ? fetchedEvents.filter(
                (event) => event.event_id && contributingIds.has(event.event_id)
              )
            : fetchedEvents.filter((event) => {
                if (correlationId && event.correlation_id === correlationId) return true;
                if (matchedAlert.actor_id && event.actor_id === matchedAlert.actor_id) return true;
                return false;
              });

        const relatedResponses = correlationId
          ? fetchedResponses.filter((response) => response.correlation_id === correlationId)
          : [];

        setEvents(relatedEvents);
        setResponses(relatedResponses);

        if (correlationId) {
          try {
            const incidentResult = await getIncident(correlationId);
            setIncident(incidentResult);
          } catch {
            setIncident(null);
          }
        } else {
          setIncident(null);
        }
      } catch {
        setError('Failed to load alert detail');
        setAlert(null);
        setIncident(null);
        setEvents([]);
        setResponses([]);
      } finally {
        setLoading(false);
      }
    }

    loadAlertDetail();
  }, [alertId]);

  const whyThisTriggered = useMemo(() => {
    if (!alert) return [];

    const sortedEvents = [...events].sort((a, b) =>
      String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? ''))
    );

    const firstTimestamp = sortedEvents[0]?.timestamp;
    const lastTimestamp = sortedEvents[sortedEvents.length - 1]?.timestamp;

    const evidenceWindow =
      sortedEvents.length > 0
        ? `${formatTimestamp(firstTimestamp)} to ${formatTimestamp(lastTimestamp)}`
        : 'No event window available';

    return [
      {
        label: 'Rule',
        value: alert.rule_name || alert.rule_id || 'Unknown rule',
      },
      {
        label: 'Condition',
        value: alert.summary || 'No summary provided by the detection engine.',
      },
      {
        label: 'Actor',
        value: alert.actor_id || 'Unknown actor',
      },
      {
        label: 'Evidence window',
        value: evidenceWindow,
      },
      {
        label: 'Contributing events',
        value: String(alert.contributing_event_ids?.length ?? events.length),
      },
      {
        label: 'Outcome',
        value: incident?.incident_id
          ? `Escalated into incident ${incident.incident_id}`
          : 'Alert recorded without confirmed incident linkage',
      },
    ];
  }, [alert, events, incident]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm font-mono text-cyan-700 animate-pulse dark:text-cyan-400">
          Loading alert detail...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-700 dark:text-red-400">
        <p className="text-sm font-medium">{error}</p>
        <div className="mt-4">
          <Link
            href="/alerts"
            className="text-sm font-mono uppercase tracking-wide text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            Back to alerts
          </Link>
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-800 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <p className="text-lg font-semibold">Alert not found</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-gray-500">
          The requested alert id does not exist in the current alert set.
        </p>
        <div className="mt-4">
          <Link
            href="/alerts"
            className="text-sm font-mono uppercase tracking-wide text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            Back to alerts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <div className="mb-6">
        <Link
          href="/alerts"
          className="text-xs font-mono uppercase tracking-wide text-slate-500 hover:text-cyan-700 dark:text-gray-500 dark:hover:text-cyan-400"
        >
          ← Back to alerts
        </Link>
      </div>

      <section
        className={`relative overflow-hidden rounded-2xl border ${severityStyle.border} bg-gradient-to-br from-white via-rose-50 to-orange-50 px-6 py-8 shadow-sm dark:from-gray-900 dark:via-red-950/20 dark:to-gray-900`}
      >
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Alert Detail
            </p>
            <h1 className="mt-2 break-all text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100 sm:text-3xl">
              {alert.rule_name || 'Unnamed detection rule'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400">
              This page explains why the detection fired, what evidence supported it,
              and how it links into the broader incident workflow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-3 py-1 text-xs font-mono uppercase ${severityStyle.badge}`}
            >
              {alert.severity || 'low'}
            </span>
            <span className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-mono uppercase text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {formatConfidence(alert.confidence)}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Alert ID
            </p>
            <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
              {alert.alert_id || 'unknown'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Rule ID
            </p>
            <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
              {alert.rule_id || 'unknown'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Actor
            </p>
            <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
              {alert.actor_id || 'unknown'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Created
            </p>
            <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
              {formatTimestamp(alert.created_at)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Correlation
            </p>
            <p className="mt-1 break-all text-sm font-mono text-cyan-700 dark:text-cyan-400">
              {alert.correlation_id || 'not linked'}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Explainability
          </p>
          <h2 className="mt-2 text-2xl font-bold">Why this triggered</h2>

          <div className="mt-5 space-y-3">
            {whyThisTriggered.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950"
              >
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                  {item.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-gray-300">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Incident linkage
          </p>
          <h2 className="mt-2 text-2xl font-bold">Escalation context</h2>

          {!incident ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
                No incident record was resolved from this alert&apos;s correlation id.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-mono font-medium text-slate-900 dark:text-gray-100">
                  {incident.incident_id || incident.correlation_id || 'unknown_incident'}
                </span>
                {incident.status && (
                  <span className="rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-mono uppercase text-amber-700 dark:text-amber-400">
                    {incident.status}
                  </span>
                )}
                {incident.severity && (
                  <span className={`text-xs font-mono uppercase ${getSeverityStyle(incident.severity).text}`}>
                    {incident.severity}
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Primary actor
                  </p>
                  <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                    {incident.primary_actor_id || 'unknown'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                    Risk score
                  </p>
                  <p className="mt-1 text-sm font-mono text-red-700 dark:text-red-400">
                    {incident.risk_score != null ? incident.risk_score : 'n/a'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/incidents/${incident.correlation_id}`}
                  className="text-xs font-mono uppercase tracking-wide text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  View linked incident
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Evidence
            </p>
            <h2 className="mt-2 text-2xl font-bold">Contributing events</h2>
          </div>
          <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-mono uppercase text-slate-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
              No event evidence was resolved for this alert.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {events.map((event, index) => (
              <div
                key={event.event_id || `event-${index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                      {getEventLabel(event)}
                    </p>
                    <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                      {event.event_id || 'unknown_event_id'}
                    </p>
                  </div>

                  <span className="text-xs font-mono text-slate-500 dark:text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Actor
                    </p>
                    <p className="mt-1 break-all text-sm font-mono text-slate-700 dark:text-gray-300">
                      {event.actor_id || 'unknown'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Correlation
                    </p>
                    <p className="mt-1 break-all text-sm font-mono text-slate-700 dark:text-gray-300">
                      {event.correlation_id || 'n/a'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                      {event.status || 'unknown'}
                    </p>
                  </div>
                </div>

                {event.payload !== undefined && (
                  <details className="mt-4 rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-mono uppercase tracking-wide text-slate-600 dark:text-gray-400">
                      View event payload
                    </summary>
                    <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 text-xs leading-6 text-slate-700 dark:border-gray-800 dark:text-gray-300">
                      {safeJson(event.payload)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Response trace
              </p>
              <h2 className="mt-2 text-2xl font-bold">Related responses</h2>
            </div>
            <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-mono uppercase text-slate-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
              {responses.length} response{responses.length === 1 ? '' : 's'}
            </span>
          </div>

          {responses.length === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
                No related response actions were resolved for this alert.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {responses.map((response, index) => (
                <div
                  key={response.response_id || `response-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                        {getResponseLabel(response)}
                      </p>
                      <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                        {response.response_id || 'unknown_response_id'}
                      </p>
                    </div>

                    <span className="text-xs font-mono text-slate-500 dark:text-gray-500">
                      {formatTimestamp(response.triggered_at)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Status
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {response.status || 'unknown'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Target
                      </p>
                      <p className="mt-1 break-all text-sm font-mono text-slate-700 dark:text-gray-300">
                        {response.target || 'n/a'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Operator
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {response.operator || 'system'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Executed
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {formatTimestamp(response.executed_at ?? undefined)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
                      {response.summary || 'No response summary provided.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Raw alert context
          </p>
          <h2 className="mt-2 text-2xl font-bold">Detection payload</h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Summary
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
                {alert.summary || 'No summary provided.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                Contributing event IDs
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(alert.contributing_event_ids ?? []).length > 0 ? (
                  alert.contributing_event_ids.map((id) => (
                    <span
                      key={id}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      {id}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500 dark:text-gray-500">
                    No contributing event ids recorded.
                  </span>
                )}
              </div>
            </div>

            {alert.payload !== undefined && (
              <details className="rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-800 dark:bg-gray-950">
                <summary className="cursor-pointer px-4 py-3 text-xs font-mono uppercase tracking-wide text-slate-600 dark:text-gray-400">
                  View alert payload
                </summary>
                <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 text-xs leading-6 text-slate-700 dark:border-gray-800 dark:text-gray-300">
                  {safeJson(alert.payload)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}