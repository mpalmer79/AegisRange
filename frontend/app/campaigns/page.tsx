'use client';

import { useEffect, useState } from 'react';
import { getCampaigns } from '@/lib/api';
import { Campaign } from '@/lib/types';
import Link from 'next/link';

const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  credential_campaign: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  exfiltration_campaign: 'text-red-400 bg-red-500/20 border-red-500/30',
  session_campaign: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  multi_vector_campaign: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
};

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  credential_campaign: 'Credential Campaign',
  exfiltration_campaign: 'Exfiltration Campaign',
  session_campaign: 'Session Campaign',
  multi_vector_campaign: 'Multi-Vector Campaign',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/20 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  low: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  informational: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getCampaigns();
        setCampaigns(data);
      } catch {
        setError('Failed to fetch campaign data. Is the backend running?');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cross-incident correlation and coordinated campaign detection
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold font-mono text-cyan-400">{campaigns.length}</div>
          <div className="text-xs text-gray-500">Campaigns Detected</div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-cyan-400 font-mono text-sm animate-pulse">Analyzing incident correlations...</div>
        </div>
      )}

      {!loading && campaigns.length === 0 && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-500 font-mono text-sm">No campaigns detected. Run multiple scenarios to generate cross-incident correlations.</p>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.campaign_id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              {/* Campaign Header */}
              <div className="px-5 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-100">{campaign.campaign_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-mono uppercase border rounded ${SEVERITY_COLORS[campaign.severity] || 'text-gray-400'}`}>
                      {campaign.severity}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-mono uppercase border rounded ${CAMPAIGN_TYPE_COLORS[campaign.campaign_type] || 'text-gray-400'}`}>
                      {CAMPAIGN_TYPE_LABELS[campaign.campaign_type] || campaign.campaign_type}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400">{campaign.summary}</p>
              </div>

              {/* Campaign Details */}
              <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Linked Incidents */}
                <div>
                  <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Linked Incidents</div>
                  <div className="space-y-1">
                    {campaign.incident_correlation_ids.map((cid) => (
                      <Link
                        key={cid}
                        href={`/incidents/${cid}`}
                        className="block font-mono text-xs text-cyan-400 hover:underline truncate"
                      >
                        {cid.slice(0, 20)}...
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Shared Actors */}
                <div>
                  <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Shared Actors</div>
                  <div className="flex flex-wrap gap-1">
                    {campaign.shared_actors.map((actor) => (
                      <span key={actor} className="px-2 py-0.5 text-xs font-mono bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
                        {actor}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Shared TTPs */}
                <div>
                  <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Shared TTPs</div>
                  <div className="flex flex-wrap gap-1">
                    {campaign.shared_ttps.map((ttp) => (
                      <span key={ttp} className="px-2 py-0.5 text-xs font-mono bg-purple-500/10 border border-purple-500/30 rounded text-purple-400">
                        {ttp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Timeline</div>
                  <div className="text-xs font-mono text-gray-400">
                    <div>First: {formatTimestamp(campaign.first_seen)}</div>
                    <div>Last: {formatTimestamp(campaign.last_seen)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
