import type { Incident } from '@/lib/types';

interface AffectedResourcesProps {
  affectedResources: Incident['affected_resources'];
}

export default function AffectedResources({ affectedResources }: AffectedResourcesProps) {
  if (!affectedResources) return null;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
        Affected Resources
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {affectedResources.documents?.length ? (
          <div>
            <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
              DOCUMENTS
            </p>
            <div className="space-y-1">
              {affectedResources.documents.map((doc) => (
                <p key={doc} className="text-xs font-mono text-slate-700 dark:text-gray-300">
                  {doc}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {affectedResources.sessions?.length ? (
          <div>
            <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
              SESSIONS
            </p>
            <div className="space-y-1">
              {affectedResources.sessions.map((session) => (
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

        {affectedResources.services?.length ? (
          <div>
            <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
              SERVICES
            </p>
            <div className="space-y-1">
              {affectedResources.services.map((service) => (
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

        {affectedResources.actors?.length ? (
          <div>
            <p className="mb-1 text-xs font-mono text-slate-500 dark:text-gray-500">
              ACTORS
            </p>
            <div className="space-y-1">
              {affectedResources.actors.map((actor) => (
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
  );
}
