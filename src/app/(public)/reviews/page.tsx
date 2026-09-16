import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/public/pagination";
import { EmptyState, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { listPublicReviews, REVIEWS_PAGE_SIZE, type PublicReviewSummary } from "@/lib/reviews/public-queries";

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata(props: PageProps<"/reviews">): Promise<Metadata> {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);
  const canonical = page > 1 ? `${siteUrl}/reviews?page=${page}` : `${siteUrl}/reviews`;
  const title = page > 1 ? `Reviews — Page ${page}` : "Reviews";

  return {
    title,
    description: "Independent reviews of health and wellness products, researched and written by Wellness Center USA.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} · Wellness Center USA`,
      description: "Independent reviews of health and wellness products, researched and written by Wellness Center USA.",
      url: canonical,
      type: "website",
    },
  };
}

export default async function ReviewsPage(props: PageProps<"/reviews">) {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Reviews</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Independent, in-depth looks at the products we cover.
        </p>
      </div>

      {/* No file-based loading.tsx here — see the identical note in
          products/page.tsx: it would also wrap /reviews/[slug] and break
          notFound() there by starting a streamed 200 before eligibility is
          known. */}
      <Suspense fallback={<ReviewListSkeleton />}>
        <ReviewResults page={page} />
      </Suspense>
    </div>
  );
}

async function ReviewResults({ page }: { page: number }) {
  const { items, totalCount, pageCount } = await listPublicReviews(page);

  return (
    <>
      <div className="mt-10">
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        ) : page > 1 ? (
          <EmptyState title="No more reviews" description="You've reached the end of the list." />
        ) : (
          <EmptyState title="No reviews yet" description="We're publishing reviews soon. Check back shortly." />
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} totalCount={totalCount} pageSize={REVIEWS_PAGE_SIZE} basePath="/reviews" itemLabel="reviews" />
    </>
  );
}

function ReviewCard({ review }: { review: PublicReviewSummary }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:border-line-strong hover:shadow-pop">
      <Link href={`/reviews/${review.slug}`} className="block focus-visible:outline-none">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{review.product.name}</p>
        <h2 className="mt-1.5 font-display text-lg leading-snug text-ink">{review.title}</h2>
        {review.excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{review.excerpt}</p>}
        {review.publishedAt && <p className="mt-3 text-xs text-ink-subtle">{formatDate(review.publishedAt)}</p>}
      </Link>
    </li>
  );
}

function ReviewListSkeleton() {
  return (
    <div className="mt-10" aria-busy="true" aria-label="Loading reviews">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-4/5" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
