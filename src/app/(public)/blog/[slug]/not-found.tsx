import Link from "next/link";

export default function ArticleNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-2xl text-ink">Article not found</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been removed, or the link is incorrect.</p>
      <Link
        href="/blog"
        className="mt-6 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink shadow-card transition hover:bg-sunken"
      >
        Browse the blog
      </Link>
    </div>
  );
}
