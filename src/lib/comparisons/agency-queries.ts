import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid, PAGE_SIZE, sanitizeSearch } from "@/lib/products/queries";
import type { ContentStatus } from "@/lib/products/status";

export type AgencyComparisonListItem = {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
};

export async function listAgencyComparisons(options: { q: string; page: number }) {
  const supabase = await createClient();
  const from = (options.page - 1) * PAGE_SIZE;
  const q = sanitizeSearch(options.q);

  let query = supabase.from("comparisons").select("id, title, slug, status, updated_at", { count: "exact" });
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);

  const result = await query.order("updated_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (result.error?.code === "PGRST103") return { items: [], totalCount: 0, pageCount: 1, outOfRange: true };
  if (result.error) throw new Error(`Failed to load comparisons: ${result.error.message}`);

  type Row = { id: string; title: string; slug: string; status: ContentStatus; updated_at: string };
  const items: AgencyComparisonListItem[] = ((result.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    updatedAt: r.updated_at,
  }));
  const totalCount = result.count ?? 0;
  return { items, totalCount, pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), outOfRange: false };
}

export type AgencyComparisonDetail = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: ContentStatus;
  updatedAt: string;
  products: { id: string; name: string; status: string; position: number }[];
  seo: {
    title: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
  } | null;
};

export const getAgencyComparison = cache(async (id: string): Promise<AgencyComparisonDetail | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const [comparisonRes, relatedRes, seoRes] = await Promise.all([
    supabase.from("comparisons").select("*").eq("id", id).maybeSingle(),
    supabase.from("comparison_products").select("position, products(id, name, status)").eq("comparison_id", id).order("position", { ascending: true }),
    supabase.from("seo_metadata").select("*").eq("entity_type", "comparison").eq("entity_id", id).maybeSingle(),
  ]);
  if (comparisonRes.error) throw new Error(`Failed to load comparison: ${comparisonRes.error.message}`);
  const comparison = comparisonRes.data;
  if (!comparison) return null;
  if (relatedRes.error) throw new Error(`Failed to load compared products: ${relatedRes.error.message}`);
  if (seoRes.error) throw new Error(`Failed to load SEO metadata: ${seoRes.error.message}`);
  const seo = seoRes.data;

  type RelatedRow = { position: number; products: { id: string; name: string; status: string } | null };
  const products = ((relatedRes.data ?? []) as unknown as RelatedRow[])
    .filter((r): r is RelatedRow & { products: NonNullable<RelatedRow["products"]> } => r.products !== null)
    .map((r) => ({ id: r.products.id, name: r.products.name, status: r.products.status, position: r.position }));

  return {
    id: comparison.id,
    title: comparison.title,
    slug: comparison.slug,
    content: comparison.content,
    status: comparison.status,
    updatedAt: comparison.updated_at,
    products,
    seo: seo
      ? {
          title: seo.title,
          metaDescription: seo.meta_description,
          ogTitle: seo.og_title,
          ogDescription: seo.og_description,
          robotsIndex: seo.robots_index,
          robotsFollow: seo.robots_follow,
        }
      : null,
  };
});
