import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { cachedPublic, TTL } from "@/lib/cache/public-cache";
import { TAGS } from "@/lib/cache/tags";

// Deliberately separate from src/lib/products/queries.ts (the owner-side
// module). That file's return types carry status, click stats, and other
// owner-only fields; this file's return types carry only what a public
// visitor may see. Keeping them apart means a public page can never
// accidentally receive an owner field through a shared type or query — the
// boundary is enforced by there being no shared code path, not just by
// convention.
//
// Every exported query here re-applies the two-gate visibility rule
// (products.status = 'active' AND product_content.status = 'published',
// AND deleted_at IS NULL) explicitly, even though RLS (products_public_select
// in 0011_rls_policies.sql) already enforces the product row itself. Two
// reasons: (1) the four product_images/faqs/benefits/ingredients RLS
// policies key only on product_content.status, not the parent product's
// status — see the Phase 3 plan's "conflicts/risks" note — so the app must
// not fetch those children for any product it hasn't already confirmed
// eligible itself; (2) defense in depth: this module should be correct on
// its own, not merely because a policy elsewhere happens to agree.

export type PublicProductSummary = {
  id: string;
  name: string;
  slug: string;
  excerpt: string | null;
  imagePath: string | null;
  imageAlt: string | null;
  categories: { id: string; name: string; slug: string }[];
  // Only populated by the homepage feed. A boolean, never the destination:
  // it tells the card whether to render a /go/[slug] CTA. Undefined elsewhere
  // means "not asked", and the card then renders no affiliate CTA.
  hasAffiliateLink?: boolean;
  // Only populated by the homepage feed: whether /products/[slug] exists (it
  // still requires published content). Undefined elsewhere means "yes".
  hasDetailPage?: boolean;
};

type SummaryRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  product_content: { overview: string | null; status: string } | null;
  product_images: { storage_path: string; alt_text: string | null; is_primary: boolean; position: number }[] | null;
  product_categories: { categories: { id: string; name: string; slug: string } | null }[] | null;
};

const EXCERPT_MAX = 180;

function excerptFrom(overview: string | null): string | null {
  if (!overview) return null;
  const trimmed = overview.trim();
  if (trimmed.length <= EXCERPT_MAX) return trimmed;
  return `${trimmed.slice(0, EXCERPT_MAX).trimEnd()}…`;
}

function primaryImage(images: SummaryRow["product_images"]) {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.position - b.position;
  });
  return sorted[0] ?? null;
}

function summaryFromRow(row: SummaryRow): PublicProductSummary {
  const image = primaryImage(row.product_images);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    excerpt: excerptFrom(row.product_content?.overview ?? null),
    imagePath: image?.storage_path ?? null,
    imageAlt: image?.alt_text ?? null,
    categories: (row.product_categories ?? [])
      .map((pc) => pc.categories)
      .filter((c): c is { id: string; name: string; slug: string } => c !== null),
  };
}

export const PUBLIC_PAGE_SIZE = 24;

export type PublicProductList = {
  items: PublicProductSummary[];
  totalCount: number;
  pageCount: number;
};

