import Link from "next/link";
import { PlaceholderImage } from "./ui";
import { formatDate } from "@/lib/format";
import { SEARCH_TYPE_LABEL, type SearchResult } from "@/lib/search/types";

const TYPE_BADGE_TONE: Record<SearchResult["type"], string> = {
  product: "bg-brand-50 text-brand-700",
  review: "bg-sky-soft text-sky-ink",
  guide: "bg-amber-soft text-amber-ink",
  article: "bg-stone-soft text-stone-ink",
  comparison: "bg-rose-soft text-rose-ink",
};

export function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <li className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:border-line-strong hover:shadow-pop">
      <Link href={result.url} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
        <div className="aspect-[4/3] w-full overflow-hidden border-b border-line bg-white">
          {result.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts
            <img src={result.imagePath} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
          ) : (
            <PlaceholderImage className="h-full w-full" />
          )}
        </div>
        <div className="p-4">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_TONE[result.type]}`}>
            {SEARCH_TYPE_LABEL[result.type]}
          </span>
          {/* h3, matching ProductCard's heading level exactly — the existing
              Phase 3 regression suite locates a search result via
              getByRole("heading", { level: 3, name: productName }). */}
          <h3 className="mt-2 font-display text-base leading-snug text-ink [overflow-wrap:anywhere] group-hover:text-brand-700">{result.title}</h3>
          {result.excerpt && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{result.excerpt}</p>}
          {result.publishedAt && <p className="mt-2 text-xs text-ink-subtle">{formatDate(result.publishedAt)}</p>}
        </div>
      </Link>
    </li>
  );
}
