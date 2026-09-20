import Link from "next/link";
import { formatDate } from "@/lib/format";

// Shared by every Phase 6 "reverse link" section: product page's Reviews/
// Guides/Articles, category page's Guides/Articles, homepage's Latest
// Reviews/Guides/Blog. Each is otherwise identical — a heading, a short
// card list linking to the content type's own detail route, publish date
// only (no price/rating/fabricated data, matching every other card on
// this site).
export function ContentLinkSection<T extends { id: string; excerpt: string | null; publishedAt: string | null }>({
  id,
  title,
  items,
  hrefFor,
  labelFor,
  viewAllHref,
}: {
  id: string;
  title: string;
  items: T[];
  hrefFor: (item: T) => string;
  labelFor: (item: T) => string;
  /** Optional "View all →" link, e.g. for a homepage strip. */
  viewAllHref?: string;
}) {
  return (
    <section className="mt-16 border-t border-line pt-10" aria-labelledby={id}>
      <div className="flex items-end justify-between gap-4">
        <h2 id={id} className="font-display text-2xl text-ink">
          {title}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
            View all →
          </Link>
        )}
      </div>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-surface shadow-card transition hover:border-line-strong hover:shadow-pop">
            <Link href={hrefFor(item)} className="block rounded-xl p-4 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
              <p className="font-medium text-ink">{labelFor(item)}</p>
              {item.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{item.excerpt}</p>}
              {item.publishedAt && <p className="mt-2 text-xs text-ink-subtle">{formatDate(item.publishedAt)}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
