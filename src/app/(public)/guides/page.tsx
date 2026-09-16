import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/public/pagination";
import { CategoryChip, EmptyState, PlaceholderImage, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { GUIDES_PAGE_SIZE, listPublicGuides, type PublicGuideSummary } from "@/lib/guides/public-queries";

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata(props: PageProps<"/guides">): Promise<Metadata> {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);
  const canonical = page > 1 ? `${siteUrl}/guides?page=${page}` : `${siteUrl}/guides`;
  const title = page > 1 ? `Guides — Page ${page}` : "Guides";

  return {
    title,
    description: "In-depth guides on health and wellness topics from Wellness Center USA.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} · Wellness Center USA`,
      description: "In-depth guides on health and wellness topics from Wellness Center USA.",
      url: canonical,
      type: "website",
    },
  };
}

export default async function GuidesPage(props: PageProps<"/guides">) {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Guides</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">In-depth guides on health and wellness topics.</p>
      </div>

      {/* No file-based loading.tsx here — same reason as products/page.tsx
          and reviews/page.tsx: it would also wrap /guides/[slug] and break
          notFound() there. */}
      <Suspense fallback={<GuideListSkeleton />}>
        <GuideResults page={page} />
      </Suspense>
    </div>
  );
}

async function GuideResults({ page }: { page: number }) {
  const { items, totalCount, pageCount } = await listPublicGuides(page);

  return (
    <>
      <div className="mt-10">
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </ul>
        ) : page > 1 ? (
          <EmptyState title="No more guides" description="You've reached the end of the list." />
        ) : (
          <EmptyState title="No guides yet" description="We're publishing guides soon. Check back shortly." />
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} totalCount={totalCount} pageSize={GUIDES_PAGE_SIZE} basePath="/guides" itemLabel="guides" />
    </>
  );
}

function GuideCard({ guide }: { guide: PublicGuideSummary }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:border-line-strong hover:shadow-pop">
      <Link href={`/guides/${guide.slug}`} className="block focus-visible:outline-none">
        <div className="aspect-video w-full overflow-hidden bg-sunken">
          {guide.featuredImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts
            <img src={guide.featuredImagePath} alt="" className="h-full w-full object-cover" />
          ) : (
            <PlaceholderImage className="h-full w-full" />
          )}
        </div>
        <div className="p-5">
          {guide.category && (
            <div className="mb-2">
              <CategoryChip>{guide.category.name}</CategoryChip>
            </div>
          )}
          <h2 className="font-display text-lg leading-snug text-ink">{guide.title}</h2>
          {guide.excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{guide.excerpt}</p>}
          {guide.publishedAt && <p className="mt-3 text-xs text-ink-subtle">{formatDate(guide.publishedAt)}</p>}
        </div>
      </Link>
    </li>
  );
}

function GuideListSkeleton() {
  return (
    <div className="mt-10" aria-busy="true" aria-label="Loading guides">
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
