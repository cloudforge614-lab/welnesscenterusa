-- 0025_product_directory_and_categories.sql
-- Public product directory + category system.
--
-- ROOT CAUSES THIS FIXES
--  A. /products (and category pages and search) read `products` through a
--     PostgREST INNER JOIN on product_content with status = 'published'. The
--     homepage, since 0022, reads through get_homepage_products() which does
--     not. So an Owner-added product with no published Agency content showed
--     on the homepage but never in the directory. (product_images' own public
--     policy also keys on published content, so even a loosened products query
--     could not have shown the image.)
--  B. The `categories` table was empty in production, and /categories only
--     lists categories that have at least one *published-content* product.
--
-- WHAT THIS MIGRATION DOES (additive; no RLS/policy/table change)
--  1. Seeds the 17 approved categories with stable explicit slugs. Idempotent
--     (skips a slug that already exists), never touches existing rows.
--  2. get_public_products(): the directory read path — active + not deleted,
--     NO content requirement — with database pagination, optional category
--     and name/slug search filters, and a total_count for the pager. Returns
--     the same safe fields as get_homepage_products (0024), including the
--     has_affiliate_link / has_published_content booleans, and never any
--     destination URL.
--  3. get_public_categories(): every category (an empty one still exists) with
--     a live product_count of active, non-deleted products.
--
-- The product DETAIL page and the sitemap keep requiring published content;
-- that distinction is intentional and untouched here.

insert into public.categories (name, slug)
select v.name, v.slug
from (values
  ('Addiction',            'addiction'),
  ('Beauty',               'beauty'),
  ('Dental Health',        'dental-health'),
  ('Dietary Supplements',  'dietary-supplements'),
  ('Diets & Weight Loss',  'diets-weight-loss'),
  ('Exercise & Fitness',   'exercise-fitness'),
  ('General',              'general'),
  ('Meditation',           'meditation'),
  ('Men''s Health',        'mens-health'),
  ('Mental Health',        'mental-health'),
  ('Nutrition',            'nutrition'),
  ('Remedies',             'remedies'),
  ('Sleep and Dreams',     'sleep-and-dreams'),
  ('Spiritual Health',     'spiritual-health'),
  ('Strength Training',    'strength-training'),
  ('Women''s Health',      'womens-health'),
  ('Yoga',                 'yoga')
) as v(name, slug)
where not exists (select 1 from public.categories c where c.slug = v.slug);

create or replace function public.get_public_products(
  p_limit int default 24,
  p_offset int default 0,
  p_category_id uuid default null,
  p_search text default null
)
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
  has_published_content boolean,
  total_count bigint
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
    pc.id is not null,
    count(*) over ()
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
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) order by c.name) as categories
    from public.product_categories pcat
    join public.categories c on c.id = pcat.category_id
    where pcat.product_id = p.id
  ) cats on true
  where p.status = 'active'
    and p.deleted_at is null
    and (
      p_category_id is null
      or exists (
        select 1 from public.product_categories f
        where f.product_id = p.id and f.category_id = p_category_id
      )
    )
    and (
      nullif(btrim(p_search), '') is null
      -- LIKE metacharacters in the caller's term are escaped, so it can only
      -- ever be a plain substring match.
      or p.name ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or p.slug ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by p.created_at desc, p.id
  -- Clamped rather than trusted: this is anon-callable.
  limit greatest(least(coalesce(p_limit, 24), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_public_products(int, int, uuid, text) from public, anon;
grant execute on function public.get_public_products(int, int, uuid, text) to anon, authenticated;

create or replace function public.get_public_categories()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  product_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.description,
    (
      select count(*)
      from public.product_categories pc
      join public.products p on p.id = pc.product_id
      where pc.category_id = c.id
        and p.status = 'active'
        and p.deleted_at is null
    )
  from public.categories c
  order by c.name;
$$;

revoke all on function public.get_public_categories() from public, anon;
grant execute on function public.get_public_categories() to anon, authenticated;
