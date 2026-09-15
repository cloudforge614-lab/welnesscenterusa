import type { ReactNode } from "react";
import type { Tone } from "@/lib/products/status";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-card transition hover:bg-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-rose-ink px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-soft disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60",
};

export const inputStyles =
  "block w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink shadow-card outline-none transition placeholder:text-ink-subtle focus:border-brand-500 focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-rose-ink aria-[invalid=true]:focus:ring-rose-soft";

export function BrandMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cx(
          "grid size-8 place-items-center rounded-lg",
          tone === "light" ? "bg-white/10 text-brand-100" : "bg-brand-700 text-white",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 21c-4.5-2.5-7-6-7-10 3 0 5.5 1.2 7 3.5C13.5 12.2 16 11 19 11c0 4-2.5 7.5-7 10Z" />
          <path d="M12 14.5V8c0-2 1-3.5 3-4.5" />
        </svg>
      </span>
      <span className={cx("font-display text-lg leading-none", tone === "light" ? "text-white" : "text-ink")}>
        Wellness Center <span className={tone === "light" ? "text-brand-200" : "text-brand-600"}>USA</span>
      </span>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const toneStyles: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  amber: "bg-amber-soft text-amber-ink ring-amber-ink/15",
  sky: "bg-sky-soft text-sky-ink ring-sky-ink/15",
  rose: "bg-rose-soft text-rose-ink ring-rose-ink/15",
  stone: "bg-stone-soft text-stone-ink ring-stone-ink/15",
};

export function Badge({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneStyles[tone],
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</div>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5v-7Z" />
          <path d="M3.5 8.5 12 13l8.5-4.5M12 13v7" />
        </svg>
      </span>
      <h2 className="mt-4 font-display text-xl text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-sunken", className)} aria-hidden />;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
