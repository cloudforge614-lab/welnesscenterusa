import { reportClientError } from "@/lib/monitoring/report";

// Runs after the document loads but before React hydrates, which is early
// enough to catch failures during hydration itself.
//
// This covers the two things a React error boundary cannot: errors that escape
// React entirely, and rejected promises with no handler. Boundary-caught render
// errors are reported by the boundaries themselves, because React catches them
// and they never reach window.onerror.
//
// Per the Next.js guidance for this file, everything is wrapped so a failure in
// instrumentation can never take the page down with it.
try {
  window.addEventListener("error", (event) => {
    reportClientError(event.error ?? event.message, { source: "window.error" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, { source: "unhandledrejection" });
  });
} catch {
  // If listener registration fails, the app still runs — it is just less
  // observable. That trade is always the right way round.
}
