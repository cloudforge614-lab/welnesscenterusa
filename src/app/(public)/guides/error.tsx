"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring/report";

export default function GuidesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, { boundary: "guides" });
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-2xl text-ink">We couldn&apos;t load guides</h1>
      <p className="mt-2 text-sm text-ink-muted">Something went wrong on our end. Please try again.</p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-subtle">Reference: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-brand-800"
      >
        Try again
      </button>
    </div>
  );
}
