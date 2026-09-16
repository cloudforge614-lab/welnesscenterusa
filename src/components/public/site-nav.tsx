"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "@/lib/format";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/reviews", label: "Reviews" },
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

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <BrandMark />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
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
          className="rounded-lg p-2 text-ink-muted hover:bg-sunken md:hidden"
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-brand-900/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative ml-auto h-full w-72 animate-fade-up bg-surface shadow-pop">
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
                      "block rounded-lg px-3 py-2.5 text-[15px] font-medium transition",
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
    </header>
  );
}