// Strips characters that carry meaning in PostgREST filter/LIKE syntax, so a
// search term can only ever act as a plain substring match. Duplicated from
// the (structurally identical) helper in the owner-side queries.ts rather
// than imported from it — importing would pull public code onto a module
// that also exports owner-only queries, blurring the boundary this file
// exists to keep sharp, for the sake of four lines of pure string logic.
//
// Exported (Phase 6 D): the four other public content modules' search
// functions need the exact same sanitizer — re-declaring the same regex a
// fourth and fifth time would be the real duplication risk, not this export.
export function sanitizePublicSearch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[%_\\,()"*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

type ProductQueryOptions = {
  page: number;
  categoryId?: string;
  search?: string;
};

// Shared by the plain listing, category pages, and search — all three are
// "the public product directory, optionally narrowed by category or name/slug
// substring, paginated in the database".
//
// DIRECTORY RULE: active + not deleted. Published Agency content is NOT
// required to be listed (an Owner-added product must appear the moment it is
// active); it only decides whether the product has a detail page
// (hasDetailPage) — /products/[slug] keeps its own published-content gate.
// This reads through get_public_products() (migration 0025), a narrow
// SECURITY DEFINER function, for the same reason the homepage reads through
// get_homepage_products(): product_images' public policy keys on published
// content, so a plain select could never return a content-less product's image.
// It returns only safe display fields and two booleans — never a URL.
async function queryPublicProducts(options: ProductQueryOptions): Promise<PublicProductList> {
  const supabase = createPublicClient();
  const safePage = Number.isFinite(options.page) && options.page > 0 ? Math.floor(options.page) : 1;
  const from = (safePage - 1) * PUBLIC_PAGE_SIZE;
  const search = options.search ? sanitizePublicSearch(options.search) : "";
  const filters = { p_category_id: options.categoryId, p_search: search || undefined };

  const { data, error } = await supabase.rpc("get_public_products", { p_limit: PUBLIC_PAGE_SIZE, p_offset: from, ...filters });
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  let rows = (data ?? []) as DirectoryRow[];

  let totalCount = Number(rows[0]?.total_count ?? 0);
  if (rows.length === 0 && safePage > 1) {
    // A page past the end has no rows, so no total_count either. Ask for the
    // first row of the set purely to learn the size (and so the page count).
    const { data: first, error: firstError } = await supabase.rpc("get_public_products", { p_limit: 1, p_offset: 0, ...filters });
    if (firstError) throw new Error(`Failed to count products: ${firstError.message}`);
    rows = [];
    totalCount = Number(((first ?? []) as DirectoryRow[])[0]?.total_count ?? 0);
  }

  return {
    items: rows.map(summaryFromDirectoryRow),
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PUBLIC_PAGE_SIZE)),
  };
}

export const listPublicProducts = cachedPublic("products:listPublicProducts", [TAGS.products, TAGS.categories], TTL.feed, async (page: number): Promise<PublicProductList> => {
  return queryPublicProducts({ page });
});

export async function searchPublicProducts(rawQuery: unknown, page: number): Promise<PublicProductList & { query: string }> {
  const query = sanitizePublicSearch(rawQuery);
  if (!query) return { items: [], totalCount: 0, pageCount: 1, query: "" };
  const result = await queryPublicProducts({ page, search: query });
  return { ...result, query };
}

// Every eligible slug, for the sitemap. Products are expected to scale into
// the thousands, so this pages through in batches rather than assuming one
// request returns everything.
export const getAllPublicSlugs = cachedPublic("products:getAllPublicSlugs", [TAGS.products], TTL.sitemap, async (): Promise<{ slug: string; updatedAt: string }[]> => {
  const supabase = createPublicClient();
  const batchSize = 1000;
  const slugs: { slug: string; updatedAt: string }[] = [];

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from("products")
      .select("slug, updated_at, product_content!inner(status)")
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("product_content.status", "published")
      .order("created_at", { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) throw new Error(`Failed to load sitemap slugs: ${error.message}`);
    if (!data || data.length === 0) break;

    slugs.push(...data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at })));
    if (data.length < batchSize) break;
  }

  return slugs;
});

export type PublicProductDetail = {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
  overview: string | null;
  howItWorks: string | null;
  usage: string | null;
  whoItsFor: string | null;
  considerations: string | null;
  images: { url: string; alt: string | null }[];
  benefits: { id: string; title: string; description: string | null }[];
  ingredients: { id: string; name: string; description: string | null }[];
  faqs: { id: string; question: string; answer: string }[];
  categories: { id: string; name: string; slug: string }[];
};

type DetailRow = {
  id: string;
  name: string;
  slug: string;
  updated_at: string;
  product_content: {
    overview: string | null;
    how_it_works: string | null;
    usage: string | null;
    who_its_for: string | null;
    considerations: string | null;
    status: string;
  } | null;
  product_images: { storage_path: string; alt_text: string | null; is_primary: boolean; position: number }[] | null;
  product_benefits: { id: string; title: string; description: string | null; position: number }[] | null;
  product_ingredients: { id: string; name: string; description: string | null; position: number }[] | null;
  product_faqs: { id: string; question: string; answer: string; position: number }[] | null;
  product_categories: { categories: { id: string; name: string; slug: string } | null }[] | null;
};

