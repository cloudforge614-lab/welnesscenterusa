-- 0016_fix_storage_path_scoping_shadowing.sql
-- Fixes a column-shadowing bug in 0015's INSERT policy, found immediately
-- after applying it by re-reading the live policy back from pg_policies
-- (not just trusting the migration file).
--
-- 0015 wrote `storage.foldername(name)` unqualified inside each branch's
-- correlated EXISTS subquery. For the 'articles' and 'guides' branches this
-- correctly resolved to the outer storage.objects.name, because neither
-- table has a column called `name` (they use `title`). But `products` DOES
-- have a `name` column — so inside `exists (select 1 from products p where
-- p.id::text = (storage.foldername(name))[2])`, Postgres resolved the bare
-- `name` to the innermost matching column, p.name (the product's own text
-- name), not the outer objects.name. Confirmed by reading the applied
-- policy back: it showed `storage.foldername(p.name)`. A product's name
-- text never equals a path's UUID segment, so the 'products' branch of
-- INSERT never matched anything — silently blocking all product image
-- uploads (a live regression against existing Phase 4 functionality) for
-- the short window between 0015 and this fix.
--
-- Fix: qualify every reference as storage.objects.name explicitly, in all
-- three branches, so there is no ambiguity regardless of what columns the
-- joined table happens to have.

drop policy product_images_bucket_write on storage.objects;
create policy product_images_bucket_write on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
    and (
      ((storage.foldername(storage.objects.name))[1] = 'products'
        and exists (select 1 from public.products p where p.id::text = (storage.foldername(storage.objects.name))[2]))
      or ((storage.foldername(storage.objects.name))[1] = 'articles'
        and exists (select 1 from public.articles a where a.id::text = (storage.foldername(storage.objects.name))[2]))
      or ((storage.foldername(storage.objects.name))[1] = 'guides'
        and exists (select 1 from public.guides g where g.id::text = (storage.foldername(storage.objects.name))[2]))
    )
  );
