"use client";

import { useEffect } from "react";
import { buttonStyles, Card } from "@/components/admin/ui";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="font-display text-2xl text-ink">We couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The database didn&apos;t respond as expected. Your data is safe — try again in a moment.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-subtle">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-6`}>
        Try again
      </button>
    </Card>
  );
}
