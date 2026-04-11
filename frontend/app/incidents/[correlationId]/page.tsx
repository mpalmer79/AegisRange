'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getIncident,
  updateIncidentStatus,
  getIncidentNotes,
  addIncidentNote,
  getRiskProfile,
  getAlerts,
  getEvents,
  getResponses,
} from '@/lib/api';
import type {
  Incident,
  IncidentStatus,
  IncidentNote,
  RiskProfile,
  Alert,
  Event,
  IncidentResponse,
} from '@/lib/types';
import { INCIDENT_STATUS_TRANSITIONS } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  investigating: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  contained: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  closed: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  informational: 'bg-gray-500/15 text-slate-600 dark:text-gray-400 border-gray-500/30',
};

const TIMELINE_ENTRY_STYLES: Record<string, { dot: string; icon: string }> = {
  event: { dot: 'bg-cyan-500', icon: 'E' },
  alert: { dot: 'bg-amber-500', icon: 'A' },
  detection: { dot: 'bg-red-500', icon: 'D' },
  response: { dot: 'bg-orange-500', icon: 'R' },
  incident: { dot: 'bg-purple-500', icon: 'I' },
  status_change: { dot: 'bg-green-500', icon: 'S' },
  note: { dot: 'bg-cyan-700', icon: 'N' },
};

type TimelineRow = {
  id: string;
  type: string;
  summary: string;
  timestamp?: string;
};

function formatTimestamp(ts?: string) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function getTimelineStyle(type: string) {
  const lower = type.toLowerCase();

  for (const [key, value] of Object.entries(TIMELINE_ENTRY_STYLES)) {
    if (lower.includes(key)) return value;
  }

  return { dot: 'bg-gray-500', icon: '?' };
}

function riskScoreBadgeStyle(score: number): string {
  if (score >= 81) return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
  if (score >= 51) return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30';
  if (score >= 21) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
}

