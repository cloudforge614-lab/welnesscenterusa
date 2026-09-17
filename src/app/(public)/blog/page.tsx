import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/public/pagination";
import { CategoryChip, EmptyState, PlaceholderImage, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { formatDate } from "@/lib/format";
import { ARTICLES_PAGE_SIZE, listPublicArticles, type PublicArticleSummary } from "@/lib/articles/public-queries";

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

export async function generateMetadata(props: PageProps<"/blog">): Promise<Metadata> {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);
  const canonical = page > 1 ? `${siteUrl}/blog?page=${page}` : `${siteUrl}/blog`;
  const title = page > 1 ? `Blog — Page ${page}` : "Blog";

  return {
    title,
    description: "Health and wellness articles from Wellness Center USA.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} · Wellness Center USA`,
      description: "Health and wellness articles from Wellness Center USA.",
      url: canonical,
      type: "website",
      images: ogImages(),
    },
    twitter: {
      card: TWITTER_CARD,
      title: `${title} · Wellness Center USA`,
      description: "Health and wellness articles from Wellness Center USA.",
      images: twitterImages(),
    },
  };
}

export default async function BlogPage(props: PageProps<"/blog">) {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Blog</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">Health and wellness articles.</p>
      </div>

      {/* No file-based loading.tsx here — same reason as products/reviews/
          guides: it would also wrap /blog/[slug] and break notFound() there. */}
      <Suspense fallback={<ArticleListSkeleton />}>
        <ArticleResults page={page} />
      </Suspense>
    </div>
  );
}

async function ArticleResults({ page }: { page: number }) {
  const { items, totalCount, pageCount } = await listPublicArticles(page);

  return (
    <>
      <div className="mt-10">
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </ul>
        ) : page > 1 ? (
          <EmptyState title="No more articles" description="You've reached the end of the list." />
        ) : (
          <EmptyState title="No articles yet" description="We're publishing articles soon. Check back shortly." />
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} totalCount={totalCount} pageSize={ARTICLES_PAGE_SIZE} basePath="/blog" itemLabel="articles" />
    </>
  );
}

function ArticleCard({ article }: { article: PublicArticleSummary }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:border-line-strong hover:shadow-pop">
      <Link href={`/blog/${article.slug}`} className="block focus-visible:outline-none">
        <div className="aspect-video w-full overflow-hidden bg-sunken">
          {article.featuredImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts
            <img src={article.featuredImagePath} alt="" className="h-full w-full object-cover" />
          ) : (
            <PlaceholderImage className="h-full w-full" />
          )}
        </div>
        <div className="p-5">
          {article.category && (
            <div className="mb-2">
              <CategoryChip>{article.category.name}</CategoryChip>
            </div>
          )}
          <h2 className="font-display text-lg leading-snug text-ink">{article.title}</h2>
          {article.excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{article.excerpt}</p>}
          {article.publishedAt && <p className="mt-3 text-xs text-ink-subtle">{formatDate(article.publishedAt)}</p>}
        </div>
      </Link>
    </li>
  );
}

function ArticleListSkeleton() {
  return (
    <div className="mt-10" aria-busy="true" aria-label="Loading articles">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-5">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
