'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6 py-24">
      <div className="max-w-md w-full text-center space-y-8">
        
        {/* Icon Container */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shadow-sm">
          <AlertTriangle className="h-10 w-10" />
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Something went wrong!
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            An unexpected error has occurred. We apologize for the inconvenience and are working to fix the issue.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 pt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        </div>

      </div>
    </main>
  );
}