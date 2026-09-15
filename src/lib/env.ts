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
