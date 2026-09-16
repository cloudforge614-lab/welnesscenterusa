import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { cachedPublic, TTL } from "@/lib/cache/public-cache";
import { TAGS } from "@/lib/cache/tags";
import { getSeoMetadata, sanitizePublicSearch, type PublicSeoMetadata } from "@/lib/products/public-queries";
import { markdownExcerpt } from "@/lib/content/markdown";
import { SEARCH_RESULT_LIMIT } from "@/lib/search/types";

// Mirrors reviews/public-queries.ts: a separate module from any agency/owner
// query file, so a public page can never receive a draft/internal field
// through a shared type or query. RLS's guides_public_select only checks
// guides.status = 'published' — a guide has no mandatory parent product (it
// can exist and be published independent of any product), so unlike
// reviews, no extra product-eligibility gate applies to the guide itself.
// Its *related products*, however, are optional and must each individually
// pass the same two-gate eligibility rule products/public-queries.ts uses
// everywhere else, or an unpublished/paused/archived product would be
// linked from a public page.

export const GUIDES_PAGE_SIZE = 24;

export type PublicGuideSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImagePath: string | null;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
};

type GuideRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  featured_image_path: string | null;
  published_at: string | null;
  categories: { id: string; name: string; slug: string } | null;
};

const GUIDE_LIST_SELECT = "id, title, slug, content, featured_image_path, published_at, categories(id, name, slug)";

function summaryFromRow(row: GuideRow): PublicGuideSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: markdownExcerpt(row.content),
    featuredImagePath: row.featured_image_path,
    publishedAt: row.published_at,
    category: row.categories,
  };
}

export type PublicGuideList = { items: PublicGuideSummary[]; totalCount: number; pageCount: number };

