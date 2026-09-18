"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/format";

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

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 21c-4.5-2.5-7-6-7-10 3 0 5.5 1.2 7 3.5C13.5 12.2 16 11 19 11c0 4-2.5 7.5-7 10Z" />
          <path d="M12 14.5V8c0-2 1-3.5 3-4.5" />
        </svg>
      </span>
      <span className="font-display text-lg leading-none text-ink">
        Wellness Center <span className="text-brand-600">USA</span>
      </span>
    </span>
  );
}

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
    // <header> has backdrop-blur (backdrop-filter), and per the CSS spec a
    // filter/backdrop-filter on an ancestor establishes the containing block
    // for any position:fixed descendant — so a `fixed inset-0` drawer nested
    // inside this header was being sized to the header's own ~72px box
    // instead of the viewport, letting the hero and rest of the page show
    // through below it and shrinking the backdrop to a thin strip. Moving
    // the drawer out from under that ancestor is the actual fix; PublicLayout
    // (the next ancestor up) applies no filter/transform of its own, so the
    // drawer's containing block is correctly the viewport from here.
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <BrandMark />
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
            className="rounded-lg p-2 text-ink-muted hover:bg-sunken lg:hidden"
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
            className="absolute inset-0 bg-brand-900/30 backdrop-blur-[2px]"
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
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <BrandMark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-ink-muted hover:bg-sunken"
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
