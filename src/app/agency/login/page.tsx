import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAgencySession } from "@/lib/auth/agency";
import { BrandMark } from "@/components/admin/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Agency sign in",
  robots: { index: false, follow: false },
};

export default async function AgencyLoginPage(props: PageProps<"/agency/login">) {
  const session = await getAgencySession();
  if (session.state === "agency") redirect("/agency");

  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "/agency";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 p-12 text-brand-50 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-brand-700/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full bg-brand-500/20 blur-3xl"
        />
        <BrandMark tone="light" />
        <div className="relative max-w-md">
          <p className="font-display text-4xl leading-tight text-white">
            The product is live. <span className="text-brand-200">Make it shine.</span>
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100/80">
            Write the overview, benefits, ingredients, and FAQs, tune the SEO metadata, and publish — it goes live on
            the public site the moment you do.
          </p>
        </div>
        <p className="relative text-xs text-brand-100/60">Agency workspace · restricted access</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <h1 className="mt-8 font-display text-3xl text-ink lg:mt-0">Welcome back</h1>
          <p className="mt-2 text-[15px] text-ink-muted">Sign in to manage product content.</p>

          {session.state === "no-access" && (
            <p className="mt-6 rounded-lg bg-amber-soft px-3.5 py-2.5 text-sm text-amber-ink">
              You&apos;re signed in as {session.email ?? "an account"} without agency access. Sign in with an agency
              account to continue.
            </p>
          )}

          <div className="mt-8">
            <LoginForm next={nextPath} />
          </div>
        </div>
      </section>
    </main>
  );
}
