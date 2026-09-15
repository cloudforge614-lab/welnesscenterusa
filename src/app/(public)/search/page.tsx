import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { Pagination } from "@/components/public/pagination";
import { ProductGrid } from "@/components/public/product-card";
import { EmptyState, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { PUBLIC_PAGE_SIZE, searchPublicProducts } from "@/lib/products/public-queries";

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function firstString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  const query = firstString(q);
  return {
    title: "Search",
    description: "Search health and wellness products at Wellness Center USA.",
    alternates: { canonical: `${siteUrl}/search` },
    // Search results are query-driven and effectively unbounded — indexing
    // them would create endless low-value/duplicate pages. The canonical
    // /search (no query) page itself stays out of the index too; /products
    // and /categories are the intended crawl paths to product pages.
    robots: { index: false, follow: true },
    openGraph: {
      title: query ? `“${query}” search results · Wellness Center USA` : "Search · Wellness Center USA",
      description: "Search health and wellness products at Wellness Center USA.",
      url: `${siteUrl}/search`,
      type: "website",
    },
  };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const { q, page: pageParam } = await props.searchParams;
  const query = firstString(q);
  const page = parsePage(pageParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Search</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">Find products by name.</p>
      </div>

      <Form action="/search" className="mt-8 flex max-w-xl gap-2" role="search">
        <label htmlFor="search-q" className="sr-only">
          Search products
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
            placeholder="Search products…"
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
        <Suspense key={`${query}-${page}`} fallback={<ResultsSkeleton />}>
          <SearchResults query={query} page={page} />
        </Suspense>
      </div>
    </div>
  );
}

async function SearchResults({ query, page }: { query: string; page: number }) {
  if (!query) {
    return (
      <EmptyState
        title="Search for a product"
        description="Type a product name above to get started, or browse everything in our directory."
      />
    );
  }

  const { items, totalCount, pageCount } = await searchPublicProducts(query, page);

  if (items.length === 0) {
    return (
      <EmptyState
        title={`No results for “${query}”`}
        description="Try a different spelling, or a more general term."
      />
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-ink-muted">
        {totalCount} result{totalCount === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
      </p>
      <ProductGrid products={items} />
      <Pagination
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
        pageSize={PUBLIC_PAGE_SIZE}
        basePath="/search"
        query={{ q: query }}
      />
    </>
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
