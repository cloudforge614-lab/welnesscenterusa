"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { BrandLogo } from "./brand-logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/reviews", label: "Reviews" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/comparisons", label: "Comparisons" },
  { href: "/categories", label: "Categories" },
  { href: "/search", label: "Search" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Locks background scroll while the drawer is open. Restores whatever
  // overflow value was there before (rather than assuming "" / "visible"),
  // so this can't clobber some other component's own overflow management.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    // The drawer is rendered as a SIBLING of <header>, not a child of it.
    // The header used to carry a backdrop-filter, which per the CSS spec makes
    // it the containing block for any position:fixed descendant — a nested
    // `fixed inset-0` drawer was sized to the header's own box instead of the
    // viewport. The filter is gone now (the header is a solid surface; nothing
    // on the public site is blurred), but the drawer stays a sibling so no
    // future transform/filter on the header can reintroduce that.
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link href="/" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
            <BrandLogo priority className="h-12 w-auto sm:h-14 lg:h-16" />
          </Link>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cx(
                      "text-sm font-medium transition",
                      isActive(link.href) ? "text-brand-700" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-brand-900/40"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          {/* max-w-[85vw]: at a 320px viewport a fixed 288px (w-72) panel
              would leave only 32px of visible backdrop — capping it to 85%
              of the viewport keeps a real, tappable backdrop margin at the
              narrowest supported width. overflow-y-auto is defensive: if the
              link list ever grows taller than a short landscape viewport,
              the panel scrolls internally instead of clipping. */}
          <div className="relative ml-auto flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto animate-fade-up bg-surface shadow-pop">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <Link href="/" onClick={() => setOpen(false)} className="rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
                <BrandLogo className="h-12 w-auto" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                aria-label="Close navigation"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="space-y-1 p-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cx(
                      // min-h-11 (44px) + flex items-center: guarantees the
                      // ≥44px touch target regardless of font metrics, rather
                      // than relying on padding + line-height happening to
                      // add up to 44px.
                      "flex min-h-11 items-center rounded-lg px-3 py-2.5 text-[15px] font-medium transition",
                      isActive(link.href) ? "bg-brand-50 text-brand-800" : "text-ink-muted hover:bg-sunken hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
