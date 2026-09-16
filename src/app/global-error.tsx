"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring/report";

// The last line of defence: this replaces the root layout, so it is the only
// boundary that can catch a failure in the root layout itself. Every other
// error.tsx renders *inside* that layout and cannot.
//
// Because it replaces the root layout, it must supply its own <html>/<body>,
// and it cannot rely on the stylesheet that layout imports. Styling is
// therefore inline and minimal — the same approach already taken by the
// /go/[slug] fallback page, and permitted by the Step 7.2 CSP, which allows
// inline styles. Nothing here fetches, imports a font, or depends on any
// application state that may be the thing that broke.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { boundary: "global-error" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: "#faf9f7" }}>
        <main
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            maxWidth: "32rem",
            margin: "4rem auto",
            padding: "0 1.5rem",
            color: "#1c2420",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, color: "#5b6660", margin: "0 0 1.5rem" }}>
            We hit an unexpected problem loading this page. Please try again in a moment.
          </p>
          {/* The digest is the same id recorded in the server-side report, which
              is what lets a support message be matched to an actual incident. */}
          {error.digest && (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#8a938e" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1rem",
              backgroundColor: "#2f6f4e",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
