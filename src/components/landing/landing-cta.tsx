import { cx } from "@/lib/format";
import type { LandingMode } from "@/lib/landing/page-data";

// The landing page's call to action.
//
// PUBLIC: a plain <a> to /go/[slug] — never next/link. /go is a server route
// that records a click and 302s off-site; Link's prefetch would fire it (and
// count a click) before anyone clicked. The destination URL never appears
// here or anywhere in the page; /go resolves it server-side.
//
// PREVIEW: rendered as an inert element. Staff previewing a draft must not
// generate real affiliate clicks, and a draft is not yet a page anyone should
// be sent to the merchant from.

export function LandingCta({
  slug,
  mode,
  location,
  label,
  size = "lg",
  fullWidth = false,
  className,
}: {
  slug: string;
  mode: LandingMode;
  /** Recorded by /go/[slug] as the click's cta_location. */
  location: string;
  label: string;
  size?: "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}) {
  const classes = cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-display font-bold shadow-pop transition",
    "bg-[var(--lp-cta)] text-[var(--lp-cta-text)] hover:opacity-90",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-text)]",
    size === "lg" ? "min-h-13 px-8 py-3.5 text-base" : "min-h-11 px-6 py-2.5 text-sm",
    fullWidth && "w-full",
    className,
  );
  const icon = (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (mode === "preview") {
    return (
      <span
        role="link"
        aria-disabled="true"
        title="Links to the official site are disabled in preview"
        className={cx(classes, "cursor-not-allowed opacity-60")}
      >
        {label}
        {icon}
      </span>
    );
  }

  return (
    <a href={`/go/${slug}?cta=${location}`} rel="sponsored nofollow noopener" className={classes}>
      {label}
      {icon}
    </a>
  );
}
