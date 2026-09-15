"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/admin/actions";
import { BrandMark, cx } from "./ui";

const NAV = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z",
    match: (p: string) => p === "/admin",
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: "M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5v-7Zm0 0L12 13l8.5-4.5M12 13v7",
    match: (p: string) => p.startsWith("/admin/products"),
  },
];

export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <BrandMark />
        <p className="mt-2 pl-[42px] text-[11px] font-medium uppercase tracking-[0.14em] text-ink-subtle">Owner</p>
      </div>

      <ul className="space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-brand-50 text-brand-800" : "text-ink-muted hover:bg-sunken hover:text-ink",
                )}
              >
                <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <path d={item.icon} strokeLinejoin="round" />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-line p-4">
        <p className="truncate text-xs text-ink-subtle" title={email ?? undefined}>
          Signed in as
        </p>
        <p className="truncate text-sm font-medium text-ink" title={email ?? undefined}>
          {email ?? "Owner"}
        </p>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-sunken hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-muted hover:bg-sunken"
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-brand-900/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative h-full w-72 animate-fade-up bg-surface shadow-pop">{nav}</aside>
        </div>
      )}
    </>
  );
}
