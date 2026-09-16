import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getAllPublicCategorySlugs, getAllPublicSlugs } from "@/lib/products/public-queries";
import { getAllPublicReviewSlugs } from "@/lib/reviews/public-queries";

// Static, always-indexable public pages. /search is deliberately excluded —
// its own metadata sets robots noindex, since query-driven results pages
// aren't meant to be indexed. /go/*, /admin/*, and ineligible product/
// category pages are excluded for the same reason they're excluded
// everywhere else in the public site: they either aren't real content pages
// (/go/*) or must never be discoverable while ineligible.
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/reviews", priority: 0.7, changeFrequency: "daily" },
  { path: "/categories", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", priority: 0.3, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.3, changeFrequency: "monthly" },
  { path: "/affiliate-disclosure", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productSlugs, categorySlugs, reviewSlugs] = await Promise.all([
    getAllPublicSlugs(),
    getAllPublicCategorySlugs(),
    getAllPublicReviewSlugs(),
  ]);

  return [
    ...STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
      url: `${siteUrl}${path}`,
      priority,
      changeFrequency,
    })),
    ...categorySlugs.map(({ slug }) => ({
      url: `${siteUrl}/categories/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...productSlugs.map(({ slug, updatedAt }) => ({
      url: `${siteUrl}/products/${slug}`,
      lastModified: updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...reviewSlugs.map(({ slug, updatedAt }) => ({
      url: `${siteUrl}/reviews/${slug}`,
      lastModified: updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
