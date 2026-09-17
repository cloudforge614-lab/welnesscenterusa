import "server-only";

import { createHash } from "node:crypto";

// Decides whether a request to /go/[slug] represents a human clicking a link.
//
// IT NEVER DECIDES WHETHER TO REDIRECT. Every request that resolves to a live
// product still gets its 302, including every request judged automated. The
// only thing this affects is whether a row is written to affiliate_clicks, so
// a misjudgement costs an uncounted click — never a broken link, and never a
// behavioural difference an abuser could probe to learn anything.
//
// WHY NOT AN IP HASH
// affiliate_clicks had an ip_hash column that was never populated. It stays
// unpopulated, and migration 0017 drops it. Filling it would have meant:
// introducing the application's first server-side secret to key the HMAC
// (Step 7.1 deliberately removed the only two secrets the project had);
// storing a persistent identifier that links one visitor's clicks together,
// which is pseudonymous personal data and directly contradicts the privacy
// policy's "there is nothing in it that links one click to another"; and doing
// it all to protect an internal metric rather than revenue, since merchants
// pay on conversions they measure themselves, not on click counts held here.
// Filtering automated traffic removes most of the same noise at no privacy
// cost at all.

// Conservative, and aimed at self-identifying automation rather than at
// guessing. Everything here announces itself: libraries, crawlers, link
// preview fetchers, monitors. This is not, and cannot be, bot *detection* —
// anything that sets a browser User-Agent passes, by design. It removes the
// honest majority of non-human traffic, which is what was actually inflating
// the numbers.
// `\bnode\b` covers the bare "node" User-Agent that Node's own fetch sends
// when a caller sets none — found by testing, because a script that simply
// omits a User-Agent still arrives with that default rather than with none at
// all. Matched as a whole word so it cannot catch a real browser string.
const AUTOMATION = /bot|crawl|spider|slurp|curl|wget|python|java|go-http|okhttp|libwww|httpclient|headless|phantom|puppeteer|playwright|selenium|scrapy|monitor|uptime|pingdom|preview|fetcher|feed|validator|lighthouse|axios|\bnode\b|node-fetch|postman|insomnia|undici|deno|bun\//i;

export type ClickDecision =
  | { record: true }
  | { record: false; reason: "head-request" | "automated-client" | "rapid-repeat" };

/**
 * A browser performing a top-level navigation always sends a User-Agent and an
 * Accept header that will take HTML. Command-line clients and libraries
 * typically send `*\/*` or nothing. Requiring both is a much steadier signal
 * than a User-Agent blacklist on its own, and it does not depend on keeping a
 * list of bot names current.
 */
function looksLikeBrowserNavigation(userAgent: string | null, accept: string | null): boolean {
  if (!userAgent || userAgent.trim() === "") return false;
  if (AUTOMATION.test(userAgent)) return false;
  return (accept ?? "").includes("text/html");
}

// ── Rapid-repeat collapsing ─────────────────────────────────────────────────
// In process memory only. Nothing here is written to the database, logged, or
// sent anywhere, and entries are dropped as soon as their window passes.
//
// The window is deliberately short. A visitor who clicks through, looks at the
// merchant, comes back and clicks again genuinely clicked twice, and that must
// keep counting as two — so this only collapses repeats inside a few seconds,
// which is a double-click or a loop, not a decision.
//
// LIMITS, STATED PLAINLY: this is per-process. On a serverless deployment each
// invocation may start cold, so it should be treated as a defence against
// accidental double-counting and casual looping, not as rate limiting. Durable
// cross-instance limiting belongs at the edge and at the Supabase API, and is
// a Step 7.12 deployment task.
const REPEAT_WINDOW_MS = 10_000;
const MAX_TRACKED = 5_000;
const recent = new Map<string, number>();

function fingerprint(slug: string, request: Request): string {
  const h = request.headers;
  // Proxy-set client address when one exists (it will in production, and does
  // not locally). Hashed immediately and never stored beyond the window.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "";
  return createHash("sha256")
    .update(`${slug}|${forwarded}|${h.get("user-agent") ?? ""}`)
    .digest("base64url")
    .slice(0, 22);
}

function isRapidRepeat(key: string, now: number): boolean {
  const seen = recent.get(key);
  if (seen !== undefined && now - seen < REPEAT_WINDOW_MS) return true;

  // Opportunistic pruning keeps this bounded without a timer.
  if (recent.size >= MAX_TRACKED) {
    for (const [k, t] of recent) {
      if (now - t >= REPEAT_WINDOW_MS) recent.delete(k);
      if (recent.size < MAX_TRACKED / 2) break;
    }
    if (recent.size >= MAX_TRACKED) recent.clear();
  }

  recent.set(key, now);
  return false;
}

/**
 * Classifies a /go request. Call only after the product has been confirmed
 * eligible — this decides whether the click counts, not whether it resolves.
 */
export function classifyClick(slug: string, request: Request, method: string): ClickDecision {
  // A HEAD is never a person clicking. Next.js serves HEAD by running the GET
  // handler, so without this every link-preview fetch and uptime check counted
  // as a click.
  if (method === "HEAD") return { record: false, reason: "head-request" };

  if (!looksLikeBrowserNavigation(request.headers.get("user-agent"), request.headers.get("accept"))) {
    return { record: false, reason: "automated-client" };
  }

  if (isRapidRepeat(fingerprint(slug, request), Date.now())) {
    return { record: false, reason: "rapid-repeat" };
  }

  return { record: true };
}

/** Test seam: clears the in-memory window so suites are order-independent. */
export function __resetClickWindow() {
  recent.clear();
}
