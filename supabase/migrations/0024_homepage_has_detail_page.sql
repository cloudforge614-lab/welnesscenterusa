-- 0024_homepage_has_detail_page.sql
-- get_homepage_products() gains `has_published_content boolean`.
--
-- WHY: a homepage teaser card is visible for any ACTIVE product (0022), but the
-- product's detail page (/products/[slug]) still — deliberately — requires
-- published Agency content. For a content-less product the card's "View
-- product" link therefore pointed at a 404. The card needs to know whether a
-- detail page exists so it can omit that link (the affiliate CTA is unaffected).
--
-- A boolean only; no affiliate data, no RLS change. Same SECURITY DEFINER,
-- search_path and grants as 0022/0023. CREATE OR REPLACE cannot change result
-- columns, hence drop + create.

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
  has_affiliate_link boolean,
  has_published_content boolean
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
    ),
    pc.id is not null
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
