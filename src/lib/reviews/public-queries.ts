import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { cachedPublic, TTL } from "@/lib/cache/public-cache";
import { TAGS } from "@/lib/cache/tags";
import { getSeoMetadata, sanitizePublicSearch, type PublicSeoMetadata } from "@/lib/products/public-queries";
import { markdownExcerpt } from "@/lib/content/markdown";
import { SEARCH_RESULT_LIMIT } from "@/lib/search/types";

// Mirrors products/public-queries.ts: a separate module from any agency/
// owner-side query file, so a public page can never receive a field (draft
// content, an internal author id, etc.) through a shared type or query.
//
// RLS's reviews_public_select only checks reviews.status = 'published' — it
// has no way to know whether the product being reviewed is still publicly
// eligible. A review of a paused/archived/deleted product, or one whose own
// content was never published, would point at a page that 404s. Every query
// below re-applies the full product two-gate rule (products.status='active'
// AND deleted_at IS NULL AND product_content.status='published') on top of
// the review's own status, the same "defense in depth, correct on its own"
// philosophy documented in products/public-queries.ts.

export const REVIEWS_PAGE_SIZE = 24;

export type PublicReviewSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  product: { name: string; slug: string };
};

type ReviewRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  published_at: string | null;
  products: { name: string; slug: string; status: string; deleted_at: string | null; product_content: { status: string } | null } | null;
};

const REVIEW_LIST_SELECT = `
  id, title, slug, content, published_at,
  products!inner(name, slug, status, deleted_at, product_content!inner(status))
`;

function eligibleQuery(supabase: ReturnType<typeof createPublicClient>, select: string, head: boolean) {
  return supabase
    .from("reviews")
    .select(select, { count: "exact", head })
    .eq("status", "published")
    .eq("products.status", "active")
    .is("products.deleted_at", null)
    .eq("products.product_content.status", "published");
}

function summaryFromRow(row: ReviewRow): PublicReviewSummary | null {
  if (!row.products) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: markdownExcerpt(row.content),
    publishedAt: row.published_at,
    product: { name: row.products.name, slug: row.products.slug },
  };
}

export type PublicReviewList = { items: PublicReviewSummary[]; totalCount: number; pageCount: number };

