'use client';

import { useEffect, useState, useCallback } from 'react';
import { getEvents } from '@/lib/api';
import { Event } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  auth: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  authentication: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  document: 'text-green-400 bg-green-500/10 border-green-500/20',
  session: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  detection: 'text-red-400 bg-red-500/10 border-red-500/20',
  response: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

function getCategoryStyle(category: string): string {
  const lower = category?.toLowerCase() ?? '';
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
}

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  failure: 'text-red-400',
  failed: 'text-red-400',
  blocked: 'text-red-400',
  denied: 'text-red-400',
  detected: 'text-amber-400',
  executed: 'text-orange-400',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status?.toLowerCase()] ?? 'text-gray-400';
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterActorId, setFilterActorId] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterCorrelationId, setFilterCorrelationId] = useState('');

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (filterActorId.trim()) params.actor_id = filterActorId.trim();
      if (filterEventType.trim()) params.event_type = filterEventType.trim();
      if (filterCorrelationId.trim()) params.correlation_id = filterCorrelationId.trim();
      const data = await getEvents(params);
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filterActorId, filterEventType, filterCorrelationId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            Security event log ({events.length} events)
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="px-3 py-1.5 text-xs font-mono bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Filter by actor_id"
          value={filterActorId}
          onChange={(e) => setFilterActorId(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/50 w-48"
        />
        <input
          type="text"
          placeholder="Filter by event_type"
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/50 w-48"
        />
        <input
          type="text"
          placeholder="Filter by correlation_id"
          value={filterCorrelationId}
          onChange={(e) => setFilterCorrelationId(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/50 w-64"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-400 font-mono text-sm animate-pulse">Loading events...</div>
        </div>
      )}

      {/* Table */}
      {!loading && events.length === 0 && !error && (
        <div className="text-center py-20 text-gray-500 font-mono text-sm">
          No events found. Run a scenario to generate events.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-500 text-xs font-mono uppercase tracking-wider">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Event Type</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Source IP</th>
                <th className="text-left px-4 py-3">Correlation ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <tr
                  key={event.event_id || i}
                  className="border-t border-gray-800/50 hover:bg-gray-900/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${getCategoryStyle(
                        event.category
                      )}`}
                    >
                      {event.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    {event.actor_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {event.source_ip ?? '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-500/70 max-w-[200px] truncate">
                    {event.correlation_id ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