export const listPublicGuides = cachedPublic("guides:listPublicGuides", [TAGS.guides], TTL.feed, async (page: number): Promise<PublicGuideList> => {
  const supabase = createPublicClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * GUIDES_PAGE_SIZE;

  const result = await supabase
    .from("guides")
    .select(GUIDE_LIST_SELECT, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, from + GUIDES_PAGE_SIZE - 1);

  if (result.error) {
    if (result.error.code === "PGRST103") {
      const countResult = await supabase.from("guides").select("id", { count: "exact", head: true }).eq("status", "published");
      if (countResult.error) throw new Error(`Failed to count guides: ${countResult.error.message}`);
      const totalCount = countResult.count ?? 0;
      return { items: [], totalCount, pageCount: Math.max(1, Math.ceil(totalCount / GUIDES_PAGE_SIZE)) };
    }
    throw new Error(`Failed to load guides: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as unknown as GuideRow[];
  const totalCount = result.count ?? 0;
  return { items: rows.map(summaryFromRow), totalCount, pageCount: Math.max(1, Math.ceil(totalCount / GUIDES_PAGE_SIZE)) };
});

export type PublicGuideDetail = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  featuredImagePath: string | null;
  publishedAt: string | null;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
  relatedProducts: { id: string; name: string; slug: string; imagePath: string | null }[];
};

type DetailRow = GuideRow & { updated_at: string };
type RelatedRow = {
  products: {
    id: string;
    name: string;
    slug: string;
    status: string;
    deleted_at: string | null;
    product_content: { status: string } | null;
    product_images: { storage_path: string; is_primary: boolean; position: number }[] | null;
  } | null;
};

export const getPublicGuide = cache(cachedPublic("guides:getPublicGuide", [TAGS.guides, TAGS.products, TAGS.categories], TTL.detail, async (slug: string): Promise<PublicGuideDetail | null> => {
  if (!slug) return null;
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("guides")
    .select(`id, title, slug, content, featured_image_path, published_at, updated_at, categories(id, name, slug)`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Failed to load guide: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;

  // Related products: only ones passing the full two-gate eligibility rule.
  const { data: relatedRows, error: relatedError } = await supabase
    .from("guide_related_products")
    .select(
      `products!inner(
        id, name, slug, status, deleted_at,
        product_content!inner(status),
        product_images(storage_path, is_primary, position)
      )`,
    )
    .eq("guide_id", row.id)
    .eq("products.status", "active")
    .is("products.deleted_at", null)
    .eq("products.product_content.status", "published");
  if (relatedError) throw new Error(`Failed to load related products: ${relatedError.message}`);

  const relatedProducts = ((relatedRows ?? []) as unknown as RelatedRow[])
    .map((r) => r.products)
    .filter((p): p is NonNullable<RelatedRow["products"]> => p !== null)
    .map((p) => {
      const images = [...(p.product_images ?? [])].sort((a, b) => (a.is_primary !== b.is_primary ? (a.is_primary ? -1 : 1) : a.position - b.position));
      return { id: p.id, name: p.name, slug: p.slug, imagePath: images[0]?.storage_path ?? null };
    });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    featuredImagePath: row.featured_image_path,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    category: row.categories,
    relatedProducts,
  };
}));

export const getAllPublicGuideSlugs = cachedPublic("guides:getAllPublicGuideSlugs", [TAGS.guides], TTL.sitemap, async (): Promise<{ slug: string; updatedAt: string }[]> => {
  const supabase = createPublicClient();
  const batchSize = 1000;
  const slugs: { slug: string; updatedAt: string }[] = [];

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from("guides")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, from + batchSize - 1);
    if (error) throw new Error(`Failed to load guide sitemap slugs: ${error.message}`);
    if (!data || data.length === 0) break;
    slugs.push(...data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at })));
    if (data.length < batchSize) break;
  }

  return slugs;
});

export function getGuideSeoMetadata(guideId: string): Promise<PublicSeoMetadata | null> {
  return getSeoMetadata("guide", guideId);
}

// ── Phase 6: reverse-direction lookups (product page, category page) ───────
// Same shape/rule as the guide page's own related-products query, mirrored:
// only published guides, via the same join table, single indexed-column
// filter — no per-row follow-up query, so no N+1 regardless of caller.

// Product page's "Featured in guides" section. Named to match
// getProductReviews in reviews/public-queries.ts.
export const getProductGuides = cachedPublic("guides:getProductGuides", [TAGS.guides], TTL.detail, async (productId: string, limit: number = 6): Promise<PublicGuideSummary[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("guide_related_products")
    .select(`guides!inner(${GUIDE_LIST_SELECT})`)
    .eq("product_id", productId)
    .eq("guides.status", "published")
    .order("published_at", { referencedTable: "guides", ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load guides for product: ${error.message}`);
  type Row = { guides: GuideRow | null };
  return ((data ?? []) as unknown as Row[]).map((r) => r.guides).filter((g): g is GuideRow => g !== null).map(summaryFromRow);
});

// Category page's "Guides in this category" section.
export const getGuidesByCategory = cachedPublic("guides:getGuidesByCategory", [TAGS.guides, TAGS.categories], TTL.feed, async (categoryId: string, limit: number = 8): Promise<PublicGuideSummary[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_LIST_SELECT)
    .eq("status", "published")
    .eq("category_id", categoryId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load guides for category: ${error.message}`);
  return ((data ?? []) as unknown as GuideRow[]).map(summaryFromRow);
});

// Homepage's "Latest guides" section — mirrors getLatestPublicProducts in
// products/public-queries.ts exactly (a small LIMIT query, not a full
// paginated page like listPublicGuides, which would over-fetch for a
// 4-item strip).
export const getLatestPublicGuides = cachedPublic("guides:getLatestPublicGuides", [TAGS.guides], TTL.feed, async (limit: number = 4): Promise<PublicGuideSummary[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_LIST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load latest guides: ${error.message}`);
  return ((data ?? []) as unknown as GuideRow[]).map(summaryFromRow);
});

// Site-wide search's "Guides" section.
export async function searchPublicGuides(rawQuery: unknown, limit = SEARCH_RESULT_LIMIT): Promise<PublicGuideSummary[]> {
  const query = sanitizePublicSearch(rawQuery);
  if (!query) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_LIST_SELECT)
    .eq("status", "published")
    .or(`title.ilike.%${query}%,slug.ilike.%${query}%`)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to search guides: ${error.message}`);
  return ((data ?? []) as unknown as GuideRow[]).map(summaryFromRow);
}
