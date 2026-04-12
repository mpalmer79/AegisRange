'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { getIncidents } from '@/lib/api';
import { Incident } from '@/lib/types';
import IncidentsHeader from './components/IncidentsHeader';
import IncidentsMetrics from './components/IncidentsMetrics';
import IncidentsFilters from './components/IncidentsFilters';
import IncidentCard from './components/IncidentCard';
import { getSeverityRank, getStatusRank } from './components/incidentUtils';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterActor, setFilterActor] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getIncidents();
      setIncidents(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to fetch incidents');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = useMemo(() => {
    let next = [...incidents];

    if (filterStatus !== 'all') {
      next = next.filter(
        (incident) => incident.status?.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    if (filterSeverity !== 'all') {
      next = next.filter(
        (incident) => incident.severity?.toLowerCase() === filterSeverity.toLowerCase()
      );
    }

    if (filterActor.trim()) {
      const actorQuery = filterActor.trim().toLowerCase();
      next = next.filter((incident) =>
        String(incident.primary_actor_id ?? '').toLowerCase().includes(actorQuery)
      );
    }

    next.sort((a, b) => {
      if (sortBy === 'severity') {
        return getSeverityRank(b.severity) - getSeverityRank(a.severity);
      }

      if (sortBy === 'status') {
        return getStatusRank(b.status) - getStatusRank(a.status);
      }

      if (sortBy === 'risk') {
        return Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0);
      }

      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return next;
  }, [incidents, filterStatus, filterSeverity, filterActor, sortBy]);

  const metrics = useMemo(() => {
    return {
      total: incidents.length,
      open: incidents.filter((incident) => incident.status?.toLowerCase() === 'open').length,
      investigating: incidents.filter(
        (incident) => incident.status?.toLowerCase() === 'investigating'
      ).length,
      contained: incidents.filter(
        (incident) => incident.status?.toLowerCase() === 'contained'
      ).length,
      critical: incidents.filter(
        (incident) => incident.severity?.toLowerCase() === 'critical'
      ).length,
    };
  }, [incidents]);

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <IncidentsHeader onRefresh={fetchIncidents} />

      <IncidentsMetrics metrics={metrics} />

      <IncidentsFilters
        filterStatus={filterStatus}
        filterSeverity={filterSeverity}
        filterActor={filterActor}
        sortBy={sortBy}
        onFilterStatusChange={setFilterStatus}
        onFilterSeverityChange={setFilterSeverity}
        onFilterActorChange={setFilterActor}
        onSortByChange={setSortBy}
      />

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm font-mono text-cyan-700 animate-pulse dark:text-cyan-400">
            Loading incidents...
          </div>
        </div>
      )}

      {!loading && filteredIncidents.length === 0 && !error && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-mono text-slate-500 dark:text-gray-500">
            No incidents found. Run a scenario or adjust your filters.
          </p>
        </div>
      )}

      {!loading && filteredIncidents.length > 0 && (
        <section className="mt-6 space-y-4">
          {filteredIncidents.map((incident, index) => (
            <IncidentCard
              key={incident.correlation_id || incident.incident_id || index}
              incident={incident}
              index={index}
            />
          ))}
        </section>
      )}
    </div>
  );
}
