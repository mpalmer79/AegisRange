'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import AlertHeader from './components/AlertHeader';
import ContributingEventsSection from './components/ContributingEventsSection';
import DetectionPayloadPanel from './components/DetectionPayloadPanel';
import ExplainabilityPanel from './components/ExplainabilityPanel';
import IncidentLinkagePanel from './components/IncidentLinkagePanel';
import RelatedResponsesPanel from './components/RelatedResponsesPanel';
import { useAlertDetail } from './components/useAlertDetail';
import { formatTimestamp } from './components/utils';

export default function AlertDetailPage() {
  const params = useParams();
  const alertId = typeof params?.id === 'string' ? params.id : null;

  const { alert, incident, events, responses, loading, error } = useAlertDetail(alertId);

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

      <AlertHeader alert={alert} />

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <ExplainabilityPanel items={whyThisTriggered} />
        <IncidentLinkagePanel incident={incident} />
      </section>

      <ContributingEventsSection events={events} />

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <RelatedResponsesPanel responses={responses} />
        <DetectionPayloadPanel alert={alert} />
      </section>
    </div>
  );
}
