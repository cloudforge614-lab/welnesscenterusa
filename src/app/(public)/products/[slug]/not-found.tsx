import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl text-ink">We couldn&apos;t find that product</h1>
      <p className="mt-3 text-[15px] text-ink-muted">
        It may have been removed, renamed, or isn&apos;t published yet.
      </p>
      <Link
        href="/products"
        className="mt-8 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-card transition hover:bg-sunken"
      >
        Browse all products
      </Link>
    </div>
  );
}
