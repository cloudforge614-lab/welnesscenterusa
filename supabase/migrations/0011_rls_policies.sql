-- 0011_rls_policies.sql
-- Centralized RLS policies for every table. RLS was already enabled on each
-- table in its own migration; this file is the single place to audit "who
-- can do what." Policy naming convention: <table>_<role-group>_<action>.
--
-- Role model recap:
--   owner            full read/write everywhere (superuser within the app)
--   agency_admin     read/write on all content + SEO tables, no products/
--                    affiliate_links/profiles/audit_logs/affiliate_clicks write
--   seo_editor       read/write on seo_metadata, redirects, categories; else read-only
--   content_editor   read/write on product content + editorial tables; no SEO write
--   authenticated    (any signed-in agency/owner user) generally read-only elsewhere
--   anon/public      read-only on published content only

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_owner_select on public.profiles
  for select using (public.is_owner());

create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());

create policy profiles_owner_update on public.profiles
  for update using (public.is_owner());

create policy profiles_self_update_own_name on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
  -- role changes are blocked by the guard_profile_role_change trigger even
  -- though this policy technically allows the UPDATE statement to run.

create policy profiles_owner_delete on public.profiles
  for delete using (public.is_owner());

-- ---------------------------------------------------------------------------
-- categories (public taxonomy, no draft state)
-- ---------------------------------------------------------------------------
create policy categories_public_select on public.categories
  for select using (true);

create policy categories_manage on public.categories
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

create policy categories_update on public.categories
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

create policy categories_delete on public.categories
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- products (owner-only write; public sees only active + not deleted, and
-- only once content is published — enforced by joining product_content in
-- the query layer; the RLS check here only guards the product row itself)
--
-- Deliberately no DELETE policy: `products` is the root entity everything
-- else (affiliate_clicks, product_content/images/faqs/benefits/ingredients,
-- reviews, product_categories, comparison/article/guide relations) cascades
-- from. A hard DELETE here would silently destroy affiliate click history
-- and published SEO content. `deleted_at` (soft delete, owner can set it
-- via UPDATE) is the only supported removal path from the API; a true hard
-- delete is a deliberate out-of-band DB operation, not something the app
-- can trigger.
--
-- Phase 2 note: Postgres RLS enforces DELETE (and SELECT) through USING
-- only — there is no WITH CHECK step to fail the way there is for INSERT/
-- UPDATE. With zero DELETE policies here, a DELETE against `products`
-- doesn't error; it just matches zero rows and returns success. Client
-- code must never infer "blocked" from the absence of an error — check
-- that the row still exists (or just never call delete() on this table
-- and only ever UPDATE deleted_at).
-- ---------------------------------------------------------------------------
create policy products_owner_select on public.products
  for select using (public.is_owner());

create policy products_owner_insert on public.products
  for insert with check (public.is_owner());

create policy products_owner_update on public.products
  for update using (public.is_owner()) with check (public.is_owner());

create policy products_agency_select on public.products
  for select using (public.is_agency());