// cache(): generateMetadata and the page component both need this for the
// same request; React dedupes the underlying fetch within one render pass.
export const getPublicProduct = cache(cachedPublic("products:getPublicProduct", [TAGS.products, TAGS.categories], TTL.detail, async (slug: string): Promise<PublicProductDetail | null> => {
  if (!slug) return null;
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, slug, updated_at,
      product_content!inner(overview, how_it_works, usage, who_its_for, considerations, status),
      product_images(storage_path, alt_text, is_primary, position),
      product_benefits(id, title, description, position),
      product_ingredients(id, name, description, position),
      product_faqs(id, question, answer, position),
      product_categories(categories(id, name, slug))
    `,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("product_content.status", "published")
    .maybeSingle();

  if (error) throw new Error(`Failed to load product: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;

  const images = [...(row.product_images ?? [])]
    .sort((a, b) => (a.is_primary !== b.is_primary ? (a.is_primary ? -1 : 1) : a.position - b.position))
    .map((img) => ({ url: img.storage_path, alt: img.alt_text }))
    .filter((img): img is { url: string; alt: string | null } => /^https?:\/\//i.test(img.url));

  const byPosition = <T extends { position: number }>(rows: T[] | null) => [...(rows ?? [])].sort((a, b) => a.position - b.position);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    overview: row.product_content?.overview ?? null,
    howItWorks: row.product_content?.how_it_works ?? null,
    usage: row.product_content?.usage ?? null,
    whoItsFor: row.product_content?.who_its_for ?? null,
    considerations: row.product_content?.considerations ?? null,
    images,
    benefits: byPosition(row.product_benefits).map((b) => ({ id: b.id, title: b.title, description: b.description })),
    ingredients: byPosition(row.product_ingredients).map((i) => ({ id: i.id, name: i.name, description: i.description })),
    faqs: byPosition(row.product_faqs).map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    categories: (row.product_categories ?? [])
      .map((pc) => pc.categories)
      .filter((c): c is { id: string; name: string; slug: string } => c !== null),
  };
}));

export const getRelatedProducts = cachedPublic("products:getRelatedProducts", [TAGS.products, TAGS.categories], TTL.detail, async (productId: string, categoryIds: string[], limit: number = 4): Promise<PublicProductSummary[]> => {
  if (categoryIds.length === 0) return [];
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, slug, created_at,
      product_content!inner(overview, status),
      product_images(storage_path, alt_text, is_primary, position),
      product_categories!inner(category_id, categories(id, name, slug))
    `,
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("product_content.status", "published")
    .in("product_categories.category_id", categoryIds)
    .neq("id", productId)
    .order("created_at", { ascending: false })
    .limit(limit * 3); // categories can multiply rows; over-fetch, then dedupe

  if (error) throw new Error(`Failed to load related products: ${error.message}`);

  const seen = new Map<string, PublicProductSummary>();
  for (const row of (data ?? []) as unknown as SummaryRow[]) {
    if (!seen.has(row.id)) seen.set(row.id, summaryFromRow(row));
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
});

export type PublicSeoMetadata = {
  title: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImagePath: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

// Widened beyond "product" | "category" so the new content-type query
// modules (reviews/comparisons/articles/guides) can reuse this instead of
// duplicating the same five-column select — seo_metadata is already a
// polymorphic table keyed on (entity_type, entity_id) for exactly this.
export const getSeoMetadata = cachedPublic("products:getSeoMetadata", [TAGS.seo], TTL.detail, async (
  entityType: "product" | "category" | "review" | "comparison" | "article" | "guide",
  entityId: string,
): Promise<PublicSeoMetadata | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("seo_metadata")
    .select("title, meta_description, og_title, og_description, og_image_path, robots_index, robots_follow")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load SEO metadata: ${error.message}`);
  if (!data) return null;
  return {
    title: data.title,
    metaDescription: data.meta_description,
    ogTitle: data.og_title,
    ogDescription: data.og_description,
    ogImagePath: data.og_image_path,
    robotsIndex: data.robots_index,
    robotsFollow: data.robots_follow,
  };
});

export async function getProductSeoMetadata(productId: string): Promise<PublicSeoMetadata | null> {
  return getSeoMetadata("product", productId);
}

export async function getCategorySeoMetadata(categoryId: string): Promise<PublicSeoMetadata | null> {
  return getSeoMetadata("category", categoryId);
}

// ============================================================================
// Categories
// ============================================================================
// `categories` itself is publicly readable regardless of product state
// (categories_public_select in 0011 is `using (true)`) — a category is a
// taxonomy entity, not something that is itself "active" or "published".
// What must stay gated is which *products* a category page can show, so
// every query below still applies the same two-gate rule to the product side
// of the join.

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type PublicCategoryWithCount = PublicCategory & { productCount: number };

