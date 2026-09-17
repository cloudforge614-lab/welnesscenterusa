-- 0021_owner_rpc_guard_and_grants.sql
-- Phase 7.12. Closes the carried-forward finding from Step 7.8 on the two
-- owner-only mutation RPCs, before production.
--
-- ── WHAT IS ACTUALLY WRONG ─────────────────────────────────────────────────
--
-- Both functions guard themselves with:
--
--     if not public.is_owner() then raise exception ...
--
-- is_owner() is `current_user_role() = 'owner'`, and current_user_role()
-- reads the caller's profiles row. A caller with no profile row — anon, or a
-- signed-up user whose role is still NULL — has no row, so the comparison
-- yields NULL, not false. In plpgsql `if not NULL` is `if NULL`, which does
-- not fire. The guard is therefore inert for exactly the callers it most
-- needs to stop, and fires correctly only for a caller who already has some
-- other role. This is the same three-valued-logic bug found and fixed in
-- 0018; these two predate it.
--
-- Compounding it, `revoke all ... from public` does not remove anon's own
-- grant. Supabase grants EXECUTE to anon and authenticated at the platform
-- level before these migrations run, and revoking from PUBLIC leaves that
-- direct grant in place. So anon can call both functions, and the owner
-- check does not stop it.
--
-- ── WHY THIS IS NOT CURRENTLY EXPLOITABLE, AND WHY IT IS STILL FIXED ───────
--
-- Measured against the dev project, anon calling either function today gets:
--
--     42501  permission denied for table products
--     42501  permission denied for table affiliate_links
--
-- — not the function's own "Only the owner can ..." message. That is the
-- point. Anon passes the owner check and is stopped further in, by the
-- table-level `revoke insert, update, delete ... from anon` in 0012, which is
-- a coarse backstop that exists for unrelated reasons. No unauthorized
-- mutation occurs, so this is not a live breach.
--
-- It is still fixed before production because the intended control is doing
-- nothing, and the only thing actually holding is a grant that a future
-- migration could widen without anyone connecting the two. These functions
-- mint and rotate affiliate destination URLs — the revenue-critical secret
-- this entire architecture is built to keep server-side. A single remaining
-- layer is too thin there.
--
-- (The other two RPCs in 0010, get_active_affiliate_link and
-- record_affiliate_click, are deliberately anon-callable and are NOT touched.
-- Both test with `is null`, which is two-valued and safe, and both are scoped
-- by the same two-gate rule as the public site. 0018's owner_click_analytics
-- already uses the correct form. A grep for the `if not public.is_` signature
-- across all migrations returns exactly the two functions below.)
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
--
-- 1. `is not true` instead of `not ...`. NULL is not true, so a caller with
--    no role is now rejected by the function's own guard, at the top, before
--    it touches a table.
-- 2. Revoke EXECUTE from anon explicitly as well as PUBLIC.
--
-- Behaviour for every legitimate caller is unchanged: the owner still passes,
-- and agency_admin / content_editor / seo_editor still get the same P0001
-- "Only the owner can ..." error they get today. The bodies are otherwise
-- reproduced verbatim from 0010.

-- ── create_product ─────────────────────────────────────────────────────────
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
  -- "is not true", not "not ...": is_owner() is NULL for a caller with no
  -- profiles row, and `if not NULL` never fires. See the header.
  if public.is_owner() is not true then
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

-- `from public, anon`: revoking from PUBLIC alone leaves anon's own
-- platform-level grant untouched. authenticated keeps EXECUTE because the
-- owner is an authenticated user and the Owner Admin's server action calls
-- this with the owner's session; the in-function owner check above is the
-- control that distinguishes them.
revoke all on function public.create_product(text, text) from public, anon;
grant execute on function public.create_product(text, text) to authenticated;

-- ── update_product_affiliate_url ───────────────────────────────────────────
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
  -- See the note in create_product above.
  if public.is_owner() is not true then
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

revoke all on function public.update_product_affiliate_url(uuid, text) from public, anon;
grant execute on function public.update_product_affiliate_url(uuid, text) to authenticated;
