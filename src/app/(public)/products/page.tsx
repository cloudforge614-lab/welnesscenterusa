import type { Metadata } from "next";
import { Suspense } from "react";
import { Pagination } from "@/components/public/pagination";
import { ProductGrid } from "@/components/public/product-card";
import { EmptyState, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { listPublicProducts, PUBLIC_PAGE_SIZE } from "@/lib/products/public-queries";

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata(props: PageProps<"/products">): Promise<Metadata> {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);
  const canonical = page > 1 ? `${siteUrl}/products?page=${page}` : `${siteUrl}/products`;
  const title = page > 1 ? `Products — Page ${page}` : "Products";

  return {
    title,
    description: "Browse health and wellness products researched and reviewed by Wellness Center USA.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} · Wellness Center USA`,
      description: "Browse health and wellness products researched and reviewed by Wellness Center USA.",
      url: canonical,
      type: "website",
    },
  };
}

export default async function ProductsPage(props: PageProps<"/products">) {
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Products</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Health and wellness products we&apos;ve researched, organized in one place.
        </p>
      </div>

      {/*
        Deliberately NOT a loading.tsx file: a file-based loading.tsx here
        would create a segment-level Suspense boundary that also wraps the
        nested /products/[slug] route tree (confirmed empirically — Next
        applies a segment's loading.tsx to everything below it in that
        segment, not just its own page). That breaks notFound() there: the
        response would start streaming a 200 before the eligibility check
        completes, and the status can never change afterward. A Suspense
        scoped inside this page's own component tree only affects this page.
      */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductResults page={page} />
      </Suspense>
    </div>
  );
}

async function ProductResults({ page }: { page: number }) {
  const { items, totalCount, pageCount } = await listPublicProducts(page);

  return (
    <>
      <div className="mt-10">
        {items.length > 0 ? (
          <ProductGrid products={items} />
        ) : page > 1 ? (
          <EmptyState title="No more products" description="You've reached the end of the list." />
        ) : (
          <EmptyState title="No products yet" description="We're adding products soon. Check back shortly." />
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} totalCount={totalCount} pageSize={PUBLIC_PAGE_SIZE} basePath="/products" />
    </>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="mt-10" aria-busy="true" aria-label="Loading products">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
