// Redaction for anything that leaves the process as an error report.
//
// This module is isomorphic on purpose (no "server-only"): the same rules must
// apply to client-reported errors as to server ones, and a second, subtly
// different copy of these rules is exactly how a leak gets introduced.
//
// The threat this exists for is concrete. Next.js hands onRequestError the
// FULL request headers — including `cookie`, which on this site carries the
// Supabase session JWT for a signed-in owner or agency user. The framework's
// own documentation example serializes `request` wholesale into a POST body.
// Doing that here would ship session tokens capable of full account takeover
// to a third-party service.

// Allowlist, never a denylist. A denylist silently leaks whatever it forgets;
// an allowlist fails closed when a new header appears.
//
// `x-forwarded-for` is deliberately absent: the privacy policy states that
// visitor IP addresses are not stored in our records, and an error report is
// still a record. Keeping it here would make that statement false.
const ALLOWED_HEADERS = new Set(["user-agent", "content-type"]);

// Hosts whose URLs are safe to keep in a message or stack trace. Everything
// else is redacted, which is what keeps merchant affiliate destinations out of
// error reports: /go/[slug] holds a real destination URL in memory, and a
// malformed one makes NextResponse.redirect throw with that URL in the message.
function safeHosts(): string[] {
  const hosts: string[] = [];
  for (const raw of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!raw) continue;
    try {
      hosts.push(new URL(raw).host);
    } catch {
      // Ignore an unparseable value rather than failing the error report.
    }
  }
  return hosts;
}

const REDACTIONS: { pattern: RegExp; replace: string }[] = [
  // Supabase/GoTrue session tokens and any other JWT.
  { pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+/g, replace: "[redacted-jwt]" },
  // Newer Supabase key formats.
  { pattern: /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, replace: "[redacted-key]" },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, replace: "Bearer [redacted]" },
  // key=value / key: value shapes for anything credential-like.
  {
    pattern: /\b(apikey|api_key|access_token|refresh_token|id_token|client_secret|secret|password|passwd|pwd|authorization)\b(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;&)]+)/gi,
    replace: "$1$2[redacted]",
  },
  // Anything that looks like a session cookie pair.
  { pattern: /\bsb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?=[^\s;]+/gi, replace: "sb-auth-token=[redacted]" },
];

/** Redacts credentials and off-site URLs from free text (messages, stacks). */
export function scrubText(input: string | undefined | null): string {
  if (!input) return "";
  let out = String(input);
  for (const { pattern, replace } of REDACTIONS) out = out.replace(pattern, replace);

  const allowed = safeHosts();
  out = out.replace(/https?:\/\/[^\s"'`)<>\]]+/gi, (match) => {
    try {
      const host = new URL(match).host;
      if (allowed.includes(host)) {
        // Keep our own/infra URLs — they're diagnostic and non-secret — but
        // drop the query string, which can carry search terms or campaign tags.
        const url = new URL(match);
        return `${url.origin}${url.pathname}`;
      }
    } catch {
      // Not parseable as a URL; fall through and redact.
    }
    return "[redacted-external-url]";
  });

  return out;
}

/** Drops the query string; keeps the path for route identification. */
export function scrubPath(path: string | undefined | null): string {
  if (!path) return "";
  const withoutQuery = String(path).split(/[?#]/)[0] ?? "";
  return scrubText(withoutQuery);
}

/**
 * Reduces arbitrary request headers to the allowlisted, non-sensitive ones.
 * Values are typed as possibly-undefined to match Next.js's own header dict.
 */
export function scrubHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (!ALLOWED_HEADERS.has(key)) continue;
    const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
    if (typeof value === "string") out[key] = scrubText(value).slice(0, 512);
  }
  return out;
}

export type ScrubbedError = {
  name: string;
  message: string;
  stack: string | null;
  digest: string | null;
};

/**
 * Normalizes an unknown thrown value into a reportable, redacted shape.
 * `digest` is the id Next.js also shows the user, which is what makes a report
 * matchable to a specific user-visible incident.
 */
export function scrubError(err: unknown): ScrubbedError {
  const isError = err instanceof Error;
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest ?? "") || null
      : null;

  return {
    name: isError ? err.name : typeof err,
    message: scrubText(isError ? err.message : String(err)).slice(0, 2000),
    stack: isError && err.stack ? scrubText(err.stack).slice(0, 8000) : null,
    digest: digest ? scrubText(digest) : null,
  };
}
