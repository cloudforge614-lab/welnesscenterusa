-- 0023_homepage_affiliate_cta.sql
-- Homepage product cards get an affiliate CTA that points at /go/[slug].
--
-- WHY A MIGRATION IS REQUIRED (Owner-approved change)
-- Owner-created and bulk-imported products go live on the homepage as teaser
-- cards WITHOUT published Agency content (0022). /go/[slug] resolves its
-- destination through get_active_affiliate_link() and records the click
-- through record_affiliate_click(); both required published content (0010,
-- 0017), so for exactly those products /go returned 404 and no click could be
-- recorded — a CTA on the card would have been a dead link.
--
-- This migration makes three changes, and nothing else:
--
--  1. get_active_affiliate_link(): eligibility becomes  active product +
--     not soft-deleted + active affiliate link.  The published-content join is
--     removed. A product that is 'new', 'paused' or 'archived', a deleted
--     product, or one with no active link still resolves to nothing, exactly as
--     before. Content-less *active* products are now resolvable — the same rule
--     the homepage feed (0022) already applies to whether a card is visible at
--     all, so /go and the card now agree.
--
--  2. record_affiliate_click(): same eligibility change, everything else
--     (input clamping from 0017, SECURITY DEFINER, search_path, grants,
--     owner-only affiliate_clicks RLS, return value) is byte-for-byte the
--     0017 definition.
--
--  3. get_homepage_products(): adds `has_affiliate_link boolean`, true when the
--     product has an active affiliate link. It is a boolean ONLY — the
--     destination URL is never selected. The card uses it to decide whether to
--     render the CTA. CREATE OR REPLACE cannot change a function's result
--     columns, hence drop + create; grants are restated and identical to 0022.
--
-- Untouched: every RLS policy, storage policy, table, and affiliate_links'
-- owner-only access. anon still has no SELECT on affiliate_links; the URL is
-- only ever returned by get_active_affiliate_link() to the /go route handler,
-- which turns it into a redirect Location header.

create or replace function public.get_active_affiliate_link(p_slug text)
returns table (product_id uuid, destination_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, al.destination_url
  from public.products p
  join public.affiliate_links al on al.product_id = p.id and al.is_active
  where p.slug = p_slug
    and p.status = 'active'
    and p.deleted_at is null;
$$;

revoke all on function public.get_active_affiliate_link(text) from public;
grant execute on function public.get_active_affiliate_link(text) to anon, authenticated;

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
  -- Eligibility now mirrors get_active_affiliate_link(): active, not deleted,
  -- and carrying an active affiliate link. A click can only be recorded for a
  -- product a visitor could actually be redirected for.
  select p.id into v_product_id
  from public.products p
  where p.slug = p_slug
    and p.status = 'active'
    and p.deleted_at is null
    and exists (
      select 1 from public.affiliate_links al
      where al.product_id = p.id and al.is_active
    );

  if v_product_id is null then
    raise exception 'Unknown or inactive product slug: %', p_slug;
  end if;

  insert into public.affiliate_clicks (
    product_id, referrer, landing_page, cta_location,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, device_type
  )
  values (
    v_product_id,
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

revoke all on function public.record_affiliate_click(
  text, text, text, text, text, text, text, text, text, public.device_type
) from public;
grant execute on function public.record_affiliate_click(
  text, text, text, text, text, text, text, text, text, public.device_type
) to anon, authenticated;

drop function if exists public.get_homepage_products(int);

create function public.get_homepage_products(p_limit int default 8)
returns table (
  id uuid,
  name text,
  slug text,
  overview text,
  image_path text,
  image_alt text,
  categories jsonb,
  created_at timestamptz,
  has_affiliate_link boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.slug,
    pc.overview,
    pi.storage_path,
    pi.alt_text,
    coalesce(cats.categories, '[]'::jsonb),
    p.created_at,
    exists (
      select 1 from public.affiliate_links al
      where al.product_id = p.id and al.is_active
    )
  from public.products p
  left join public.product_content pc
    on pc.product_id = p.id and pc.status = 'published'
  left join lateral (
    select storage_path, alt_text
    from public.product_images
    where product_id = p.id
    order by is_primary desc, position asc
    limit 1
  ) pi on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)) as categories
    from public.product_categories pcat
    join public.categories c on c.id = pcat.category_id
    where pcat.product_id = p.id
  ) cats on true
  where p.status = 'active'
    and p.deleted_at is null
  order by p.created_at desc
  limit greatest(least(coalesce(p_limit, 8), 50), 1);
$$;

revoke all on function public.get_homepage_products(int) from public, anon;
grant execute on function public.get_homepage_products(int) to anon, authenticated;
