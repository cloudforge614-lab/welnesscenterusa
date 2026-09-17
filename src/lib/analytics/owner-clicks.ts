import "server-only";

import { assertOwner } from "@/lib/auth/owner";
import { daysInRange, resolveDateRange, type ResolvedRange } from "./date-range";

function todayUtcStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// Owner-only affiliate click analytics (Phase 7.8).
//
// Uses the session-bound client from assertOwner() throughout — never the
// cookie-free public client from Step 7.5. That client exists specifically
// for anonymous public reads; using it here would run every query as the
// anon role, which has no SELECT access to affiliate_clicks at all (RLS
// would just return nothing). This is authenticated owner data and must stay
// on the authenticated path.
//
// assertOwner() is the explicit, code-level authorization layer required in
// addition to the database check inside owner_click_analytics() and the
// page-level requireOwnerPage() already enforced by the /admin layout. Three
// independent layers, each of which denies on its own:
//   1. UI/navigation  — the Analytics link only renders for the owner role
//   2. this module     — assertOwner() throws NotOwnerError for anyone else
//   3. the database    — owner_click_analytics() itself raises for anyone
//                         whose role isn't owner, and RLS confines
//                         affiliate_clicks/products to the owner regardless
//
// Nothing here queries affiliate_links, and nothing in the RPC's output
// (verified in supabase/migrations/0018) includes a destination URL, an IP,
// or any field beyond product identity (id/name/slug) and the same
// attribution columns already shown on the per-product click stats in
// lib/products/queries.ts.

export type ClickTrendPoint = { day: string; count: number };
export type ClickBreakdownItem = { value: string; count: number };
export type ProductBreakdownItem = { productId: string; name: string; slug: string; count: number };

export type RecentClick = {
  id: string;
  clickedAt: string;
  productId: string;
  productName: string;
  referrer: string | null;
  landingPage: string | null;
  ctaLocation: string | null;
  device: string;
  utmSource: string | null;
};

export type OwnerClickAnalytics = {
  range: ResolvedRange;
  /** All-time total, independent of the selected range. */
  allTimeTotal: number;
  /** Always today (UTC), independent of the selected range. */
  todayTotal: number;
  /** Clicks within the selected range — what the charts and breakdowns below describe. */
  totalClicks: number;
  trend: ClickTrendPoint[];
  byProduct: ProductBreakdownItem[];
  byCta: ClickBreakdownItem[];
  byDevice: ClickBreakdownItem[];
  byReferrer: ClickBreakdownItem[];
  byUtmSource: ClickBreakdownItem[];
  byUtmMedium: ClickBreakdownItem[];
  byUtmCampaign: ClickBreakdownItem[];
  recent: RecentClick[];
};

type RpcPayload = {
  totalClicks: number;
  byDay: { day: string; count: number }[];
  byProduct: { productId: string; name: string; slug: string; count: number }[];
  byCta: { value: string; count: number }[];
  byDevice: { value: string; count: number }[];
  byReferrer: { value: string; count: number }[];
  byUtmSource: { value: string; count: number }[];
  byUtmMedium: { value: string; count: number }[];
  byUtmCampaign: { value: string; count: number }[];
};

const RECENT_LIMIT = 20;

export async function getOwnerClickAnalytics(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): Promise<OwnerClickAnalytics> {
  const { supabase } = await assertOwner();
  const range = resolveDateRange(searchParams);

  const [rpcResult, recentResult, allTimeResult, todayResult] = await Promise.all([
    supabase.rpc("owner_click_analytics", { p_since: range.sinceIso, p_until: range.untilIso }),
    supabase
      .from("affiliate_clicks")
      .select("id, clicked_at, referrer, landing_page, cta_location, device_type, utm_source, product_id, products(name)")
      .gte("clicked_at", range.sinceIso)
      .lt("clicked_at", range.untilIso)
      .order("clicked_at", { ascending: false })
      .limit(RECENT_LIMIT),
    // All-time and today's counts are plain filtered counts, not GROUP BYs —
    // no aggregation needed, so these go straight through PostgREST rather
    // than through the RPC, same as getDashboardStats already does.
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).gte("clicked_at", todayUtcStartIso()),
  ]);

  if (rpcResult.error) throw new Error(`Failed to load click analytics: ${rpcResult.error.message}`);
  if (recentResult.error) throw new Error(`Failed to load recent clicks: ${recentResult.error.message}`);
  if (allTimeResult.error) throw new Error(`Failed to load all-time click count: ${allTimeResult.error.message}`);
  if (todayResult.error) throw new Error(`Failed to load today's click count: ${todayResult.error.message}`);

  const data = rpcResult.data as unknown as RpcPayload;

  // Fill every day in the range with a zero, so the trend chart shows an
  // accurate flat line for a quiet day rather than silently skipping it —
  // an omitted point reads as "no data", a zero-height bar reads as "no
  // clicks that day", which is the true state.
  const counted = new Map(data.byDay.map((d) => [d.day, d.count]));
  const trend: ClickTrendPoint[] = daysInRange(range.sinceIso, range.untilIso).map((day) => ({
    day,
    count: counted.get(day) ?? 0,
  }));

  type RecentRow = {
    id: string;
    clicked_at: string;
    referrer: string | null;
    landing_page: string | null;
    cta_location: string | null;
    device_type: string;
    utm_source: string | null;
    product_id: string;
    products: { name: string } | null;
  };
  const recentRows = (recentResult.data ?? []) as unknown as RecentRow[];

  return {
    range,
    allTimeTotal: allTimeResult.count ?? 0,
    todayTotal: todayResult.count ?? 0,
    totalClicks: data.totalClicks,
    trend,
    byProduct: data.byProduct,
    byCta: data.byCta,
    byDevice: data.byDevice,
    byReferrer: data.byReferrer,
    byUtmSource: data.byUtmSource,
    byUtmMedium: data.byUtmMedium,
    byUtmCampaign: data.byUtmCampaign,
    // A click whose product was deleted between the click and this read is
    // skipped rather than shown with a blank name — every remaining row has
    // a resolvable product to link to.
    recent: recentRows
      .filter((r): r is RecentRow & { products: { name: string } } => r.products !== null)
      .map((r) => ({
        id: r.id,
        clickedAt: r.clicked_at,
        productId: r.product_id,
        productName: r.products.name,
        referrer: r.referrer,
        landingPage: r.landing_page,
        ctaLocation: r.cta_location,
        device: r.device_type,
        utmSource: r.utm_source,
      })),
  };
}
