"use client";

import { useEffect } from "react";

// Root fallback for any public route that doesn't have its own error.tsx
// (homepage, categories listing's own edge cases, etc). This is a plain
// React error boundary — unlike loading.tsx, it does not affect streaming
// or HTTP status codes for nested routes, so it's safe to place at the top
// of the group.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-2xl text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-muted">Please try again in a moment.</p>
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
