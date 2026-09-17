import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/public/pagination";
import { EmptyState, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { formatDate } from "@/lib/format";
import { COMPARISONS_PAGE_SIZE, listPublicComparisons, type PublicComparisonSummary } from "@/lib/comparisons/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// aggregate policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata(props: PageProps<"/comparisons">): Promise<Metadata> {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);
  const canonical = page > 1 ? `${siteUrl}/comparisons?page=${page}` : `${siteUrl}/comparisons`;
  const title = page > 1 ? `Comparisons — Page ${page}` : "Comparisons";

  return {
    title,
    description: "Side-by-side product comparisons from Wellness Center USA.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} · Wellness Center USA`,
      description: "Side-by-side product comparisons from Wellness Center USA.",
      url: canonical,
      type: "website",
      images: ogImages(),
    },
    twitter: {
      card: TWITTER_CARD,
      title: `${title} · Wellness Center USA`,
      description: "Side-by-side product comparisons from Wellness Center USA.",
      images: twitterImages(),
    },
  };
}

export default async function ComparisonsPage(props: PageProps<"/comparisons">) {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Comparisons</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">Side-by-side looks at how products stack up against each other.</p>
      </div>

      {/* No file-based loading.tsx here — same reason as products/reviews/
          guides/blog: it would also wrap /comparisons/[slug] and break
          notFound() there. */}
      <Suspense fallback={<ComparisonListSkeleton />}>
        <ComparisonResults page={page} />
      </Suspense>
    </div>
  );
}

async function ComparisonResults({ page }: { page: number }) {
  const { items, totalCount, pageCount } = await listPublicComparisons(page);

  return (
    <>
      <div className="mt-10">
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((comparison) => (
              <ComparisonCard key={comparison.id} comparison={comparison} />
            ))}
          </ul>
        ) : page > 1 ? (
          <EmptyState title="No more comparisons" description="You've reached the end of the list." />
        ) : (
          <EmptyState title="No comparisons yet" description="We're publishing comparisons soon. Check back shortly." />
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} totalCount={totalCount} pageSize={COMPARISONS_PAGE_SIZE} basePath="/comparisons" itemLabel="comparisons" />
    </>
  );
}

function ComparisonCard({ comparison }: { comparison: PublicComparisonSummary }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:border-line-strong hover:shadow-pop">
      <Link href={`/comparisons/${comparison.slug}`} className="block focus-visible:outline-none">
        <h2 className="font-display text-lg leading-snug text-ink">{comparison.title}</h2>
        {comparison.excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{comparison.excerpt}</p>}
        <p className="mt-3 text-xs text-ink-subtle">
          {comparison.productCount} product{comparison.productCount === 1 ? "" : "s"} compared
          {comparison.publishedAt ? ` · ${formatDate(comparison.publishedAt)}` : ""}
        </p>
      </Link>
    </li>
  );
}

function ComparisonListSkeleton() {
  return (
    <div className="mt-10" aria-busy="true" aria-label="Loading comparisons">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
