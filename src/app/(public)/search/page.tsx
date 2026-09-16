import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { SearchResultCard } from "@/components/public/search-result-card";
import { EmptyState, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { searchPublicProducts } from "@/lib/products/public-queries";
import { searchPublicReviews } from "@/lib/reviews/public-queries";
import { searchPublicGuides } from "@/lib/guides/public-queries";
import { searchPublicArticles } from "@/lib/articles/public-queries";
import { searchPublicComparisons } from "@/lib/comparisons/public-queries";
import { SEARCH_RESULT_LIMIT, SEARCH_TYPE_LABEL, type SearchResult, type SearchResultType } from "@/lib/search/types";

// Never cached. The whole page is a function of a visitor-supplied query
// string, so caching page output risks one visitor's search being served to
// another. The per-type search queries it calls are deliberately left
// uncached too.
export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  const query = firstString(q);
  return {
    title: "Search",
    description: "Search products, reviews, guides, articles, and comparisons at Wellness Center USA.",
    alternates: { canonical: `${siteUrl}/search` },
    // Search results are query-driven and effectively unbounded — indexing
    // them would create endless low-value/duplicate pages. The canonical
    // /search (no query) page itself stays out of the index too; each
    // content type's own listing page is the intended crawl path.
    robots: { index: false, follow: true },
    openGraph: {
      title: query ? `“${query}” search results · Wellness Center USA` : "Search · Wellness Center USA",
      description: "Search products, reviews, guides, articles, and comparisons at Wellness Center USA.",
      url: `${siteUrl}/search`,
      type: "website",
    },
  };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = firstString(q);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Search</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">Search products, reviews, guides, articles, and comparisons.</p>
      </div>

      <Form action="/search" className="mt-8 flex max-w-xl gap-2" role="search">
        <label htmlFor="search-q" className="sr-only">
          Search
        </label>
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-subtle"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={query}
            key={query}
            placeholder="Search everything…"
            maxLength={100}
            autoFocus
            className="block w-full rounded-lg border border-line-strong bg-surface py-3 pl-10 pr-3.5 text-[15px] text-ink shadow-card outline-none transition placeholder:text-ink-subtle focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-[15px] font-medium text-white shadow-card transition hover:bg-brand-800"
        >
          Search
        </button>
      </Form>

      <div className="mt-10">
        <Suspense key={query} fallback={<ResultsSkeleton />}>
          <SearchResults query={query} />
        </Suspense>
      </div>
    </div>
  );
}

function productResultUrl(slug: string) {
  return `/products/${slug}`;
}

async function SearchResults({ query }: { query: string }) {
  if (!query) {
    return (
      <EmptyState
        title="Search for a product"
        description="Type a name above to get started, or browse everything in our directory."
      />
    );
  }

  // All five independent, each already limited and each already applying
  // that content type's own eligibility rule — run together, not one after
  // another, so total latency is bounded by the slowest single query, not
  // their sum.
  const [productResult, reviews, guides, articles, comparisons] = await Promise.all([
    searchPublicProducts(query, 1),
    searchPublicReviews(query),
    searchPublicGuides(query),
    searchPublicArticles(query),
    searchPublicComparisons(query),
  ]);

  const products: SearchResult[] = productResult.items.slice(0, SEARCH_RESULT_LIMIT).map((p) => ({
    type: "product",
    id: p.id,
    title: p.name,
    slug: p.slug,
    url: productResultUrl(p.slug),
    excerpt: p.excerpt,
    publishedAt: null,
    imagePath: p.imagePath,
  }));
  const reviewResults: SearchResult[] = reviews.map((r) => ({
    type: "review",
    id: r.id,
    title: r.title,
    slug: r.slug,
    url: `/reviews/${r.slug}`,
    excerpt: r.excerpt,
    publishedAt: r.publishedAt,
    imagePath: null,
  }));
  const guideResults: SearchResult[] = guides.map((g) => ({
    type: "guide",
    id: g.id,
    title: g.title,
    slug: g.slug,
    url: `/guides/${g.slug}`,
    excerpt: g.excerpt,
    publishedAt: g.publishedAt,
    imagePath: g.featuredImagePath,
  }));
  const articleResults: SearchResult[] = articles.map((a) => ({
    type: "article",
    id: a.id,
    title: a.title,
    slug: a.slug,
    url: `/blog/${a.slug}`,
    excerpt: a.excerpt,
    publishedAt: a.publishedAt,
    imagePath: a.featuredImagePath,
  }));
  const comparisonResults: SearchResult[] = comparisons.map((c) => ({
    type: "comparison",
    id: c.id,
    title: c.title,
    slug: c.slug,
    url: `/comparisons/${c.slug}`,
    excerpt: c.excerpt,
    publishedAt: c.publishedAt,
    imagePath: null,
  }));

  const sections: { type: SearchResultType; items: SearchResult[] }[] = [
    { type: "product", items: products },
    { type: "review", items: reviewResults },
    { type: "guide", items: guideResults },
    { type: "article", items: articleResults },
    { type: "comparison", items: comparisonResults },
  ];
  const totalCount = sections.reduce((sum, s) => sum + s.items.length, 0);

  if (totalCount === 0) {
    return (
      <EmptyState
        title={`No results for “${query}”`}
        description="Try a different spelling, or a more general term."
      />
    );
  }

  return (
    <div className="space-y-12">
      <p className="text-sm text-ink-muted">
        {totalCount} result{totalCount === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
      </p>
      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <section key={section.type} aria-labelledby={`search-${section.type}-heading`}>
              <h2 id={`search-${section.type}-heading`} className="font-display text-xl text-ink">
                {SEARCH_TYPE_LABEL[section.type]}s
              </h2>
              <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.items.map((item) => (
                  <SearchResultCard key={`${item.type}-${item.id}`} result={item} />
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Searching">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
