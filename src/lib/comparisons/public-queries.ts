import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSeoMetadata, sanitizePublicSearch, type PublicSeoMetadata } from "@/lib/products/public-queries";
import { markdownExcerpt } from "@/lib/content/markdown";
import { SEARCH_RESULT_LIMIT } from "@/lib/search/types";

// Mirrors guides/articles/public-queries.ts. comparisons differs from those
// two in shape: no category, no featured image, no single "parent" product —
// instead it lists multiple products via comparison_products, each with an
// explicit `position` for display order. Like reviews' single product and
// guides/articles' related products, every listed product is individually
// re-checked against the full two-gate eligibility rule (RLS's
// comparison_products_select only knows the *comparison's* published state,
// not each product's) — an ineligible product is silently omitted, in its
// place in the ordering, never shown.

export const COMPARISONS_PAGE_SIZE = 24;

export type PublicComparisonSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  productCount: number;
};

type ComparisonRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  published_at: string | null;
};

export type PublicComparisonList = { items: PublicComparisonSummary[]; totalCount: number; pageCount: number };

export async function listPublicComparisons(page: number): Promise<PublicComparisonList> {
  const supabase = await createClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * COMPARISONS_PAGE_SIZE;

  const result = await supabase
    .from("comparisons")
    .select("id, title, slug, content, published_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, from + COMPARISONS_PAGE_SIZE - 1);

  if (result.error) {
    if (result.error.code === "PGRST103") {
      const countResult = await supabase.from("comparisons").select("id", { count: "exact", head: true }).eq("status", "published");
      if (countResult.error) throw new Error(`Failed to count comparisons: ${countResult.error.message}`);
      const totalCount = countResult.count ?? 0;
      return { items: [], totalCount, pageCount: Math.max(1, Math.ceil(totalCount / COMPARISONS_PAGE_SIZE)) };
    }
    throw new Error(`Failed to load comparisons: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as unknown as ComparisonRow[];
  const totalCount = result.count ?? 0;

  // Eligible product counts, one query for all comparisons on this page —
  // same "small bounded set, tally in JS" approach as
  // getPublicCategoriesWithProducts in products/public-queries.ts.
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: pairings, error: pairingsError } = await supabase
      .from("comparison_products")
      .select("comparison_id, products!inner(status, deleted_at, product_content!inner(status))")
      .in("comparison_id", ids)
      .eq("products.status", "active")
      .is("products.deleted_at", null)
      .eq("products.product_content.status", "published");
    if (pairingsError) throw new Error(`Failed to load comparison product counts: ${pairingsError.message}`);
    for (const row of pairings ?? []) counts.set(row.comparison_id, (counts.get(row.comparison_id) ?? 0) + 1);
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: markdownExcerpt(row.content),
      publishedAt: row.published_at,
      productCount: counts.get(row.id) ?? 0,
    })),
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / COMPARISONS_PAGE_SIZE)),
  };
}

export type PublicComparisonDetail = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  publishedAt: string | null;
  updatedAt: string;
  products: { id: string; name: string; slug: string; imagePath: string | null; position: number }[];
};

type DetailRow = ComparisonRow & { updated_at: string };
type RelatedRow = {
  position: number;
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

export const getPublicComparison = cache(async (slug: string): Promise<PublicComparisonDetail | null> => {
  if (!slug) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comparisons")
    .select("id, title, slug, content, published_at, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Failed to load comparison: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;

  const { data: relatedRows, error: relatedError } = await supabase
    .from("comparison_products")
    .select(
      `position, products!inner(
        id, name, slug, status, deleted_at,
        product_content!inner(status),
        product_images(storage_path, is_primary, position)
      )`,
    )
    .eq("comparison_id", row.id)
    .eq("products.status", "active")
    .is("products.deleted_at", null)
    .eq("products.product_content.status", "published")
    .order("position", { ascending: true });
  if (relatedError) throw new Error(`Failed to load compared products: ${relatedError.message}`);

  const products = ((relatedRows ?? []) as unknown as RelatedRow[])
    .filter((r): r is RelatedRow & { products: NonNullable<RelatedRow["products"]> } => r.products !== null)
    .map((r) => {
      const images = [...(r.products.product_images ?? [])].sort((a, b) => (a.is_primary !== b.is_primary ? (a.is_primary ? -1 : 1) : a.position - b.position));
      return { id: r.products.id, name: r.products.name, slug: r.products.slug, imagePath: images[0]?.storage_path ?? null, position: r.position };
    });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    products,
  };
});

export async function getAllPublicComparisonSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const supabase = await createClient();
  const batchSize = 1000;
  const slugs: { slug: string; updatedAt: string }[] = [];

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from("comparisons")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, from + batchSize - 1);
    if (error) throw new Error(`Failed to load comparison sitemap slugs: ${error.message}`);
    if (!data || data.length === 0) break;
    slugs.push(...data.map((r) => ({ slug: r.slug, updatedAt: r.updated_at })));
    if (data.length < batchSize) break;
  }

  return slugs;
}

export function getComparisonSeoMetadata(comparisonId: string): Promise<PublicSeoMetadata | null> {
  return getSeoMetadata("comparison", comparisonId);
}

// Site-wide search's "Comparisons" section. Deliberately does not compute
// productCount (unlike listPublicComparisons) — that's a second query
// (comparison_products joined against products) that the unified search
// result card never displays, so running it here would be the exact
// unnecessary-fetch this phase's performance requirement rules out.
export type SearchableComparison = Omit<PublicComparisonSummary, "productCount">;

export async function searchPublicComparisons(rawQuery: unknown, limit = SEARCH_RESULT_LIMIT): Promise<SearchableComparison[]> {
  const query = sanitizePublicSearch(rawQuery);
  if (!query) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comparisons")
    .select("id, title, slug, content, published_at")
    .eq("status", "published")
    .or(`title.ilike.%${query}%,slug.ilike.%${query}%`)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to search comparisons: ${error.message}`);
  return ((data ?? []) as unknown as ComparisonRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: markdownExcerpt(row.content),
    publishedAt: row.published_at,
  }));
}
