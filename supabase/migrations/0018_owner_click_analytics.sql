-- 0018_owner_click_analytics.sql
-- Phase 7.8. Adds exactly one function and one index, both narrowly scoped
-- to the owner analytics dashboard.

-- Most aggregate queries below filter by clicked_at across all products, not
-- by a single product_id first, so they weren't well served by the existing
-- (product_id, clicked_at) composite index. A plain index on clicked_at
-- covers those scans without touching the existing one.
create index if not exists affiliate_clicks_clicked_at_idx
  on public.affiliate_clicks (clicked_at desc);

-- owner_click_analytics: every aggregate the dashboard needs, in one round
-- trip, as a single jsonb payload — a daily trend plus breakdowns by
-- product, CTA location, device type, referrer host, and UTM source/medium/
-- campaign, each already filtered to the caller's requested date range.
--
-- SECURITY INVOKER (the default — no "security definer" below), and that is
-- deliberate, not an oversight. The owner already has full RLS SELECT access
-- to both tables this function reads: affiliate_clicks_owner_select and
-- products_owner_select (0011) both key on is_owner(). Running as the caller
-- means this function needs no elevated privilege at all — if the explicit
-- check below ever had a bug, RLS still independently confines a non-owner
-- caller to whatever their own policies allow (nothing, for affiliate_clicks;
-- their own read scope, for products), never another user's data. That is a
-- strictly stronger guarantee than SECURITY DEFINER, which would have to
-- reconstruct that same protection by hand instead of inheriting it.
--
-- The explicit is_owner() check is still real, not decorative: without it, a
-- non-owner caller would just receive an empty/zeroed payload from RLS
-- silently filtering everything out, which is indistinguishable from "no
-- clicks in range" — no way to *tell* the caller they aren't allowed. This
-- mirrors the same defense-in-depth pattern already used by create_product()
-- and update_product_affiliate_url() in 0010.
--
-- Never touches affiliate_links, and never returns a destination URL, a
-- token, an IP, or anything below the aggregate level. product identity is
-- limited to id/name/slug, the same fields already shown throughout the
-- owner and agency UIs.
create or replace function public.owner_click_analytics(
  p_since timestamptz,
  p_until timestamptz
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_result jsonb;
begin
  -- "is not true" rather than "not ...": is_owner() resolves through
  -- current_user_role(), which returns NULL (not false) for a caller with no
  -- profiles row — an anonymous request, in particular. In plpgsql,
  -- `if not NULL then` never fires (NULL is not TRUE), so a plain `not
  -- is_owner()` check silently skips this guard for exactly the caller it
  -- most needs to catch. Found by testing an anon call directly, not by
  -- inspection — it returned 200 with an all-zero payload instead of being
  -- rejected. RLS still confined the result to nothing (empty tables, not
  -- a leak), but the explicit guard existed precisely so a disallowed
  -- caller gets told no, rather than an indistinguishable empty answer.
  if public.is_owner() is not true then
    raise exception 'Only the owner can view click analytics';
  end if;

  select jsonb_build_object(
    'totalClicks', (
      select count(*)
      from public.affiliate_clicks
      where clicked_at >= p_since and clicked_at < p_until
    ),
    'byDay', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'count', cnt) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', clicked_at) as day, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until
        group by 1
      ) d
    ),
    'byProduct', (
      select coalesce(jsonb_agg(jsonb_build_object('productId', product_id, 'name', name, 'slug', slug, 'count', cnt) order by cnt desc, name asc), '[]'::jsonb)
      from (
        select ac.product_id, p.name, p.slug, count(*) as cnt
        from public.affiliate_clicks ac
        join public.products p on p.id = ac.product_id
        where ac.clicked_at >= p_since and ac.clicked_at < p_until
        group by ac.product_id, p.name, p.slug
        order by cnt desc
        limit 15
      ) x
    ),
    'byCta', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select coalesce(cta_location, '(unspecified)') as value, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until
        group by 1
        order by cnt desc
        limit 10
      ) x
    ),
    'byDevice', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select device_type::text as value, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until
        group by 1
        order by cnt desc
      ) x
    ),
    -- Referrers are stored as full external URLs (never same-origin — the
    -- app's own /go handler nulls those out into landing_page instead).
    -- Grouping by the raw URL would fragment identical sources across every
    -- distinct query string, so this extracts just the host.
    'byReferrer', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select coalesce(substring(referrer from 'https?://([^/]+)'), '(direct)') as value, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until
        group by 1
        order by cnt desc
        limit 10
      ) x
    ),
    'byUtmSource', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select utm_source as value, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until and utm_source is not null
        group by 1
        order by cnt desc
        limit 10
      ) x
    ),
    'byUtmMedium', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select utm_medium as value, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until and utm_medium is not null
        group by 1
        order by cnt desc
        limit 10
      ) x
    ),
    'byUtmCampaign', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select utm_campaign as value, count(*) as cnt
        from public.affiliate_clicks
        where clicked_at >= p_since and clicked_at < p_until and utm_campaign is not null
        group by 1
        order by cnt desc
        limit 10
      ) x
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- Granted to authenticated only — not anon, and not merely "not public".
--
-- REVOKE ... FROM PUBLIC alone is not sufficient on this project: Supabase
-- provisions every new project with a platform-level
-- `alter default privileges in schema public grant execute on functions to
-- anon, authenticated` that runs before any of this repo's own migrations,
-- so a newly created function starts out directly, independently executable
-- by anon — PUBLIC is a separate, additive pseudo-grant layered on top, and
-- revoking it does not touch anon's own direct grant underneath. Verified
-- directly against the dev project with a throwaway diagnostic (removed
-- before this migration was finalized): has_function_privilege('anon', ...)
-- was true immediately after create, before this REVOKE ran.
--
-- This appears to be a pre-existing gap in every prior owner/agency-only RPC
-- in this project (create_product, update_product_affiliate_url, and
-- others all `revoke ... from public` only) — each is currently reachable by
-- anon at the grant level, though their own internal role checks still deny
-- anon in practice. That is a separate, broader finding outside this
-- migration's scope (narrowly the click-analytics feature) and is called
-- out in the Step 7.8 report rather than silently fixed here; revisiting
-- those grants is follow-up work, not a change to make in passing.
revoke all on function public.owner_click_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.owner_click_analytics(timestamptz, timestamptz) to authenticated;
