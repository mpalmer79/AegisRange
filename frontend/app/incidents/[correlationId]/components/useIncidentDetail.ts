import { useEffect, useMemo, useState } from 'react';
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
import type { TimelineRow } from './utils';

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

export function useIncidentDetail(correlationId: string | null) {
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

  return {
    incident,
    alerts,
    events,
    responses,
    notes,
    riskProfile,
    loading,
    notesLoading,
    updating,
    submittingNote,
    error,
    noteAuthor,
    noteContent,
    validTransitions,
    timelineRows,
    setNoteAuthor,
    setNoteContent,
    handleStatusChange,
    handleSubmitNote,
  };
}
