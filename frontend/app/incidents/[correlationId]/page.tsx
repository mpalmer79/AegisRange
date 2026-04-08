'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getIncident, updateIncidentStatus } from '@/lib/api';
import { Incident, IncidentStatus, INCIDENT_STATUS_TRANSITIONS } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/20 text-red-400 border-red-500/30',
  investigating: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  contained: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const TIMELINE_ENTRY_STYLES: Record<string, { color: string; icon: string }> = {
  event: { color: 'border-cyan-500 bg-cyan-500', icon: 'E' },
  alert: { color: 'border-amber-500 bg-amber-500', icon: 'A' },
  detection: { color: 'border-red-500 bg-red-500', icon: 'D' },
  response: { color: 'border-orange-500 bg-orange-500', icon: 'R' },
  incident: { color: 'border-purple-500 bg-purple-500', icon: 'I' },
  status_change: { color: 'border-green-500 bg-green-500', icon: 'S' },
};

function getTimelineStyle(entryType: string) {
  const lower = entryType?.toLowerCase() ?? '';
  for (const [key, val] of Object.entries(TIMELINE_ENTRY_STYLES)) {
    if (lower.includes(key)) return val;
  }
  return { color: 'border-gray-500 bg-gray-500', icon: '?' };
}

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const correlationId = params.correlationId as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchIncident = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getIncident(correlationId);
      setIncident(data);
    } catch {
      setError('Failed to fetch incident details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (correlationId) {
      fetchIncident();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correlationId]);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!incident) return;
    try {
      setUpdating(true);
      const updated = await updateIncidentStatus(correlationId, newStatus);
      setIncident(updated);
    } catch {
      setError('Failed to update incident status');
    } finally {
      setUpdating(false);
    }
  };

  const validTransitions = incident
    ? INCIDENT_STATUS_TRANSITIONS[incident.status as IncidentStatus] ?? []
    : [];

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-cyan-400 font-mono text-sm animate-pulse">Loading incident...</div>
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div>
        <Link href="/incidents" className="text-cyan-400 hover:text-cyan-300 text-sm font-mono mb-4 inline-block">
          &larr; Back to Incidents
        </Link>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!incident) return null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/incidents" className="text-cyan-400 hover:text-cyan-300 text-sm font-mono">
          Incidents
        </Link>
        <span className="text-gray-600 font-mono text-sm">/</span>
        <span className="text-gray-400 text-sm font-mono truncate">
          {incident.incident_id || correlationId}
        </span>
      </div>

      {/* Error toast */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-100 font-mono mb-2">
              {incident.incident_id || 'Incident'}
            </h1>
            {incident.title && (
              <p className="text-sm text-gray-300">{incident.title}</p>
            )}
            {incident.summary && (
              <p className="text-sm text-gray-500 mt-1">{incident.summary}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span
              className={`px-3 py-1 rounded text-xs font-mono uppercase border font-medium ${
                STATUS_STYLES[incident.status] ?? STATUS_STYLES.open
              }`}
            >
              {incident.status}
            </span>

            {/* Severity badge */}
            <span
              className={`px-3 py-1 rounded text-xs font-mono uppercase border font-medium ${
                SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.low
              }`}
            >
              {incident.severity}
            </span>
          </div>
        </div>

        {/* Status transition buttons */}
        {validTransitions.length > 0 && (
          <div className="flex items-center gap-2 pt-4 border-t border-gray-800">
            <span className="text-xs text-gray-500 font-mono mr-2">TRANSITION TO:</span>
            {validTransitions.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={updating}
                className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all disabled:opacity-50 ${
                  STATUS_STYLES[status] ?? 'bg-gray-700 text-gray-300 border-gray-600'
                } hover:brightness-125`}
              >
                {updating ? '...' : status}
              </button>
            ))}
          </div>
        )}

        {/* Key metrics row */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4 pt-4 border-t border-gray-800 text-sm">
          {incident.primary_actor && (
            <div>
              <span className="text-gray-600 text-xs font-mono block">PRIMARY ACTOR</span>
              <span className="text-gray-200 font-mono">{incident.primary_actor}</span>
            </div>
          )}
          <div>
            <span className="text-gray-600 text-xs font-mono block">CONFIDENCE</span>
            <span className="text-gray-200 font-mono">
              {typeof incident.confidence === 'number'
                ? `${(incident.confidence * 100).toFixed(0)}%`
                : incident.confidence ?? '-'}
            </span>
          </div>
          {incident.risk_score != null && (
            <div>
              <span className="text-gray-600 text-xs font-mono block">RISK SCORE</span>
              <span className="text-red-400 font-mono font-bold">{incident.risk_score}</span>
            </div>
          )}
          <div>
            <span className="text-gray-600 text-xs font-mono block">CORRELATION ID</span>
            <span className="text-cyan-400 font-mono text-xs break-all">{incident.correlation_id}</span>
          </div>
        </div>
      </div>

      {/* Detections & Responses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Detections */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-mono font-semibold text-amber-400 mb-3 uppercase tracking-wider">
            Detections ({incident.detection_ids?.length ?? 0})
          </h2>
          {incident.detection_ids && incident.detection_ids.length > 0 ? (
            <div className="space-y-2">
              {incident.detection_ids.map((id, i) => (
                <div key={id} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-mono text-gray-300 break-all">{id}</p>
                    {incident.detection_summaries?.[i] && (
                      <p className="text-xs text-gray-500 mt-0.5">{incident.detection_summaries[i]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 font-mono">None</p>
          )}
        </div>

        {/* Responses */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-mono font-semibold text-orange-400 mb-3 uppercase tracking-wider">
            Responses ({incident.response_ids?.length ?? 0})
          </h2>
          {incident.response_ids && incident.response_ids.length > 0 ? (
            <div className="space-y-2">
              {incident.response_ids.map((id, i) => (
                <div key={id} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    {i + 1}
                  </span>
                  <p className="text-xs font-mono text-gray-300 break-all">{id}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 font-mono">None</p>
          )}
        </div>
      </div>

      {/* Affected Resources */}
      {incident.affected_resources && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-mono font-semibold text-cyan-400 mb-3 uppercase tracking-wider">
            Affected Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {incident.affected_resources.documents && incident.affected_resources.documents.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">DOCUMENTS</p>
                <div className="space-y-1">
                  {incident.affected_resources.documents.map((doc) => (
                    <p key={doc} className="text-xs font-mono text-gray-300">{doc}</p>
                  ))}
                </div>
              </div>
            )}
            {incident.affected_resources.sessions && incident.affected_resources.sessions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">SESSIONS</p>
                <div className="space-y-1">
                  {incident.affected_resources.sessions.map((s) => (
                    <p key={s} className="text-xs font-mono text-gray-300">{s}</p>
                  ))}
                </div>
              </div>
            )}
            {incident.affected_resources.services && incident.affected_resources.services.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">SERVICES</p>
                <div className="space-y-1">
                  {incident.affected_resources.services.map((s) => (
                    <p key={s} className="text-xs font-mono text-gray-300">{s}</p>
                  ))}
                </div>
              </div>
            )}
            {incident.affected_resources.actors && incident.affected_resources.actors.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">ACTORS</p>
                <div className="space-y-1">
                  {incident.affected_resources.actors.map((a) => (
                    <p key={a} className="text-xs font-mono text-gray-300">{a}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {incident.timeline && incident.timeline.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-mono font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Timeline ({incident.timeline.length} entries)
          </h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-800" />

            <div className="space-y-4">
              {incident.timeline.map((entry, i) => {
                const style = getTimelineStyle(entry.entry_type);
                return (
                  <div key={entry.entry_id || i} className="flex gap-4 relative">
                    {/* Dot */}
                    <div
                      className={`w-6 h-6 rounded-full ${style.color} flex items-center justify-center shrink-0 text-white text-[10px] font-bold z-10`}
                    >
                      {style.icon}
                    </div>

                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500 uppercase">
                          {entry.entry_type}
                        </span>
                        <span className="text-xs font-mono text-gray-600">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{entry.summary}</p>
                      {entry.entry_id && (
                        <p className="text-xs font-mono text-gray-600 mt-0.5 break-all">
                          {entry.entry_id}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="mt-6">
        <button
          onClick={() => router.push('/incidents')}
          className="text-cyan-400 hover:text-cyan-300 text-sm font-mono transition-colors"
        >
          &larr; Back to Incidents
        </button>
      </div>
    </div>
  );
}