create policy products_public_select on public.products
  for select using (
    status = 'active'
    and deleted_at is null
    and exists (
      select 1 from public.product_content pc
      where pc.product_id = products.id and pc.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- affiliate_links (owner only, full stop — no agency access, no public
-- table access; the public redirect flow goes exclusively through the
-- SECURITY DEFINER get_active_affiliate_link()/record_affiliate_click() RPCs)
-- ---------------------------------------------------------------------------
create policy affiliate_links_owner_all on public.affiliate_links
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------
create policy product_categories_select on public.product_categories
  for select using (
    public.is_owner() or public.is_agency()
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active' and p.deleted_at is null)
  );

create policy product_categories_manage on public.product_categories
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy product_categories_update on public.product_categories
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy product_categories_delete on public.product_categories
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- product_content
-- ---------------------------------------------------------------------------
create policy product_content_owner_all on public.product_content
  for all using (public.is_owner()) with check (public.is_owner());

create policy product_content_agency_select on public.product_content
  for select using (public.is_agency());

create policy product_content_public_select on public.product_content
  for select using (status = 'published');

create policy product_content_agency_write on public.product_content
  for insert with check (public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy product_content_agency_update on public.product_content
  for update using (public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy product_content_agency_delete on public.product_content
  for delete using (public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- product_images / product_faqs / product_benefits / product_ingredients
-- Same shape for all four: public sees rows whose parent product_content is
-- published; owner sees/writes everything; agency_admin + content_editor
-- write; seo_editor read-only.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['product_images','product_faqs','product_benefits','product_ingredients']
  loop
    execute format(
      'create policy %I on public.%I for all using (public.is_owner()) with check (public.is_owner());',
      t || '_owner_all', t
    );

    execute format(
      'create policy %I on public.%I for select using (public.is_agency());',
      t || '_agency_select', t
    );

    execute format(
      'create policy %I on public.%I for select using (
         exists (
           select 1 from public.product_content pc
           where pc.product_id = %I.product_id and pc.status = ''published''
         )
       );',
      t || '_public_select', t, t
    );

    execute format(
      'create policy %I on public.%I for insert with check (public.has_any_role(array[''agency_admin'',''content_editor'']::public.user_role[]));',
      t || '_agency_write', t
    );

    execute format(
      'create policy %I on public.%I for update using (public.has_any_role(array[''agency_admin'',''content_editor'']::public.user_role[]));',
      t || '_agency_update', t
    );

    execute format(
      'create policy %I on public.%I for delete using (public.has_any_role(array[''agency_admin'',''content_editor'']::public.user_role[]));',
      t || '_agency_delete', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- reviews / comparisons / articles / guides
-- Same shape: public sees published; owner full; agency_admin + content_editor
-- write; seo_editor read-only.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['reviews','comparisons','articles','guides']
  loop
    execute format(
      'create policy %I on public.%I for all using (public.is_owner()) with check (public.is_owner());',
      t || '_owner_all', t
    );

    execute format(
      'create policy %I on public.%I for select using (public.is_agency());',
      t || '_agency_select', t
    );

    execute format(
      'create policy %I on public.%I for select using (status = ''published'');',
      t || '_public_select', t
    );

    execute format(
      'create policy %I on public.%I for insert with check (public.has_any_role(array[''agency_admin'',''content_editor'']::public.user_role[]));',
      t || '_agency_write', t
    );

    execute format(
      'create policy %I on public.%I for update using (public.has_any_role(array[''agency_admin'',''content_editor'']::public.user_role[]));',
      t || '_agency_update', t
    );

    execute format(
      'create policy %I on public.%I for delete using (public.has_any_role(array[''agency_admin'',''content_editor'']::public.user_role[]));',
      t || '_agency_delete', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- comparison_products / article_related_products / guide_related_products
-- Visibility follows the parent; write follows the same agency roles as
-- their parent editorial table.
-- ---------------------------------------------------------------------------
create policy comparison_products_select on public.comparison_products
  for select using (
    public.is_owner() or public.is_agency()
    or exists (select 1 from public.comparisons c where c.id = comparison_id and c.status = 'published')
  );

create policy comparison_products_manage on public.comparison_products
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy comparison_products_update on public.comparison_products
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy comparison_products_delete on public.comparison_products
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy article_related_products_select on public.article_related_products
  for select using (
    public.is_owner() or public.is_agency()
    or exists (select 1 from public.articles a where a.id = article_id and a.status = 'published')
  );

create policy article_related_products_manage on public.article_related_products
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy article_related_products_update on public.article_related_products
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy article_related_products_delete on public.article_related_products
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy guide_related_products_select on public.guide_related_products
  for select using (
    public.is_owner() or public.is_agency()
    or exists (select 1 from public.guides g where g.id = guide_id and g.status = 'published')
  );

create policy guide_related_products_manage on public.guide_related_products
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy guide_related_products_update on public.guide_related_products
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

create policy guide_related_products_delete on public.guide_related_products
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- seo_metadata (agency_admin + seo_editor write; content_editor read-only;
-- public read is fine — it's non-sensitive page metadata)
-- ---------------------------------------------------------------------------
create policy seo_metadata_public_select on public.seo_metadata
  for select using (true);

create policy seo_metadata_write on public.seo_metadata
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

create policy seo_metadata_update on public.seo_metadata
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

create policy seo_metadata_delete on public.seo_metadata
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- redirects (agency_admin + seo_editor write; public read needed to resolve
-- redirects at request time)
-- ---------------------------------------------------------------------------
create policy redirects_public_select on public.redirects
  for select using (is_active);

create policy redirects_agency_select on public.redirects
  for select using (public.is_owner() or public.is_agency());

create policy redirects_write on public.redirects
  for insert with check (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

create policy redirects_update on public.redirects
  for update using (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

create policy redirects_delete on public.redirects
  for delete using (public.is_owner() or public.has_any_role(array['agency_admin','seo_editor']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- audit_logs: owner read-only; no client write policy at all (writes are
-- via the SECURITY DEFINER write_audit_log() trigger function only)
-- ---------------------------------------------------------------------------
create policy audit_logs_owner_select on public.audit_logs
  for select using (public.is_owner());

-- ---------------------------------------------------------------------------
-- affiliate_clicks: owner read-only; no client write policy (writes are via
-- the SECURITY DEFINER record_affiliate_click() RPC only)
-- ---------------------------------------------------------------------------
create policy affiliate_clicks_owner_select on public.affiliate_clicks
  for select using (public.is_owner());
