export default function ArchitecturePage() {
  const pipelineSteps = [
    {
      title: 'Event',
      description:
        'A normalized record of system activity such as a login, document access, policy check, or service interaction.',
    },
    {
      title: 'Alert',
      description:
        'A deterministic detection outcome generated from one or more events when a rule threshold or correlation condition is met.',
    },
    {
      title: 'Response',
      description:
        'A bounded defensive action tied to the alert, such as step-up auth, session revocation, access restriction, or containment.',
    },
    {
      title: 'Incident',
      description:
        'A durable investigative record that groups detections, responses, timeline entries, and analyst context into one audit trail.',
    },
  ];

  const principles = [
    {
      title: 'Deterministic detection',
      description:
        'Core detections are rule-based and explainable. The system favors explicit logic over opaque scoring.',
    },
    {
      title: 'Audit-first design',
      description:
        'Events, alerts, responses, and incident mutations are treated as reconstructable records, not temporary UI state.',
    },
    {
      title: 'Controlled response',
      description:
        'Response actions are intentionally bounded so the platform validates defensive behavior without hidden side effects.',
    },
    {
      title: 'Clear domain boundaries',
      description:
        'Detection, response, telemetry, and incident handling are separated into explicit service responsibilities.',
    },
  ];

  const guarantees = [
    'Deterministic event processing within the current single-worker deployment model',
    'Durable persistence of core entities such as events, alerts, responses, and incidents',
    'Auditable incident timelines that can be inspected after processing',
    'Role-protected platform access through JWT-based authentication',
  ];

  const constraints = [
    'Backend must run as a single worker because operational coordination is process-local',
    'SQLite is the current durable store and is not intended as a horizontally scaled database tier',
    'The system does not currently provide multi-instance coordination or distributed locking',
    'The platform does not yet provide replayable event sourcing or exactly-once delivery guarantees',
  ];

  const services = [
    'Telemetry Service',
    'Detection Service',
    'Response Service',
    'Incident Service',
    'Pipeline Service',
    'Risk Service',
    'Report Service',
    'Auth Service',
  ];

  return (
    <div className="text-slate-800 dark:text-gray-100">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-cyan-50 to-sky-100 px-6 py-8 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-cyan-950/30 dark:to-gray-900">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10"
        />

        <div className="relative">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            System Design
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Architecture
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-gray-400 sm:text-base">
            AegisRange is a defensive security simulation and validation platform
            focused on explainable detection, response, and incident modeling.
            This page surfaces the system flow, current guarantees, and the real
            runtime constraints behind the product.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Product focus
          </p>
          <h2 className="mt-2 text-lg font-semibold">What this system is</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
            AegisRange models how a modern security workflow should ingest
            telemetry, evaluate deterministic detections, execute bounded
            defensive actions, and assemble an auditable incident record.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Runtime shape
          </p>
          <h2 className="mt-2 text-lg font-semibold">Current deployment</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
            Next.js frontend, FastAPI backend, single-worker execution,
            in-memory operational coordination, and SQLite-backed durability.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Design priority
          </p>
          <h2 className="mt-2 text-lg font-semibold">Why it matters</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
            The goal is not just detection volume. The goal is explainability,
            auditability, and a security workflow that can be reconstructed and
            trusted.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
              Primary flow
            </p>
            <h2 className="text-2xl font-bold">Event to incident pipeline</h2>
          </div>
          <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-mono text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">
            deterministic and reconstructable
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {pipelineSteps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                  {index + 1}
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-gray-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
            Processing summary
          </p>
          <p className="mt-2 text-sm text-slate-700 dark:text-gray-300">
            simulate activity
            <span className="mx-2 text-cyan-600 dark:text-cyan-400">→</span>
            capture telemetry
            <span className="mx-2 text-cyan-600 dark:text-cyan-400">→</span>
            detect
            <span className="mx-2 text-cyan-600 dark:text-cyan-400">→</span>
            respond
            <span className="mx-2 text-cyan-600 dark:text-cyan-400">→</span>
            investigate
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Design principles
          </p>
          <h2 className="mt-2 text-2xl font-bold">Why the system is structured this way</h2>

          <div className="mt-5 space-y-4">
            {principles.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
            Service boundaries
          </p>
          <h2 className="mt-2 text-2xl font-bold">Core backend responsibilities</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <div
                key={service}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
              >
                {service}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <p className="text-sm leading-6 text-indigo-900 dark:text-indigo-200">
              The platform is intentionally built as a modular monolith. That
              keeps debugging and end-to-end validation tractable while the
              product proves its behavior before introducing distributed
              complexity.
            </p>
          </div>