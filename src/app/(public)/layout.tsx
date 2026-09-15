import Link from "next/link";
import { SiteHeader } from "@/components/public/site-nav";

const FOOTER_LINKS = [
  { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md">
              <Link href="/" className="font-display text-lg text-ink">
                Wellness Center <span className="text-brand-600">USA</span>
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Independent health and wellness product discovery. We research products so you don&apos;t have to.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm font-medium text-ink-muted hover:text-ink">
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
