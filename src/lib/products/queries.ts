import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus, ProductStatus, StatusFilter } from "./status";

export const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Strips characters that carry meaning in PostgREST filter syntax or LIKE
// patterns, so a search term can only ever be a plain substring match.
export function sanitizeSearch(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[%_\\,()"*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function unwrap<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Failed to load ${what}: ${result.error.message}`);
  return result.data;
}

function count(result: { count: number | null; error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`Failed to count ${what}: ${result.error.message}`);
  return result.count ?? 0;
}

export type DashboardStats = {
  total: number;
  live: number;
  active: number;
  newCount: number;
  paused: number;
  archived: number;
  awaitingAgency: number;
  clicksAllTime: number;
  clicks30d: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const products = () => supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null);

  const [total, active, newCount, paused, archived, awaitingAgency, live, clicksAllTime, clicks30d] = await Promise.all([
    products(),
    products().eq("status", "active"),
    products().eq("status", "new"),
    products().eq("status", "paused"),
    products().eq("status", "archived"),
    // Anti-join: non-archived products with no published content row.
    supabase
      .from("products")
      .select("id, product_content!left(status)", { count: "exact", head: true })
      .is("deleted_at", null)
      .neq("status", "archived")
      .eq("product_content.status", "published")
      .is("product_content", null),
    supabase
      .from("products")
      .select("id, product_content!inner(status)", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "active")
      .eq("product_content.status", "published"),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).gte("clicked_at", daysAgoIso(30)),
  ]);

  return {
    total: count(total, "products"),
    active: count(active, "active products"),
    newCount: count(newCount, "new products"),
    paused: count(paused, "paused products"),
    archived: count(archived, "archived products"),
    awaitingAgency: count(awaitingAgency, "products awaiting agency"),
    live: count(live, "live products"),
    clicksAllTime: count(clicksAllTime, "clicks"),
    clicks30d: count(clicks30d, "recent clicks"),
  };
}

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  contentStatus: ContentStatus | null;
  clicks: number;
  createdAt: string;
};

type ListRow = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  created_at: string;
  content: { status: ContentStatus } | null;
  affiliate_clicks: { count: number }[];
};

type ListOptions = { q: string; filter: StatusFilter; page: number };

function filteredProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  columns: string,
  head: boolean,
  options: ListOptions,
) {
  // The "awaiting" filter is an anti-join on a separately aliased embed, so
  // `published` must be selected for its filters to apply.
  const select = options.filter === "awaiting" ? `${columns}, published:product_content!left(status)` : columns;
  let query = supabase.from("products").select(select, { count: "exact", head }).is("deleted_at", null);

  if (options.filter === "all") query = query.neq("status", "archived");
  else if (options.filter === "awaiting") {
    query = query.neq("status", "archived").eq("published.status", "published").is("published", null);
  } else query = query.eq("status", options.filter);

  if (options.q) query = query.or(`name.ilike.%${options.q}%,slug.ilike.%${options.q}%`);
  return query;
}

export async function listProducts(options: ListOptions) {
  const supabase = await createClient();
  const from = (options.page - 1) * PAGE_SIZE;

  const result = await filteredProducts(
    supabase,
    "id, name, slug, status, created_at, content:product_content(status), affiliate_clicks(count)",
    false,
    options,
  )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  // PostgREST answers a page past the end with "range not satisfiable" rather
  // than an empty list (e.g. a stale page-2 link after deletions).
  if (result.error?.code === "PGRST103") {
    const totalCount = count(await filteredProducts(supabase, "id", true, options), "products");
    return { items: [], totalCount, pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), outOfRange: true };
  }

  const rows = unwrap(result, "products") as unknown as ListRow[];

  const items: ProductListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    contentStatus: row.content?.status ?? null,
    clicks: row.affiliate_clicks?.[0]?.count ?? 0,
    createdAt: row.created_at,
  }));

  const totalCount = result.count ?? 0;
  return { items, totalCount, pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), outOfRange: false };
}

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  contentStatus: ContentStatus | null;
  createdAt: string;
  updatedAt: string;
  activeUrl: string | null;
  linkHistory: { id: string; url: string; isActive: boolean; createdAt: string }[];
};

// cache(): generateMetadata and the page both ask for the same product in one request.
export const getProduct = cache(async (id: string): Promise<ProductDetail | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const product = unwrap(
    await supabase
      .from("products")
      .select("id, name, slug, status, created_at, updated_at, product_content(status)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    "product",
  );
  if (!product) return null;

  const links =
    unwrap(
    await supabase
      .from("affiliate_links")
      .select("id, destination_url, is_active, created_at")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    "affiliate links",
  ) ?? [];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    contentStatus: product.product_content?.status ?? null,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    activeUrl: links.find((l) => l.is_active)?.destination_url ?? null,
    linkHistory: links.map((l) => ({ id: l.id, url: l.destination_url, isActive: l.is_active, createdAt: l.created_at })),
  };
});

export type ClickStats = {
  allTime: number;
  last7d: number;
  last30d: number;
  recent: { id: string; clickedAt: string; referrer: string | null; ctaLocation: string | null; device: string; utmSource: string | null }[];
};

export async function getProductClickStats(productId: string): Promise<ClickStats> {
  const supabase = await createClient();
  const clicks = () => supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("product_id", productId);

  const [allTime, last7d, last30d, recent] = await Promise.all([
    clicks(),
    clicks().gte("clicked_at", daysAgoIso(7)),
    clicks().gte("clicked_at", daysAgoIso(30)),
    supabase
      .from("affiliate_clicks")
      .select("id, clicked_at, referrer, cta_location, device_type, utm_source")
      .eq("product_id", productId)
      .order("clicked_at", { ascending: false })
      .limit(10),
  ]);

  return {
    allTime: count(allTime, "clicks"),
    last7d: count(last7d, "clicks"),
    last30d: count(last30d, "clicks"),
    recent: (unwrap(recent, "recent clicks") ?? []).map((c) => ({
      id: c.id,
      clickedAt: c.clicked_at,
      referrer: c.referrer,
      ctaLocation: c.cta_location,
      device: c.device_type,
      utmSource: c.utm_source,
    })),
  };
}
