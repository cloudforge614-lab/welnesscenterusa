import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["user_role"];

export type AdminSession =
  | { state: "signed-out" }
  | { state: "no-access"; email: string | null; role: Role | null }
  | { state: "owner"; userId: string; email: string | null };

// Resolves who is calling and whether they are the owner. Identity comes from
// getUser(), which validates the session with Supabase Auth rather than
// trusting the cookie; the role comes from profiles under the user's own RLS.
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { state: "signed-out" };

  const user = userData.user;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "owner") {
    return { state: "no-access", email: user.email ?? null, role: profile?.role ?? null };
  }
  return { state: "owner", userId: user.id, email: user.email ?? null };
});

export async function requireOwnerPage(): Promise<Extract<AdminSession, { state: "owner" | "no-access" }>> {
  const session = await getAdminSession();
  if (session.state === "signed-out") redirect("/admin/login");
  return session;
}

export class NotOwnerError extends Error {
  constructor() {
    super("Owner access required");
  }
}

// For server actions: never rely on the page having been protected.
export async function assertOwner() {
  const session = await getAdminSession();
  if (session.state !== "owner") throw new NotOwnerError();
  return { session, supabase: await createClient() };
}
