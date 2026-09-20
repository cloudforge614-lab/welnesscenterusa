import Link from "next/link";

export default function ReviewNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-2xl text-ink">Review not found</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been removed, or the link is incorrect.</p>
      <Link
        href="/reviews"
        className="mt-6 inline-flex items-center justify-center min-h-11 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink shadow-card transition hover:bg-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      >
        Browse reviews
      </Link>
    </div>
  );
}
