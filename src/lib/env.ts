function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

// Referenced as literal process.env.X so Next.js can inline them.
export const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Absolute origin for canonical/OG URLs and the sitemap. Not a secret — same
// category as the URL above. Falls back to localhost so dev never breaks.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// Optional. Genuinely unset until a real inbox exists — the contact page
// must not fabricate an email address, so this has no fallback. Leave
// NEXT_PUBLIC_CONTACT_EMAIL unset in every environment until one is real.
export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

// ── Monitoring (Phase 7.4) ──────────────────────────────────────────────────
// All three are optional: error capture works without any of them, and
// nothing here is required for the app to boot.

// Which deployment an error came from, so production incidents are not mixed
// in with preview or local noise. Public because client-side reports need it
// too. Falls back to NODE_ENV, which already distinguishes dev from built.
export const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";

// Release identifier, so an error can be tied to the exact deployed build.
// Set this to the commit SHA at build time once a deployment pipeline exists
// (Step 7.12); "unversioned" is the honest value until then.
export const appRelease = process.env.NEXT_PUBLIC_APP_VERSION || "unversioned";

// SERVER-ONLY. Deliberately not NEXT_PUBLIC_: this is the ingest endpoint for
// an error-monitoring provider and must never reach the browser bundle.
// Next.js replaces any non-NEXT_PUBLIC_ reference in client code with
// undefined, so this reads as null on the client even if it were imported
// there. When unset, errors are still captured and logged locally — they are
// simply not forwarded anywhere.
export const monitoringDsn = process.env.MONITORING_DSN || null;
