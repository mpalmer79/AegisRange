import Link from 'next/link';

interface PageBreadcrumbProps {
  scenarioId: string;
}

export default function PageBreadcrumb({ scenarioId }: PageBreadcrumbProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap mb-8 ar-fade-in">
      <Link
        href="/"
        aria-label="Return to home dashboard"
        className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-cyan-300 dark:border-cyan-500/40 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 text-cyan-700 dark:text-cyan-300 font-bold text-sm tracking-wide uppercase shadow-sm hover:shadow-lg hover:shadow-cyan-400/30 dark:hover:shadow-cyan-500/20 transition-all"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12l9-9 9 9" />
          <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
        Home
      </Link>
      <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 dark:text-gray-500 flex items-center gap-2">
        <Link href="/" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/scenarios" className="hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Scenarios</Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-gray-300">{scenarioId.toUpperCase()}</span>
      </nav>
    </div>
  );
}
