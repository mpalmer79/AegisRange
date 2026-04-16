'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useIncidentDetail } from './components/useIncidentDetail';
import IncidentHeader from './components/IncidentHeader';
import IncidentSummaryCards from './components/IncidentSummaryCards';
import RiskAssessment from './components/RiskAssessment';
import AffectedResources from './components/AffectedResources';
import IncidentTimeline from './components/IncidentTimeline';
import RelatedAlerts from './components/RelatedAlerts';
import EvidenceEvents from './components/EvidenceEvents';
import IncidentResponses from './components/IncidentResponses';
import AnalystNotes from './components/AnalystNotes';

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const correlationId =
    typeof params?.correlationId === 'string' ? params.correlationId : null;

  const {
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
  } = useIncidentDetail(correlationId);

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

      <IncidentHeader
        incident={incident}
        validTransitions={validTransitions}
        updating={updating}
        onStatusChange={handleStatusChange}
      />

      <IncidentSummaryCards
        alertsCount={alerts.length}
        eventsCount={events.length}
        responsesCount={responses.length}
        notesCount={notes.length}
      />

      <RiskAssessment incident={incident} riskProfile={riskProfile} />

      <AffectedResources affectedResources={incident.affected_resources} />

      <IncidentTimeline timelineRows={timelineRows} />

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <RelatedAlerts alerts={alerts} />
        <EvidenceEvents events={events} />
        <IncidentResponses responses={responses} />
      </section>

      <AnalystNotes
        notes={notes}
        notesLoading={notesLoading}
        noteAuthor={noteAuthor}
        noteContent={noteContent}
        submittingNote={submittingNote}
        onNoteAuthorChange={setNoteAuthor}
        onNoteContentChange={setNoteContent}
        onSubmitNote={handleSubmitNote}
      />

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