export const listPublicReviews = cachedPublic("reviews:listPublicReviews", [TAGS.reviews, TAGS.products], TTL.feed, async (page: number): Promise<PublicReviewList> => {
  const supabase = createPublicClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * REVIEWS_PAGE_SIZE;

  const result = await eligibleQuery(supabase, REVIEW_LIST_SELECT, false)
    .order("published_at", { ascending: false })
    .range(from, from + REVIEWS_PAGE_SIZE - 1);

  if (result.error) {
    if (result.error.code === "PGRST103") {
      const countResult = await eligibleQuery(supabase, "id, products!inner(status, deleted_at, product_content!inner(status))", true);
      if (countResult.error) throw new Error(`Failed to count reviews: ${countResult.error.message}`);
      const totalCount = countResult.count ?? 0;
      return { items: [], totalCount, pageCount: Math.max(1, Math.ceil(totalCount / REVIEWS_PAGE_SIZE)) };
    }
    throw new Error(`Failed to load reviews: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as unknown as ReviewRow[];
  const totalCount = result.count ?? 0;
  return {
    items: rows.map(summaryFromRow).filter((r): r is PublicReviewSummary => r !== null),
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / REVIEWS_PAGE_SIZE)),
  };
});

export type PublicReviewDetail = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  pros: string[];
  considerations: string[];
  publishedAt: string | null;
  updatedAt: string;
  product: { id: string; name: string; slug: string };
};

type DetailRow = ReviewRow & {
  pros: unknown;
  considerations: unknown;
  updated_at: string;
  products: (ReviewRow["products"] & { id: string }) | null;
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export const getPublicReview = cache(cachedPublic("reviews:getPublicReview", [TAGS.reviews, TAGS.products], TTL.detail, async (slug: string): Promise<PublicReviewDetail | null> => {
  if (!slug) return null;
  const supabase = createPublicClient();

  const { data, error } = await eligibleQuery(
    supabase,
    `id, title, slug, content, pros, considerations, published_at, updated_at, products!inner(id, name, slug, status, deleted_at, product_content!inner(status))`,
    false,
  )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load review: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;
  if (!row.products) return null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    pros: stringArray(row.pros),
    considerations: stringArray(row.considerations),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    product: { id: row.products.id, name: row.products.name, slug: row.products.slug },
  };
}));

// For the sitemap.
export const getAllPublicReviewSlugs = cachedPublic("reviews:getAllPublicReviewSlugs", [TAGS.reviews, TAGS.products], TTL.sitemap, async (): Promise<{ slug: string; updatedAt: string }[]> => {
  const supabase = createPublicClient();
  const batchSize = 1000;
  const slugs: { slug: string; updatedAt: string }[] = [];

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await eligibleQuery(supabase, "slug, updated_at, products!inner(status, deleted_at, product_content!inner(status))", false)
      .order("published_at", { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) throw new Error(`Failed to load review sitemap slugs: ${error.message}`);
    if (!data || data.length === 0) break;

    slugs.push(...(data as unknown as { slug: string; updated_at: string }[]).map((row) => ({ slug: row.slug, updatedAt: row.updated_at })));
    if (data.length < batchSize) break;
  }

  return slugs;
});

// Reviews of one product, for the product page's "related reviews" section.
// Deliberately does not re-check the product's own eligibility — the caller
// (the product page) only ever calls this after it has already confirmed
// the product itself is eligible.
export const getProductReviews = cachedPublic("reviews:getProductReviews", [TAGS.reviews, TAGS.products], TTL.detail, async (productId: string, limit: number = 6): Promise<PublicReviewSummary[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, title, slug, content, published_at, products!inner(name, slug, status, deleted_at, product_content!inner(status))")
    .eq("status", "published")
    .eq("product_id", productId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load product reviews: ${error.message}`);
  return ((data ?? []) as unknown as ReviewRow[]).map(summaryFromRow).filter((r): r is PublicReviewSummary => r !== null);
});

export function getReviewSeoMetadata(reviewId: string): Promise<PublicSeoMetadata | null> {
  return getSeoMetadata("review", reviewId);
}

// Homepage's "Latest reviews" section — mirrors getLatestPublicProducts in
// products/public-queries.ts. Reuses eligibleQuery (not a bare status
// filter) since a review, unlike a guide/article, is only genuinely
// showable while its one product is also still fully eligible.
export const getLatestPublicReviews = cachedPublic("reviews:getLatestPublicReviews", [TAGS.reviews, TAGS.products], TTL.feed, async (limit: number = 4): Promise<PublicReviewSummary[]> => {
  const supabase = createPublicClient();
  const { data, error } = await eligibleQuery(supabase, REVIEW_LIST_SELECT, false).order("published_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Failed to load latest reviews: ${error.message}`);
  return ((data ?? []) as unknown as ReviewRow[]).map(summaryFromRow).filter((r): r is PublicReviewSummary => r !== null);
});

// Site-wide search's "Reviews" section. Reuses eligibleQuery — a review is
// only genuinely showable while its one product is also still fully
// eligible, same rule every other reviews query in this file applies.
export async function searchPublicReviews(rawQuery: unknown, limit = SEARCH_RESULT_LIMIT): Promise<PublicReviewSummary[]> {
  const query = sanitizePublicSearch(rawQuery);
  if (!query) return [];
  const supabase = createPublicClient();
  const { data, error } = await eligibleQuery(supabase, REVIEW_LIST_SELECT, false)
    .or(`title.ilike.%${query}%,slug.ilike.%${query}%`)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to search reviews: ${error.message}`);
  return ((data ?? []) as unknown as ReviewRow[]).map(summaryFromRow).filter((r): r is PublicReviewSummary => r !== null);
}
