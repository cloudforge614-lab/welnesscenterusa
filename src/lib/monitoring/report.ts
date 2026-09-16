import { appEnvironment, appRelease, monitoringDsn } from "@/lib/env";
import { scrubError, scrubHeaders, scrubPath, scrubText, type ScrubbedError } from "./scrub";

// The single place an error becomes a report. Everything — server render,
// Server Action, Route Handler, proxy, client boundary, unhandled rejection —
// funnels through report() so there is exactly one code path to audit for
// leaks, and exactly one place to attach a provider.
//
// WHY THERE IS NO VENDOR SDK HERE YET
// No monitoring account or DSN exists for this project, and there is no
// deployment. Installing a provider SDK now would mean committing credentialed
// build configuration (source-map upload tokens, a next.config wrapper around
// the Step 7.2 security headers) that cannot be verified end to end, plus a
// client bundle this site currently does without. So capture, normalisation
// and redaction — the parts that are application-specific and genuinely need
// care — are implemented here, and delivery is a single seam. Pointing this at
// Sentry (or any provider) is a change to deliver() and nothing else.

export type MonitoringEvent = {
  kind: "server" | "client";
  timestamp: string;
  environment: string;
  release: string;
  error: ScrubbedError;
  // Route identification, never the raw URL: path only, query stripped.
  route?: {
    path?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
    method?: string;
  };
  headers?: Record<string, string>;
  tags?: Record<string, string>;
};

/**
 * The delivery seam. Structured single-line JSON on stderr is the baseline,
 * because every host (Vercel, Fly, Railway, a plain container) collects stdout
 * and stderr, and alerting can be built on it without this app knowing how.
 *
 * To add a provider: forward `event` from here. Do not widen what the event
 * contains — it has already been redacted, and that is the point.
 */
async function deliver(event: MonitoringEvent): Promise<void> {
  // Always emit locally. In development this is the whole mechanism, which is
  // also why development never floods a remote service: without a DSN there is
  // nothing to flood. Capture itself is never disabled by environment.
  console.error(`[monitoring] ${JSON.stringify(event)}`);

  // Server-side forwarding only. monitoringDsn is server-only and reads as
  // null in any client bundle, so this branch cannot run in the browser.
  if (!monitoringDsn || typeof window !== "undefined") return;

  try {
    await fetch(monitoringDsn, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      // An error report must never hold a response open or become the reason
      // a request fails.
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
  } catch {
    // Swallowed deliberately: a monitoring outage must not turn one failure
    // into two, and re-throwing here would surface inside Next's own error
    // handling path.
  }
}

function baseEvent(kind: MonitoringEvent["kind"], err: unknown): MonitoringEvent {
  return {
    kind,
    timestamp: new Date().toISOString(),
    environment: appEnvironment,
    release: appRelease,
    error: scrubError(err),
  };
}

// Mirrors the shape Next.js passes to onRequestError; header values are
// possibly-undefined there, so they are here too.
type RequestInfo = { path?: string; method?: string; headers?: Record<string, string | string[] | undefined> };
type ContextInfo = { routePath?: string; routeType?: string; renderSource?: string };

/**
 * Reports a server-side error. Called from instrumentation.ts's onRequestError,
 * which covers Server Components, Server Actions, Route Handlers (including
 * /go/[slug]) and the proxy.
 *
 * Note what is NOT taken from `request`: the raw path with its query string,
 * and every header outside the allowlist — `cookie` above all, which carries
 * the Supabase session JWT for signed-in owner and agency users.
 */
export async function reportServerError(err: unknown, request?: RequestInfo, context?: ContextInfo): Promise<void> {
  try {
    const event = baseEvent("server", err);
    event.route = {
      path: scrubPath(request?.path),
      routePath: context?.routePath ? scrubText(context.routePath) : undefined,
      routeType: context?.routeType,
      renderSource: context?.renderSource,
      method: request?.method,
    };
    event.headers = scrubHeaders(request?.headers);
    await deliver(event);
  } catch {
    // Reporting must never throw into Next.js's error handling.
  }
}

/**
 * Reports a client-side error: an error boundary that caught a render failure,
 * an uncaught window error, or an unhandled promise rejection.
 *
 * Deliberately collects no cookies, no storage, no form values and no user
 * identity — only the redacted error, the route pattern, and which boundary
 * caught it.
 */
export function reportClientError(err: unknown, tags?: Record<string, string>): void {
  try {
    const event = baseEvent("client", err);
    if (tags) event.tags = tags;
    if (typeof window !== "undefined") {
      event.route = { path: scrubPath(window.location.pathname) };
    }
    void deliver(event);
  } catch {
    // Never let the reporter break the page it is reporting on.
  }
}
