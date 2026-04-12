import { useEffect, useState } from 'react';
import { getAlerts, getEvents, getIncident, getResponses } from '@/lib/api';
import type { Alert, Event, Incident, IncidentResponse } from '@/lib/types';

interface AlertDetailState {
  alert: Alert | null;
  incident: Incident | null;
  events: Event[];
  responses: IncidentResponse[];
  loading: boolean;
  error: string | null;
}

export function useAlertDetail(alertId: string | null): AlertDetailState {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [responses, setResponses] = useState<IncidentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return { alert, incident, events, responses, loading, error };
}
