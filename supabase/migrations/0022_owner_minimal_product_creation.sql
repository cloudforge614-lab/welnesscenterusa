-- 0022_owner_minimal_product_creation.sql
-- Owner minimal product creation workflow: Name + main image + Affiliate URL,
-- immediately live on the homepage as a teaser card without waiting for
-- Agency content.
--
-- One database change. It does not touch an existing RLS policy, and it does
-- NOT touch create_product: an earlier version of this migration changed
-- create_product's own default insert status from 'new' to 'active', on the
-- reasoning that the new 3-field dialog should result in an immediately-live
-- product. That reasoning was right for the new dialog specifically, but
-- create_product is the ONE product-creation RPC in the system — every
-- existing caller (every earlier phase's test fixtures, and any future one)
-- goes through it too, so that change silently made EVERY owner-created
-- product auto-activate, not just ones from the new dialog. Phase 4's own
-- regression suite caught this immediately: it depends on the existing
-- "create as 'new' -> Agency publishes -> owner explicitly Activates" review
-- gate, which the broadened change quietly removed.
--
-- The fix is architectural, not cosmetic: create_product's default stays
-- 'new', exactly as it was, and "auto-activate on creation" is applied only
-- where it was actually asked for — inside the new dialog's own server
-- action (src/app/admin/actions.ts createProduct()), as an explicit second
-- write, immediately after the required image upload succeeds. Every other
-- caller of create_product is completely unaffected.

-- ═══════════════════════════════════════════════════════════════════════════
-- get_homepage_products(): a narrow, additive read path for the homepage
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE PROBLEM THIS SOLVES
-- The homepage's "Latest products" feed previously read straight from
-- `products` (via products_public_select, 0011) with an INNER JOIN on
-- product_content requiring status = 'published'. That two-gate rule is
-- exactly right for the product's own detail page and the sitemap — an
-- incomplete product must not be independently discoverable or indexable —
-- but it also meant a homepage card could never appear before Agency wrote
-- content, defeating the point of the Owner's fast-add flow.
--
-- Worse, even a plain SELECT can't get there: product_images' own public
-- policy (the do $$ loop in 0011 covering product_images/faqs/benefits/
-- ingredients) *also* keys on product_content.status = 'published', not the
-- parent product's status — so even if products_public_select were loosened,
-- the primary image row would still be invisible to anon for a content-less
-- product.
--
-- WHY A NEW FUNCTION, NOT A LOOSENED RLS POLICY
-- Loosening products_public_select and the product_images public-select
-- policy to drop the content requirement would fix this, but it is a much
-- bigger, permanent change to the general-purpose security boundary those
-- policies are — every future consumer of a raw `products`/`product_images`
-- select would inherit the loosened rule forever, and detail-page/sitemap
-- code would then have to defensively re-apply the content check themselves
-- to avoid regressing (some of it already does, per the comment atop
-- src/lib/products/public-queries.ts, but not all paths).
--
-- This project already has a precedent for exactly this situation:
-- get_active_affiliate_link (0010) is a narrow, hand-audited SECURITY
-- DEFINER function that lets anon read past the normal boundary for one
-- specific, tightly-scoped purpose, rather than loosening affiliate_links'
-- RLS. get_homepage_products follows the same pattern: RLS on products and
-- product_images is completely untouched by this migration, and everything
-- that depends on it — the product detail page, the sitemap, category
-- pages — keeps requiring published content exactly as before.
--
-- WHAT IT EXPOSES, AND WHY THAT'S SAFE
-- Only id, name, slug, created_at, the primary image (LATERAL, ORDER BY
-- is_primary desc, position asc, LIMIT 1 — one row per product, no N+1),
-- overview (LEFT JOINed against product_content with the *published* filter
-- baked into the JOIN condition, so it's populated exactly when the old
-- query would have shown an excerpt, and NULL otherwise — this is what
-- keeps existing published products' excerpts from regressing), and
-- categories (LEFT JOIN LATERAL + jsonb_agg, same reasoning: preserves
-- category chips for products that already have them assigned). It never
-- selects from affiliate_links, never returns anything that could be
-- confused with a merchant destination.
--
-- WHY status = 'active' AND deleted_at IS NULL, WITH NO CONTENT CHECK
-- This is the actual, deliberate rule change the Owner's new workflow needs:
-- a homepage teaser card requires only that the owner marked the product
-- active and it isn't soft-deleted. It does not require, and must not
-- require, published content — that's the whole point.
create or replace function public.get_homepage_products(p_limit int default 8)
returns table (
  id uuid,
  name text,
  slug text,
  overview text,
  image_path text,
  image_alt text,
  categories jsonb,
  created_at timestamptz
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
    p.created_at
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
  -- Clamped rather than trusted: this is anon-callable, so an unreasonable
  -- caller-supplied limit (huge, zero, negative) is normalized rather than
  -- passed straight to the database.
  limit greatest(least(coalesce(p_limit, 8), 50), 1);
$$;

-- anon+authenticated, matching get_active_affiliate_link's grant shape —
-- this is meant to be publicly callable. Revoked from public/anon first
-- anyway, for consistency with this project's established convention of
-- never relying on Supabase's platform-level default grant.
revoke all on function public.get_homepage_products(int) from public, anon;
grant execute on function public.get_homepage_products(int) to anon, authenticated;
