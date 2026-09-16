"use client";

import { useEffect } from "react";
import { buttonStyles, Card } from "@/components/admin/ui";
import { reportClientError } from "@/lib/monitoring/report";

// The Agency CMS had no boundary of its own, so a failure anywhere under
// /agency fell through to the framework default — an unstyled page with no
// digest and nothing reported. Mirrors the Owner Admin boundary, which shares
// the same UI primitives.
export default function AgencyError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { boundary: "agency" });
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="font-display text-2xl text-ink">We couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Something went wrong loading your workspace. Any content you&apos;ve already saved is safe — try again in a
        moment.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-subtle">Reference: {error.digest}</p>}
      <button type="button" onClick={() => retry()} className={`${buttonStyles.primary} mt-6`}>
        Try again
      </button>
    </Card>
  );
}
