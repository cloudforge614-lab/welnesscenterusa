import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["user_role"];
const AGENCY_ROLES: Role[] = ["agency_admin", "seo_editor", "content_editor"];

export type AgencySession =
  | { state: "signed-out" }
  | { state: "no-access"; email: string | null; role: Role | null }
  | { state: "agency"; userId: string; email: string | null; role: Extract<Role, "agency_admin" | "seo_editor" | "content_editor"> };

// Mirrors getAdminSession() in lib/auth/owner.ts: identity comes from
// getUser() (validated against Supabase Auth, not just the cookie), role
// comes from profiles under the caller's own RLS.
export const getAgencySession = cache(async (): Promise<AgencySession> => {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { state: "signed-out" };

  const user = userData.user;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (!profile?.role || !AGENCY_ROLES.includes(profile.role)) {
    return { state: "no-access", email: user.email ?? null, role: profile?.role ?? null };
  }
  return {
    state: "agency",
    userId: user.id,
    email: user.email ?? null,
    role: profile.role as Extract<Role, "agency_admin" | "seo_editor" | "content_editor">,
  };
});

export async function requireAgencyPage(): Promise<Extract<AgencySession, { state: "agency" | "no-access" }>> {
  const session = await getAgencySession();
  if (session.state === "signed-out") redirect("/agency/login");
  return session;
}

export class NotAgencyError extends Error {
  constructor() {
    super("Agency access required");
  }
}

// For server actions: never rely on the page having been protected.
export async function assertAgency() {
  const session = await getAgencySession();
  if (session.state !== "agency") throw new NotAgencyError();
  return { session, supabase: await createClient() };
}

// Some content actions (SEO metadata) are restricted to agency_admin/seo_editor
// (not content_editor), matching the existing seo_metadata RLS write policy.
export async function assertSeoWriter() {
  const { session, supabase } = await assertAgency();
  if (session.role !== "agency_admin" && session.role !== "seo_editor") {
    throw new NotAgencyError();
  }
  return { session, supabase };
}
