'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, canRunScenarios } from '@/lib/auth-context';
import ScenarioCard from '@/components/scenario-card';

const SCENARIO_CARDS = [
  {
    id: 'scn-auth-001',
    code: 'SCN-AUTH-001',
    title: 'Brute Force Authentication',
    description:
      'Simulates a brute-force login attack with multiple failed authentication attempts followed by a successful login from a suspicious IP.',
    imageUrl: '/images/brute-force.png',
  },
  {
    id: 'scn-session-002',
    code: 'SCN-SESSION-002',
    title: 'Session Hijacking',
    description:
      'Simulates session token theft and reuse from a different IP address, triggering session anomaly detection.',
    imageUrl: '/images/session-hijacking.png',
  },
  {
    id: 'scn-doc-003',
    code: 'SCN-DOC-003',
    title: 'Unauthorized Document Access',
    description:
      'Simulates an unauthorized user attempting to access restricted documents, triggering access control alerts.',
    imageUrl: '/images/unauthorized-document-access.png',
  },
  {
    id: 'scn-doc-004',
    code: 'SCN-DOC-004',
    title: 'Bulk Document Exfiltration',
    description:
      'Simulates rapid downloading of multiple sensitive documents, indicating potential data exfiltration.',
    imageUrl: '/images/bulk-document-exfiltration.png',
  },
  {
    id: 'scn-svc-005',
    code: 'SCN-SVC-005',
    title: 'Service Account Abuse',
    description:
      'Simulates misuse of a service account for unauthorized operations outside its normal scope.',
    imageUrl: '/images/service-account-abuse.png',
  },
  {
    id: 'scn-corr-006',
    code: 'SCN-CORR-006',
    title: 'Correlated Multi-Stage Attack',
    description:
      'Simulates a sophisticated multi-stage attack combining authentication, session, and document access vectors.',
    imageUrl: '/images/correlated-attack.png',
  },
] as const;

interface ScenarioGridProps {
  runningScenario: string | null;
  onRunScenario: (scenarioId: string) => void;
}

export default function ScenarioGrid({
  runningScenario,
  onRunScenario,
}: ScenarioGridProps) {
  const router = useRouter();
  const { isAuthenticated, role } = useAuth();
  const hasAccess = isAuthenticated && canRunScenarios(role);

  const disabledReason = !isAuthenticated
    ? 'Sign in to run scenarios'
    : !hasAccess
      ? 'Insufficient permissions'
      : undefined;

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
            Quick Scenarios
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
            Launch a scenario to generate telemetry and trigger detections.
          </p>
        </div>
        <Link
          href="/scenarios"
          className="text-xs font-mono text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors"
        >
          VIEW ALL &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ar-stagger">
        {SCENARIO_CARDS.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            title={scenario.title}
            code={scenario.code}
            description={scenario.description}
            imageUrl={scenario.imageUrl}
            isRunning={runningScenario === scenario.id}
            disabled={runningScenario !== null || !hasAccess}
            disabledReason={disabledReason}
            onOpenBriefing={() => router.push(`/scenarios/${scenario.id}`)}
            onRun={() => onRunScenario(scenario.id)}
          />
        ))}
      </div>
    </div>
  );
}
