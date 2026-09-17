-- 0017_click_integrity.sql
-- Phase 7.7. Two changes, both narrow.
--
-- 1. Drop affiliate_clicks.ip_hash.
--
--    The column was declared in 0009 and never written by anything —
--    record_affiliate_click() has never accepted or set it, and no application
--    code referenced it (verified against the live dev database before writing
--    this: 296 click rows, zero with a non-null ip_hash).
--
--    It is being removed rather than finally put to use. Populating it would
--    have meant introducing this project's first server-side secret to key an
--    HMAC — Step 7.1 deliberately removed the only two secrets the codebase
--    had — and storing a persistent per-visitor identifier that links one
--    click to another. That is pseudonymous personal data, and it would
--    directly contradict the privacy policy's "there is nothing in it that
--    links one click to another". The abuse it would have mitigated is
--    inflation of an internal metric, not revenue: merchants pay on
--    conversions they measure themselves, not on click counts held here.
--    Filtering automated traffic in the application removes most of the same
--    noise at no privacy cost.
--
--    Dropping the column makes that guarantee structural instead of merely
--    conventional: there is now nowhere in this table to put an IP, so a
--    future change cannot quietly start storing one without a migration that
--    has to be justified on its own.
--
-- 2. Clamp attribution inputs inside record_affiliate_click().
--
--    The RPC is granted to anon by design, because /go/[slug] resolves as the
--    visitor. That means the attribution arguments are caller-supplied and,
--    until now, unbounded text. An abuser calling the RPC directly could store
--    arbitrarily large values. Clamping bounds that storage-abuse surface and
--    keeps obviously junk attribution out of the owner's data, without
--    changing anything about legitimate values — real referrers, landing paths,
--    CTA labels and UTM tags all sit far inside these limits.
--
--    This does NOT stop a determined caller from recording clicks directly
--    against the Supabase REST endpoint; nothing at the application layer can,
--    since that endpoint is not behind this origin. Eligibility is still
--    enforced (below), so the blast radius is inflated counts for products
--    that are already public, with no access to affiliate URLs and no read
--    access to affiliate_clicks. Durable protection there is Supabase API
--    rate limiting plus edge rules, which is a Step 7.12 deployment task.
--
-- Everything else about the function is deliberately unchanged: SECURITY
-- DEFINER, search_path = public, the full two-gate eligibility check, the
-- owner-only RLS on affiliate_clicks, and the fact that it returns only the
-- new row's id and never any analytics.

alter table public.affiliate_clicks drop column if exists ip_hash;

create or replace function public.record_affiliate_click(
  p_slug text,
  p_referrer text default null,
  p_landing_page text default null,
  p_cta_location text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_term text default null,
  p_utm_content text default null,
  p_device_type public.device_type default 'unknown'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_click_id uuid;
begin
  -- Unchanged two-gate eligibility check. A click can only ever be recorded
  -- against a product that is active, not soft-deleted, and content-published
  -- — i.e. one that is genuinely publicly visible.
  select p.id into v_product_id
  from public.products p
  join public.product_content pc on pc.product_id = p.id and pc.status = 'published'
  where p.slug = p_slug and p.status = 'active' and p.deleted_at is null;

  if v_product_id is null then
    raise exception 'Unknown or inactive product slug: %', p_slug;
  end if;

  insert into public.affiliate_clicks (
    product_id, referrer, landing_page, cta_location,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, device_type
  )
  values (
    v_product_id,
    -- left() over a trimmed value, with empty collapsing to NULL so a blank
    -- string is not stored as if it were an observation. Limits are generous
    -- enough that no legitimate value is truncated: 2048 is a practical URL
    -- ceiling, 1024 covers any internal path plus query, and CTA labels are
    -- short identifiers chosen by us, not by the caller.
    left(nullif(btrim(p_referrer), ''), 2048),
    left(nullif(btrim(p_landing_page), ''), 1024),
    left(nullif(btrim(p_cta_location), ''), 64),
    left(nullif(btrim(p_utm_source), ''), 255),
    left(nullif(btrim(p_utm_medium), ''), 255),
    left(nullif(btrim(p_utm_campaign), ''), 255),
    left(nullif(btrim(p_utm_term), ''), 255),
    left(nullif(btrim(p_utm_content), ''), 255),
    p_device_type
  )
  returning id into v_click_id;

  return v_click_id;
end;
$$;

-- Restated rather than relied upon. CREATE OR REPLACE preserves existing
-- privileges, but spelling them out keeps this migration reproducible against
-- a fresh project and makes the intended grant visible in one place.
revoke all on function public.record_affiliate_click(
  text, text, text, text, text, text, text, text, text, public.device_type
) from public;
grant execute on function public.record_affiliate_click(
  text, text, text, text, text, text, text, text, text, public.device_type
) to anon, authenticated;
