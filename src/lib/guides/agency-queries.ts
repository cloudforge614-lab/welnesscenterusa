import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid, PAGE_SIZE, sanitizeSearch } from "@/lib/products/queries";
import type { ContentStatus } from "@/lib/products/status";

export type AgencyGuideListItem = {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
  category: string | null;
};

export async function listAgencyGuides(options: { q: string; page: number }) {
  const supabase = await createClient();
  const from = (options.page - 1) * PAGE_SIZE;
  const q = sanitizeSearch(options.q);

  let query = supabase.from("guides").select("id, title, slug, status, updated_at, categories(name)", { count: "exact" });
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);

  const result = await query.order("updated_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (result.error?.code === "PGRST103") return { items: [], totalCount: 0, pageCount: 1, outOfRange: true };
  if (result.error) throw new Error(`Failed to load guides: ${result.error.message}`);

  type Row = { id: string; title: string; slug: string; status: ContentStatus; updated_at: string; categories: { name: string } | null };
  const rows = (result.data ?? []) as unknown as Row[];
  const items: AgencyGuideListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    updatedAt: r.updated_at,
    category: r.categories?.name ?? null,
  }));

  const totalCount = result.count ?? 0;
  return { items, totalCount, pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), outOfRange: false };
}

export type AgencyGuideDetail = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  featuredImagePath: string | null;
  status: ContentStatus;
  updatedAt: string;
  category: { id: string; name: string } | null;
  relatedProducts: { id: string; name: string; status: string }[];
  seo: {
    title: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
  } | null;
};

export const getAgencyGuide = cache(async (id: string): Promise<AgencyGuideDetail | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const [guideRes, relatedRes, seoRes] = await Promise.all([
    supabase.from("guides").select("*, categories(id, name)").eq("id", id).maybeSingle(),
    supabase.from("guide_related_products").select("products(id, name, status)").eq("guide_id", id),
    supabase.from("seo_metadata").select("*").eq("entity_type", "guide").eq("entity_id", id).maybeSingle(),
  ]);
  if (guideRes.error) throw new Error(`Failed to load guide: ${guideRes.error.message}`);
  const guide = guideRes.data;
  if (!guide) return null;
  if (relatedRes.error) throw new Error(`Failed to load related products: ${relatedRes.error.message}`);
  if (seoRes.error) throw new Error(`Failed to load SEO metadata: ${seoRes.error.message}`);
  const seo = seoRes.data;

  type RelatedRow = { products: { id: string; name: string; status: string } | null };
  const relatedProducts = ((relatedRes.data ?? []) as unknown as RelatedRow[])
    .map((r) => r.products)
    .filter((p): p is { id: string; name: string; status: string } => p !== null);

  return {
    id: guide.id,
    title: guide.title,
    slug: guide.slug,
    content: guide.content,
    featuredImagePath: guide.featured_image_path,
    status: guide.status,
    updatedAt: guide.updated_at,
    category: guide.categories,
    relatedProducts,
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

export async function listCategoriesForPicker(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name").order("name", { ascending: true });
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data ?? [];
}