// Every category, with a LIVE count of active, non-deleted products (migration
// 0025's get_public_categories()). A category is a taxonomy entity: it exists,
// and is listed, whether or not it currently has products.
export const getPublicCategories = cachedPublic("products:getPublicCategories", [TAGS.categories, TAGS.products], TTL.feed, async (): Promise<PublicCategoryWithCount[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_categories");
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, productCount: Number(c.product_count) }));
});

// The homepage strip and the sitemap only want categories that currently have
// something in them.
export const getPublicCategoriesWithProducts = cachedPublic("products:getPublicCategoriesWithProducts", [TAGS.categories, TAGS.products], TTL.feed, async (): Promise<PublicCategoryWithCount[]> => {
  return (await getPublicCategories()).filter((c) => c.productCount > 0);
});

// Used by /categories/[slug]: the category itself is looked up independent
// of whether it currently has eligible products, so a category that's
// temporarily empty still resolves (and renders its own empty state) rather
// than 404ing — only a genuinely nonexistent slug should 404.
export const getPublicCategory = cachedPublic("products:getPublicCategory", [TAGS.categories], TTL.detail, async (slug: string): Promise<PublicCategory | null> => {
  if (!slug) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load category: ${error.message}`);
  return data;
});

export const getCategoryProducts = cachedPublic("products:getCategoryProducts", [TAGS.products, TAGS.categories], TTL.feed, async (categoryId: string, page: number): Promise<PublicProductList> => {
  return queryPublicProducts({ page, categoryId });
});

// For the sitemap — mirrors getPublicCategoriesWithProducts's eligibility
// rule (only categories with at least one eligible product are indexable).
export const getAllPublicCategorySlugs = cachedPublic("products:getAllPublicCategorySlugs", [TAGS.categories], TTL.sitemap, async (): Promise<{ slug: string }[]> => {
  const categories = await getPublicCategoriesWithProducts();
  return categories.map((c) => ({ slug: c.slug }));
});

// ============================================================================
// Homepage support
// ============================================================================

// The shape returned by get_homepage_products() (migration 0022) — see that
// migration for why this exists as a separate SECURITY DEFINER function
// rather than a plain select through products_public_select.
type HomepageProductRow = {
  id: string;
  name: string;
  slug: string;
  overview: string | null;
  image_path: string | null;
  image_alt: string | null;
  categories: { id: string; name: string; slug: string }[];
  created_at: string;
  has_affiliate_link: boolean;
  has_published_content: boolean;
};

type DirectoryRow = HomepageProductRow & { total_count: number };

function summaryFromDirectoryRow(row: HomepageProductRow): PublicProductSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    excerpt: excerptFrom(row.overview),
    imagePath: row.image_path,
    imageAlt: row.image_alt,
    categories: row.categories ?? [],
    hasAffiliateLink: row.has_affiliate_link === true,
    hasDetailPage: row.has_published_content === true,
  };
}

// Homepage "Latest products". Unlike every other public product query in
// this file, this one does NOT require published product_content — an
// Owner-created product (name + main image + affiliate URL, no Agency
// content yet) is eligible the moment it's active, so the homepage can show
// it immediately. get_active_affiliate_link (0010) established the pattern
// this follows: a narrow, hand-audited function that reads past the normal
// gate for one specific purpose, rather than loosening the general RLS
// policy every other public query still relies on. The product's own detail
// page, the sitemap, and category pages are completely unaffected — they
// still require published content, exactly as before this function existed.
//
// The function itself LEFT JOINs product_content (with the published filter
// in the join condition, not a WHERE clause) and product_categories, so a
// product that already has published content and assigned categories keeps
// showing its excerpt and category chips exactly as it did before — only a
// content-less product gets null/empty for those fields.
export const getLatestPublicProducts = cachedPublic("products:getLatestPublicProducts", [TAGS.products, TAGS.categories], TTL.feed, async (limit: number = 8): Promise<PublicProductSummary[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_homepage_products", { p_limit: limit });
  if (error) throw new Error(`Failed to load latest products: ${error.message}`);
  return ((data ?? []) as HomepageProductRow[]).map(summaryFromDirectoryRow);
});
