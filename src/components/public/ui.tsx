import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
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

export function CategoryChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
      {children}
    </span>
  );
}

export function PlaceholderImage({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center bg-sunken text-ink-subtle", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <circle cx="9" cy="10.5" r="1.75" />
        <path d="m6 17 4.5-4.5a2 2 0 0 1 2.8 0L18 17" />
      </svg>
    </div>
  );
}
