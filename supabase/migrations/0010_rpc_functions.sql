-- 0010_rpc_functions.sql
-- Server-callable RPCs. These are SECURITY INVOKER by default (they run as
-- the calling user and are still subject to RLS) except the two used by the
-- public /go/[slug] redirect route, which must read/write past RLS in a
-- narrowly-scoped way and are explicitly marked SECURITY DEFINER below.

-- The one function the Owner Admin's "Add Product" form calls. Takes only
-- name + affiliate URL, does everything else: slug, status, linked
-- affiliate_links row, all in one transaction.
create or replace function public.create_product(
  p_name text,
  p_affiliate_url text
)
returns public.products
language plpgsql
as $$
declare
  v_product public.products;
  v_clean_url text := trim(p_affiliate_url);
begin
  if not public.is_owner() then
    raise exception 'Only the owner can create products';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Product name is required';
  end if;

  if v_clean_url !~* '^https?://[^\s]+$' then
    raise exception 'Affiliate URL must be a valid http(s) URL';
  end if;

  insert into public.products (name, slug, status, created_by)
  values (p_name, public.next_unique_slug(p_name, 'products'), 'new', auth.uid())
  returning * into v_product;

  insert into public.affiliate_links (product_id, destination_url, is_active, created_by)
  values (v_product.id, v_clean_url, true, auth.uid());

  return v_product;
end;
$$;

revoke all on function public.create_product(text, text) from public;
grant execute on function public.create_product(text, text) to authenticated;

-- Rotates a product's affiliate URL: deactivates the current link (kept for
-- history) and inserts a new active one.
create or replace function public.update_product_affiliate_url(
  p_product_id uuid,
  p_new_url text
)
returns public.affiliate_links
language plpgsql
as $$
declare
  v_clean_url text := trim(p_new_url);
  v_link public.affiliate_links;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can change affiliate URLs';
  end if;

  if v_clean_url !~* '^https?://[^\s]+$' then
    raise exception 'Affiliate URL must be a valid http(s) URL';
  end if;

  update public.affiliate_links
    set is_active = false
    where product_id = p_product_id and is_active;

  insert into public.affiliate_links (product_id, destination_url, is_active, created_by)
  values (p_product_id, v_clean_url, true, auth.uid())
  returning * into v_link;

  return v_link;
end;
$$;

revoke all on function public.update_product_affiliate_url(uuid, text) from public;
grant execute on function public.update_product_affiliate_url(uuid, text) to authenticated;

-- Used by the /go/[slug] Route Handler. SECURITY DEFINER so the anon/
-- authenticated caller never needs a direct SELECT grant on affiliate_links
-- (which stays owner-only) — this function only ever returns a URL for a
-- product that is active, not soft-deleted, has an active link, AND has
-- published content — i.e. the exact same two-gate rule that governs
-- whether the product is publicly visible at all (products_public_select in
-- 0011). Without the product_content check here, a product not yet
-- content-published (so invisible on the site) could still have its real
-- affiliate URL resolved, and clicks recorded against it, by anyone who
-- knew or guessed its slug and called this RPC directly.
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
  join public.product_content pc on pc.product_id = p.id and pc.status = 'published'
  where p.slug = p_slug
    and p.status = 'active'
    and p.deleted_at is null;
$$;

revoke all on function public.get_active_affiliate_link(text) from public;
grant execute on function public.get_active_affiliate_link(text) to anon, authenticated;

-- Used by the /go/[slug] Route Handler to log a click. SECURITY DEFINER so
-- anonymous visitors can record a click without any client-side INSERT
-- grant on affiliate_clicks (which would otherwise allow spoofed rows).
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
    v_product_id, p_referrer, p_landing_page, p_cta_location,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content, p_device_type
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
