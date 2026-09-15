import type { ReactNode } from "react";

export function StaticPage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl text-ink">{title}</h1>
      {lead && <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">{lead}</p>}
      <div className="prose-content mt-10 space-y-8">{children}</div>
    </div>
  );
}

export function StaticSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export function PlaceholderNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}
