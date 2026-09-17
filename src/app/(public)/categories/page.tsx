import type { Metadata } from "next";
import Link from "next/link";
import { CategoryChip, EmptyState } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { getPublicCategoriesWithProducts } from "@/lib/products/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// aggregate policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse health and wellness products by category.",
  alternates: { canonical: `${siteUrl}/categories` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Categories · Wellness Center USA",
    description: "Browse health and wellness products by category.",
    url: `${siteUrl}/categories`,
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: TWITTER_CARD,
    title: "Categories · Wellness Center USA",
    description: "Browse health and wellness products by category.",
    images: twitterImages(),
  },
};

export default async function CategoriesPage() {
  const categories = await getPublicCategoriesWithProducts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Categories</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">Explore products organized by what they support.</p>
      </div>

      <div className="mt-10">
        {categories.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg text-ink">{category.name}</h2>
                    <CategoryChip>{category.productCount}</CategoryChip>
                  </div>
                  {category.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{category.description}</p>
                  )}
                  <span className="mt-auto pt-4 text-sm font-medium text-brand-700">View products →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No categories yet"
            description="Categories appear here once products have been organized into them."
            action={
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-card transition hover:bg-sunken"
              >
                Browse all products
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