function riskScoreBarColor(score: number): string {
  if (score >= 81) return 'bg-red-500';
  if (score >= 51) return 'bg-orange-500';
  if (score >= 21) return 'bg-amber-500';
  return 'bg-green-500';
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

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const correlationId = typeof params?.id === 'string' ? params.id : null;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [responses, setResponses] = useState<IncidentResponse[]>([]);
  const [notes, setNotes] = useState<IncidentNote[]>([]);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [noteAuthor, setNoteAuthor] = useState('');
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    async function loadIncidentDetail() {
      if (!correlationId) {
        setError('Invalid incident id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const incidentResult = await getIncident(correlationId);
        setIncident(incidentResult);

        const [alertsResult, eventsResult, responsesResult, notesResult] = await Promise.all([
          getAlerts({ limit: 1000 }),
          getEvents({ correlation_id: correlationId, limit: 200 }),
          getResponses(),
          getIncidentNotes(correlationId),
        ]);

        const allAlerts = Array.isArray(alertsResult) ? alertsResult : [];
        const allEvents = Array.isArray(eventsResult) ? eventsResult : [];
        const allResponses = Array.isArray(responsesResult) ? responsesResult : [];
        const noteList = Array.isArray(notesResult) ? notesResult : [];

        setAlerts(
          allAlerts
            .filter((alert) => alert.correlation_id === correlationId)
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
        );

        setEvents(
          allEvents.sort(
            (a, b) =>
              new Date(a.timestamp ?? '').getTime() - new Date(b.timestamp ?? '').getTime()
          )
        );

        setResponses(
          allResponses
            .filter((response) => response.correlation_id === correlationId)
            .sort(
              (a, b) =>
                new Date(a.triggered_at ?? '').getTime() -
                new Date(b.triggered_at ?? '').getTime()
            )
        );

        setNotes(
          noteList.sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );

        if (incidentResult.primary_actor_id) {
          try {
            const profile = await getRiskProfile(incidentResult.primary_actor_id);
            setRiskProfile(profile);
          } catch {
            setRiskProfile(null);
          }
        } else {
          setRiskProfile(null);
        }
      } catch {
        setError('Failed to fetch incident details');
      } finally {
        setLoading(false);
      }
    }

    loadIncidentDetail();
  }, [correlationId]);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!incident || !correlationId) return;

    try {
      setUpdating(true);
      setError(null);
      const updated = await updateIncidentStatus(correlationId, newStatus);
      setIncident(updated);
    } catch {
      setError('Failed to update incident status');
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitNote = async () => {
    if (!correlationId || !noteAuthor.trim() || !noteContent.trim()) return;

    try {
      setSubmittingNote(true);
      setError(null);
      await addIncidentNote(correlationId, noteAuthor.trim(), noteContent.trim());
      setNoteContent('');

      setNotesLoading(true);
      const refreshedNotes = await getIncidentNotes(correlationId);
      setNotes(
        (Array.isArray(refreshedNotes) ? refreshedNotes : []).sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );
    } catch {
      setError('Failed to add note');
    } finally {
      setSubmittingNote(false);
      setNotesLoading(false);
    }
  };

  const validTransitions = incident
    ? INCIDENT_STATUS_TRANSITIONS[incident.status as IncidentStatus] ?? []
    : [];

  const timelineRows = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = [];

    if (incident?.timeline?.length) {
      for (const entry of incident.timeline) {
        rows.push({
          id: entry.entry_id || `${entry.entry_type}-${entry.timestamp}-${entry.summary}`,
          type: entry.entry_type || 'incident',
          summary: entry.summary,
          timestamp: entry.timestamp,
        });
      }
    }

    for (const event of events) {
      rows.push({
        id: event.event_id || `event-${event.timestamp}-${event.actor_id}`,
        type: 'event',
        summary: `${getEventLabel(event)} observed for ${event.actor_id || 'unknown actor'}`,
        timestamp: event.timestamp,
      });
    }

    for (const alert of alerts) {
      rows.push({
        id: alert.alert_id || `alert-${alert.created_at}-${alert.rule_id}`,
        type: 'alert',
        summary: `${alert.rule_name || alert.rule_id || 'Detection'} created for ${alert.actor_id || 'unknown actor'}`,
        timestamp: alert.created_at,
      });
    }

    for (const response of responses) {
      rows.push({
        id: response.response_id || `response-${response.triggered_at}-${response.response_type}`,
        type: 'response',
        summary: `${getResponseLabel(response)} executed against ${response.target || 'unknown target'}`,
        timestamp: response.triggered_at,
      });
    }

    for (const note of notes) {
      rows.push({
        id: note.note_id,
        type: 'note',
        summary: `Analyst note added by ${note.author}`,
        timestamp: note.created_at,
      });
    }

    return rows.sort(
      (a, b) =>
        new Date(a.timestamp ?? '').getTime() - new Date(b.timestamp ?? '').getTime()
    );
  }, [incident, events, alerts, responses, notes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-cyan-700 dark:text-cyan-400 font-mono text-sm animate-pulse">
          Loading incident...
        </div>
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div>
        <Link
          href="/incidents"
          className="mb-4 inline-block text-sm font-mono text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          &larr; Back to Incidents
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!incident) return null;

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/incidents"
          className="text-sm font-mono text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          Incidents
        </Link>
        <span className="text-sm font-mono text-slate-400 dark:text-gray-600">/</span>
        <span className="truncate text-sm font-mono text-slate-600 dark:text-gray-400">
          {incident.incident_id || correlationId}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Incident Detail
            </p>
            <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-gray-100 sm:text-2xl">
              {incident.incident_id || 'Incident'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400">
              Aggregated investigation record tied to correlation id {incident.correlation_id}.
              This page shows how alerts, events, responses, notes, and status transitions
              accumulated into the current case state.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-3 py-1 text-xs font-mono uppercase ${STATUS_STYLES[incident.status] ?? STATUS_STYLES.open}`}
            >
              {incident.status}
            </span>
            <span
              className={`rounded border px-3 py-1 text-xs font-mono uppercase ${SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.low}`}
            >
              {incident.severity}
            </span>
          </div>
        </div>

        {validTransitions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-gray-800">
            <span className="mr-2 text-xs font-mono text-slate-500 dark:text-gray-500">
              TRANSITION TO:
            </span>
            {validTransitions.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={updating}
                className={`rounded border px-3 py-1.5 text-xs font-mono uppercase transition-all disabled:opacity-50 ${
                  STATUS_STYLES[status] ??
                  'border-slate-400 bg-slate-300 text-slate-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
                } hover:brightness-110`}
              >
                {updating ? '...' : status}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Primary actor
            </p>
            <p className="mt-1 break-all text-sm font-mono text-slate-800 dark:text-gray-200">
              {incident.primary_actor_id || 'unknown'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Confidence
            </p>
            <p className="mt-1 text-sm font-mono uppercase text-slate-700 dark:text-gray-300">
              {incident.confidence ?? '-'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Risk score
            </p>
            <p className="mt-1 text-sm font-mono font-bold text-red-700 dark:text-red-400">
              {incident.risk_score ?? 'n/a'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Correlation
            </p>
            <p className="mt-1 break-all text-xs font-mono text-cyan-700 dark:text-cyan-400">
              {incident.correlation_id}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Created
            </p>
            <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
              {formatTimestamp(incident.created_at)}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-500/20 bg-white p-5 shadow-sm dark:border-amber-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Related alerts
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-400">
            {alerts.length}
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-white p-5 shadow-sm dark:border-cyan-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Related events
          </p>
          <p className="mt-2 text-3xl font-bold text-cyan-700 dark:text-cyan-400">
            {events.length}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-white p-5 shadow-sm dark:border-orange-500/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Responses
          </p>
          <p className="mt-2 text-3xl font-bold text-orange-700 dark:text-orange-400">
            {responses.length}
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-800/20 bg-white p-5 shadow-sm dark:border-cyan-800/20 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Analyst notes
          </p>
          <p className="mt-2 text-3xl font-bold text-cyan-800 dark:text-cyan-400">
            {notes.length}
          </p>
        </div>
      </section>

      {(incident.risk_score != null || riskProfile) && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-300">
            Risk Assessment
          </h2>

          <div className="flex flex-wrap gap-6">
            {incident.risk_score != null && (
              <div>
                <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
                  INCIDENT RISK SCORE
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded border px-4 py-2 text-2xl font-mono font-bold ${riskScoreBadgeStyle(incident.risk_score)}`}
                  >
                    {incident.risk_score}
                  </span>
                  <div className="h-3 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${riskScoreBarColor(incident.risk_score)}`}
                      style={{ width: `${Math.min(incident.risk_score, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {riskProfile && (
              <div className="min-w-[220px] flex-1">
                <p className="mb-2 text-xs font-mono text-slate-500 dark:text-gray-500">
                  ACTOR PROFILE:{' '}
                  <span className="text-cyan-700 dark:text-cyan-400">
                    {riskProfile.actor_id}
                  </span>
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-xs font-mono text-slate-400 dark:text-gray-600">
                      CURRENT SCORE
                    </p>
                    <p className="font-mono font-bold text-slate-800 dark:text-gray-200">
                      {riskProfile.current_score}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-mono text-slate-400 dark:text-gray-600">
                      PEAK SCORE
                    </p>
                    <p className="font-mono font-bold text-slate-800 dark:text-gray-200">
                      {riskProfile.peak_score}
                    </p>
                  </div>
                </div>

                {riskProfile.contributing_rules.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-mono text-slate-400 dark:text-gray-600">
                      CONTRIBUTING RULES
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {riskProfile.contributing_rules.map((rule) => (
                        <span
                          key={rule}
                          className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {incident.affected_resources && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            Affected Resources
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {incident.affected_resources.documents?.length ? (
              <div>
                <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
                  DOCUMENTS
                </p>
                <div className="space-y-1">
                  {incident.affected_resources.documents.map((doc) => (
                    <p key={doc} className="text-xs font-mono text-slate-700 dark:text-gray-300">
                      {doc}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {incident.affected_resources.sessions?.length ? (
              <div>
                <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
                  SESSIONS
                </p>
                <div className="space-y-1">
                  {incident.affected_resources.sessions.map((session) => (
                    <p
                      key={session}
                      className="text-xs font-mono text-slate-700 dark:text-gray-300"
                    >
                      {session}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {incident.affected_resources.services?.length ? (
              <div>
                <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
                  SERVICES
                </p>
                <div className="space-y-1">
                  {incident.affected_resources.services.map((service) => (
                    <p
                      key={service}
                      className="text-xs font-mono text-slate-700 dark:text-gray-300"
                    >
                      {service}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {incident.affected_resources.actors?.length ? (
              <div>
                <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
                  ACTORS
                </p>
                <div className="space-y-1">
                  {incident.affected_resources.actors.map((actor) => (
                    <p
                      key={actor}
                      className="text-xs font-mono text-slate-700 dark:text-gray-300"
                    >
                      {actor}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-300">
          Timeline ({timelineRows.length} entries)
        </h2>

        {timelineRows.length === 0 ? (
          <p className="text-sm font-mono text-slate-400 dark:text-gray-600">
            No timeline entries available.
          </p>
        ) : (
          <div className="relative">
            <div className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200 dark:bg-gray-800" />
            <div className="space-y-4">
              {timelineRows.map((entry) => {
                const style = getTimelineStyle(entry.type);

                return (
                  <div key={entry.id} className="relative flex gap-4">
                    <div
                      className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.dot} text-[10px] font-bold text-white`}
                    >
                      {style.icon}
                    </div>

                    <div className="flex-1 pb-2">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono uppercase text-slate-500 dark:text-gray-500">
                          {entry.type}
                        </span>
                        <span className="text-xs font-mono text-slate-400 dark:text-gray-600">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-gray-300">
                        {entry.summary}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Related Alerts ({alerts.length})
          </h2>

          {alerts.length === 0 ? (
            <p className="text-sm font-mono text-slate-400 dark:text-gray-600">None</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Link
                  key={alert.alert_id}
                  href={`/alerts/${alert.alert_id}`}
                  className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                        {alert.rule_name || alert.rule_id || 'Detection'}
                      </p>
                      <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                        {alert.alert_id}
                      </p>
                    </div>
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-mono uppercase ${
                        SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
                    {alert.summary || 'No alert summary provided.'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            Evidence Events ({events.length})
          </h2>

          {events.length === 0 ? (
            <p className="text-sm font-mono text-slate-400 dark:text-gray-600">None</p>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => (
                <div
                  key={event.event_id || `event-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {getEventLabel(event)}
                  </p>
                  <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                    {event.event_id || 'unknown_event_id'}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Actor
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {event.actor_id || 'unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Timestamp
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {formatTimestamp(event.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            Responses ({responses.length})
          </h2>

          {responses.length === 0 ? (
            <p className="text-sm font-mono text-slate-400 dark:text-gray-600">None</p>
          ) : (
            <div className="space-y-3">
              {responses.map((response) => (
                <div
                  key={response.response_id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {getResponseLabel(response)}
                  </p>
                  <p className="mt-1 break-all text-xs font-mono text-slate-500 dark:text-gray-500">
                    {response.response_id}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Target
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {response.target || 'n/a'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                        Triggered
                      </p>
                      <p className="mt-1 text-sm font-mono text-slate-700 dark:text-gray-300">
                        {formatTimestamp(response.triggered_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
                      Summary
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-gray-300">
                      {response.summary || 'No response summary provided.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-300">
          Analyst Notes ({notes.length})
        </h2>

        {notesLoading ? (
          <div className="mb-4 text-sm font-mono text-cyan-700 animate-pulse dark:text-cyan-400">
            Loading notes...
          </div>
        ) : notes.length > 0 ? (
          <div className="mb-4 space-y-3">
            {notes.map((note) => (
              <div
                key={note.note_id}
                className="rounded-r-lg border border-slate-200 border-l-4 border-l-cyan-700 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-mono font-medium text-cyan-700 dark:text-cyan-400">
                    {note.author}
                  </span>
                  <span className="text-xs font-mono text-slate-400 dark:text-gray-600">
                    {formatTimestamp(note.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-gray-300">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm font-mono text-slate-400 dark:text-gray-600">
            No notes yet
          </p>
        )}

        <div className="border-t border-slate-200 pt-4 dark:border-gray-800">
          <p className="mb-3 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
            Add Note
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Author"
              value={noteAuthor}
              onChange={(e) => setNoteAuthor(e.target.value)}
              className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-mono text-slate-800 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />
            <textarea
              placeholder="Write your note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              className="w-full resize-none rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />
            <button
              onClick={handleSubmitNote}
              disabled={submittingNote || !noteAuthor.trim() || !noteContent.trim()}
              className="rounded border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-cyan-700 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-cyan-400"
            >
              {submittingNote ? 'Submitting...' : 'Submit Note'}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <button
          onClick={() => router.push('/incidents')}
          className="text-sm font-mono text-cyan-700 transition-colors hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          &larr; Back to Incidents
        </button>
      </div>
    </div>
  );
}