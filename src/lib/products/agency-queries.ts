import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid, PAGE_SIZE, sanitizeSearch } from "./queries";
import type { ContentStatus, ProductStatus } from "./status";

// Agency-facing query layer. Deliberately never selects affiliate_links or
// affiliate_clicks (agency has no RLS grant on either table anyway — see
// affiliate_links_owner_all / affiliate_clicks_owner_select in
// 0011_rls_policies.sql), and the types below have no field to carry an
// affiliate URL into even if a query were changed later.

export type AgencyDashboardStats = {
  total: number;
  needsContent: number; // no product_content row yet
  draft: number; // product_content.status = 'draft'
  published: number; // product_content.status = 'published'
};

export async function getAgencyDashboardStats(): Promise<AgencyDashboardStats> {
  const supabase = await createClient();
  const products = () => supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null);

  const [total, needsContent, draft, published] = await Promise.all([
    products(),
    supabase
      .from("products")
      .select("id, product_content!left(status)", { count: "exact", head: true })
      .is("deleted_at", null)
      .is("product_content", null),
    supabase
      .from("products")
      .select("id, product_content!inner(status)", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("product_content.status", "draft"),
    supabase
      .from("products")
      .select("id, product_content!inner(status)", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("product_content.status", "published"),
  ]);

  const c = (r: { count: number | null; error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`Failed to count ${what}: ${r.error.message}`);
    return r.count ?? 0;
  };

  return {
    total: c(total, "products"),
    needsContent: c(needsContent, "products needing content"),
    draft: c(draft, "draft content"),
    published: c(published, "published content"),
  };
}

export type AgencyProductListItem = {
  id: string;
  name: string;
  slug: string;
  productStatus: ProductStatus;
  contentStatus: ContentStatus | null;
  updatedAt: string;
};

type AgencyListRow = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  updated_at: string;
  content: { status: ContentStatus; updated_at: string }[] | { status: ContentStatus; updated_at: string } | null;
};

export type AgencyContentFilter = "all" | "needs_content" | "draft" | "published";

export async function listAgencyProducts(options: { q: string; filter: AgencyContentFilter; page: number }) {
  const supabase = await createClient();
  const from = (options.page - 1) * PAGE_SIZE;
  const q = sanitizeSearch(options.q);

  const needsInnerJoin = options.filter === "draft" || options.filter === "published";
  const select = needsInnerJoin
    ? "id, name, slug, status, updated_at, content:product_content!inner(status, updated_at)"
    : "id, name, slug, status, updated_at, content:product_content!left(status, updated_at)";

  let query = supabase.from("products").select(select, { count: "exact" }).is("deleted_at", null).neq("status", "archived");

  if (options.filter === "needs_content") query = query.is("content", null);
  else if (options.filter === "draft") query = query.eq("content.status", "draft");
  else if (options.filter === "published") query = query.eq("content.status", "published");

  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);

  const result = await query.order("updated_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

  if (result.error?.code === "PGRST103") {
    return { items: [], totalCount: 0, pageCount: 1, outOfRange: true };
  }
  if (result.error) throw new Error(`Failed to load products: ${result.error.message}`);

  const rows = (result.data ?? []) as unknown as AgencyListRow[];
  const items: AgencyProductListItem[] = rows.map((row) => {
    const content = Array.isArray(row.content) ? row.content[0] : row.content;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      productStatus: row.status,
      contentStatus: content?.status ?? null,
      updatedAt: content?.updated_at ?? row.updated_at,
    };
  });

  const totalCount = result.count ?? 0;
  return { items, totalCount, pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), outOfRange: false };
}

export type AgencyProductDetail = {
  id: string;
  name: string;
  slug: string;
  productStatus: ProductStatus;
  content: {
    id: string;
    overview: string | null;
    howItWorks: string | null;
    usage: string | null;
    whoItsFor: string | null;
    considerations: string | null;
    status: ContentStatus;
    updatedAt: string;
  } | null;
  benefits: { id: string; title: string; description: string | null; position: number }[];
  ingredients: { id: string; name: string; description: string | null; position: number }[];
  faqs: { id: string; question: string; answer: string; position: number }[];
  images: { id: string; url: string; altText: string | null; position: number; isPrimary: boolean }[];
  seo: {
    title: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImagePath: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
  } | null;
};

// cache(): generateMetadata and the page both ask for the same product in one request.
export const getAgencyProduct = cache(async (id: string): Promise<AgencyProductDetail | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, slug, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Failed to load product: ${error.message}`);
  if (!product) return null;

  const [contentRes, benefitsRes, ingredientsRes, faqsRes, imagesRes, seoRes] = await Promise.all([
    supabase.from("product_content").select("*").eq("product_id", id).maybeSingle(),
    supabase.from("product_benefits").select("*").eq("product_id", id).order("position"),
    supabase.from("product_ingredients").select("*").eq("product_id", id).order("position"),
    supabase.from("product_faqs").select("*").eq("product_id", id).order("position"),
    supabase.from("product_images").select("*").eq("product_id", id).order("position"),
    supabase.from("seo_metadata").select("*").eq("entity_type", "product").eq("entity_id", id).maybeSingle(),
  ]);

  for (const r of [contentRes, benefitsRes, ingredientsRes, faqsRes, imagesRes, seoRes]) {
    if (r.error) throw new Error(`Failed to load product content: ${r.error.message}`);
  }

  const content = contentRes.data;
  const seo = seoRes.data;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    productStatus: product.status,
    content: content
      ? {
          id: content.id,
          overview: content.overview,
          howItWorks: content.how_it_works,
          usage: content.usage,
          whoItsFor: content.who_its_for,
          considerations: content.considerations,
          status: content.status,
          updatedAt: content.updated_at,
        }
      : null,
    benefits: (benefitsRes.data ?? []).map((b) => ({ id: b.id, title: b.title, description: b.description, position: b.position })),
    ingredients: (ingredientsRes.data ?? []).map((i) => ({ id: i.id, name: i.name, description: i.description, position: i.position })),
    faqs: (faqsRes.data ?? []).map((f) => ({ id: f.id, question: f.question, answer: f.answer, position: f.position })),
    images: (imagesRes.data ?? []).map((img) => ({
      id: img.id,
      url: img.storage_path,
      altText: img.alt_text,
      position: img.position,
      isPrimary: img.is_primary,
    })),
    seo: seo
      ? {
          title: seo.title,
          metaDescription: seo.meta_description,
          canonicalUrl: seo.canonical_url,
          ogTitle: seo.og_title,
          ogDescription: seo.og_description,
          ogImagePath: seo.og_image_path,
          robotsIndex: seo.robots_index,
          robotsFollow: seo.robots_follow,
        }
      : null,
  };
});
