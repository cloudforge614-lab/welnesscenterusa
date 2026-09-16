import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSeoMetadata, type PublicSeoMetadata } from "@/lib/products/public-queries";
import { markdownExcerpt } from "@/lib/content/markdown";

// Mirrors guides/public-queries.ts exactly — same table shape (title, slug,
// content, featured_image_path, category_id, author_id, status,
// published_at), same visibility rule (own status alone gates the article;
// related products are individually re-checked against the full two-gate
// eligibility rule, never inherited from the article's own status). /blog
// is the public route name; "articles" remains the table/entity name
// throughout (seo_entity_type, storage path prefix, etc).

export const ARTICLES_PAGE_SIZE = 24;

export type PublicArticleSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImagePath: string | null;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
};

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  featured_image_path: string | null;
  published_at: string | null;
  categories: { id: string; name: string; slug: string } | null;
};

const ARTICLE_LIST_SELECT = "id, title, slug, content, featured_image_path, published_at, categories(id, name, slug)";

function summaryFromRow(row: ArticleRow): PublicArticleSummary {
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

export type PublicArticleList = { items: PublicArticleSummary[]; totalCount: number; pageCount: number };

export async function listPublicArticles(page: number): Promise<PublicArticleList> {
  const supabase = await createClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * ARTICLES_PAGE_SIZE;

  const result = await supabase
    .from("articles")
    .select(ARTICLE_LIST_SELECT, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, from + ARTICLES_PAGE_SIZE - 1);

  if (result.error) {
    if (result.error.code === "PGRST103") {
      const countResult = await supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "published");
      if (countResult.error) throw new Error(`Failed to count articles: ${countResult.error.message}`);
      const totalCount = countResult.count ?? 0;
      return { items: [], totalCount, pageCount: Math.max(1, Math.ceil(totalCount / ARTICLES_PAGE_SIZE)) };
    }
    throw new Error(`Failed to load articles: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as unknown as ArticleRow[];
  const totalCount = result.count ?? 0;
  return { items: rows.map(summaryFromRow), totalCount, pageCount: Math.max(1, Math.ceil(totalCount / ARTICLES_PAGE_SIZE)) };
}

export type PublicArticleDetail = {
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

type DetailRow = ArticleRow & { updated_at: string };
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

export const getPublicArticle = cache(async (slug: string): Promise<PublicArticleDetail | null> => {
  if (!slug) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("articles")
    .select(`id, title, slug, content, featured_image_path, published_at, updated_at, categories(id, name, slug)`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Failed to load article: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;

  const { data: relatedRows, error: relatedError } = await supabase
    .from("article_related_products")
    .select(
      `products!inner(
        id, name, slug, status, deleted_at,
        product_content!inner(status),
        product_images(storage_path, is_primary, position)
      )`,
    )
    .eq("article_id", row.id)
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
});

export async function getAllPublicArticleSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const supabase = await createClient();
  const batchSize = 1000;
  const slugs: { slug: string; updatedAt: string }[] = [];

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from("articles")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, from + batchSize - 1);
    if (error) throw new Error(`Failed to load article sitemap slugs: ${error.message}`);
    if (!data || data.length === 0) break;
    slugs.push(...data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at })));
    if (data.length < batchSize) break;
  }

  return slugs;
}

export function getArticleSeoMetadata(articleId: string): Promise<PublicSeoMetadata | null> {
  return getSeoMetadata("article", articleId);
}

// ── Phase 6: reverse-direction lookups (product page, category page) ───────
// Mirrors guides/public-queries.ts's equivalents exactly.

// Product page's "Mentioned in articles" section. Named to match
// getProductReviews in reviews/public-queries.ts.
export async function getProductArticles(productId: string, limit = 6): Promise<PublicArticleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("article_related_products")
    .select(`articles!inner(${ARTICLE_LIST_SELECT})`)
    .eq("product_id", productId)
    .eq("articles.status", "published")
    .order("published_at", { referencedTable: "articles", ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load articles for product: ${error.message}`);
  type Row = { articles: ArticleRow | null };
  return ((data ?? []) as unknown as Row[]).map((r) => r.articles).filter((a): a is ArticleRow => a !== null).map(summaryFromRow);
}

// Category page's "Articles in this category" section.
export async function getArticlesByCategory(categoryId: string, limit = 8): Promise<PublicArticleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_LIST_SELECT)
    .eq("status", "published")
    .eq("category_id", categoryId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load articles for category: ${error.message}`);
  return ((data ?? []) as unknown as ArticleRow[]).map(summaryFromRow);
}

// Homepage's "Latest from the blog" section — mirrors getLatestPublicProducts.
export async function getLatestPublicArticles(limit = 4): Promise<PublicArticleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_LIST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load latest articles: ${error.message}`);
  return ((data ?? []) as unknown as ArticleRow[]).map(summaryFromRow);
}
