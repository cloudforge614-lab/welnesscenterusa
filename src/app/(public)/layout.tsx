import Link from "next/link";
import { SiteHeader } from "@/components/public/site-nav";
import { BrandLogo } from "@/components/public/brand-logo";
import { Analytics } from "@/components/public/analytics";
import type { Metadata } from "next";
import { analyticsEnabled, gaMeasurementId, googleSiteVerification } from "@/lib/env";
import { safeJsonLd } from "@/lib/content/json-ld";
import { buildSiteStructuredData } from "@/lib/seo/structured-data";

// Search Console's "HTML tag" verification, rendered only when the token is
// configured.
//
// Declared in the PUBLIC layout rather than the application root (Step 7.10).
// It was at the root, which meant the tag was also emitted into /admin/login
// and /agency/login. The token is public by design — it exists to be read off
// the page — so this is not a leak, and the change is about scope, not
// secrecy: verification is a property of the public site, and this is the same
// mechanism analytics and the site's structured data already use, where /admin
// and /agency live outside this route group and so are excluded with no
// runtime path check to get wrong.
//
// Verification is checked against the site root, which is in this group, so
// scoping it here does not affect whether the property can be verified.
//
// The property itself still has to be verified in Search Console against the
// live domain, and the sitemap submitted there. Neither can happen before
// deployment; both remain production operational steps.
export const metadata: Metadata = {
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
};

const FOOTER_LINKS = [
  { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Organization + WebSite structured data, in the public layout for the
          same reason analytics is: /admin and /agency live outside this route
          group, so the site's public identity is never emitted into a staff
          page. safeJsonLd(), never a raw JSON.stringify — the values here are
          constants, but the escaping rule is applied uniformly so no future
          edit can quietly introduce an unescaped one. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(buildSiteStructuredData()) }}
      />

      {/* Mounted here, in the public layout, rather than the root layout. That
          is the whole of the staff-exclusion mechanism: /admin, /agency and
          both login pages live outside this route group, so they never load
          analytics at all — there is no runtime path check to get wrong. */}
      {analyticsEnabled && gaMeasurementId && <Analytics measurementId={gaMeasurementId} />}

      <SiteHeader />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md">
              <Link href="/" className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
                <BrandLogo className="h-20 w-auto" />
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Independent health and wellness product discovery. We research products so you don&apos;t have to.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-0">
              {FOOTER_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-sm font-medium text-ink-muted hover:text-ink">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-8 border-t border-line pt-6 text-xs leading-relaxed text-ink-subtle">
            <p>&copy; {new Date().getFullYear()} Wellness Center USA. All rights reserved.</p>
            <p className="mt-1.5 max-w-2xl">
              This site may earn a commission from qualifying purchases made through affiliate links. Content on
              this site is for informational purposes and is not medical advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
