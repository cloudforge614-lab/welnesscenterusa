import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid, PAGE_SIZE, sanitizeSearch } from "@/lib/products/queries";
import type { ContentStatus } from "@/lib/products/status";

// Agency-facing review queries. Like agency-queries.ts for products, this
// never selects affiliate_links/affiliate_clicks — reviews have no relation
// to either, and RLS would reject the attempt regardless.

export type AgencyReviewListItem = {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
  product: { id: string; name: string };
};

export async function listAgencyReviews(options: { q: string; page: number }) {
  const supabase = await createClient();
  const from = (options.page - 1) * PAGE_SIZE;
  const q = sanitizeSearch(options.q);

  let query = supabase
    .from("reviews")
    .select("id, title, slug, status, updated_at, products!inner(id, name)", { count: "exact" });
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);

  const result = await query.order("updated_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (result.error?.code === "PGRST103") return { items: [], totalCount: 0, pageCount: 1, outOfRange: true };
  if (result.error) throw new Error(`Failed to load reviews: ${result.error.message}`);

  type Row = { id: string; title: string; slug: string; status: ContentStatus; updated_at: string; products: { id: string; name: string } | null };
  const rows = (result.data ?? []) as unknown as Row[];
  const items: AgencyReviewListItem[] = rows
    .filter((r) => r.products !== null)
    .map((r) => ({ id: r.id, title: r.title, slug: r.slug, status: r.status, updatedAt: r.updated_at, product: r.products! }));

  const totalCount = result.count ?? 0;
  return { items, totalCount, pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), outOfRange: false };
}

export type AgencyReviewDetail = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  pros: string[];
  considerations: string[];
  status: ContentStatus;
  updatedAt: string;
  product: { id: string; name: string; slug: string; status: string };
  seo: {
    title: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
  } | null;
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export const getAgencyReview = cache(async (id: string): Promise<AgencyReviewDetail | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const [reviewRes, seoRes] = await Promise.all([
    supabase.from("reviews").select("*, products(id, name, slug, status)").eq("id", id).maybeSingle(),
    supabase.from("seo_metadata").select("*").eq("entity_type", "review").eq("entity_id", id).maybeSingle(),
  ]);
  if (reviewRes.error) throw new Error(`Failed to load review: ${reviewRes.error.message}`);
  const review = reviewRes.data;
  if (!review || !review.products) return null;
  if (seoRes.error) throw new Error(`Failed to load SEO metadata: ${seoRes.error.message}`);
  const seo = seoRes.data;

  return {
    id: review.id,
    title: review.title,
    slug: review.slug,
    content: review.content,
    pros: stringArray(review.pros),
    considerations: stringArray(review.considerations),
    status: review.status,
    updatedAt: review.updated_at,
    product: { id: review.products.id, name: review.products.name, slug: review.products.slug, status: review.products.status },
    seo: seo
      ? {
          title: seo.title,
          metaDescription: seo.meta_description,
          canonicalUrl: seo.canonical_url,
          ogTitle: seo.og_title,
          ogDescription: seo.og_description,
          robotsIndex: seo.robots_index,
          robotsFollow: seo.robots_follow,
        }
      : null,
  };
});

// For the "Add review" picker — any non-deleted product, name + status only
// (owner-only fields like affiliate URL are never in this select at all).
export async function searchProductsForPicker(q: string, limit = 20): Promise<{ id: string; name: string; status: string }[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select("id, name, status").is("deleted_at", null);
  const clean = sanitizeSearch(q);
  if (clean) query = query.ilike("name", `%${clean}%`);
  const { data, error } = await query.order("name", { ascending: true }).limit(limit);
  if (error) throw new Error(`Failed to search products: ${error.message}`);
  return data ?? [];
}
