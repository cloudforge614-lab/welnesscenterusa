"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; email: string };

// Only same-site agency paths are allowed as a post-login destination.
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return /^\/agency(\/|\?|$)/.test(next) && !next.startsWith("//") ? next : "/agency";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again.", email };
    if (error.status && error.status >= 500) {
      console.error("[agency signIn] auth service error", error.status, error.message);
      return { error: "Sign-in is temporarily unavailable. Please try again shortly.", email };
    }
    // Deliberately generic: don't reveal whether the email exists.
    return { error: "That email and password don't match.", email };
  }

  redirect(safeNext(formData.get("next")));
}
