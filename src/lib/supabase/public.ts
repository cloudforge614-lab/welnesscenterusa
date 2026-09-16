import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

// The public read client. Deliberately built from @supabase/supabase-js rather
// than @supabase/ssr, because it must never touch cookies.
//
// WHY THIS EXISTS
// server.ts's createClient() awaits cookies() to bind a request's session.
// Reading cookies is a request-time API, so every page that used it was forced
// into dynamic rendering — which is why the entire public site re-queried
// Supabase on every visit. Next.js also refuses to let a cached scope read
// cookies at all, so no amount of cache configuration could have fixed it
// while the public queries went through that client.
//
// SECURITY
// This runs as the anon role, always. That is strictly *narrower* than what
// the public pages had before: previously, a signed-in agency user browsing
// the public site ran those same queries under their own session, where the
// <table>_agency_select policies apply. Public output is now produced by the
// least-privileged role available, so the only rows reachable are the ones
// the public RLS policies allow — published content and the two-gate-eligible
// products — and a cached page can never contain anything a staff session
// could see but an anonymous visitor could not.
//
// No service-role key is used here or anywhere else in this application. RLS
// is not bypassed; it is the thing doing the work.
//
// Staff reads and every mutation continue to go through server.ts's
// cookie-bound client, so authenticated behaviour is unchanged.
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Nothing to persist or refresh: there is no session here by design.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
