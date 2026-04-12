import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100">404</h2>
      <p className="text-slate-600 dark:text-slate-400">This page could not be found.</p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
