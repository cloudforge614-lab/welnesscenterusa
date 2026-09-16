-- 0015_storage_path_scoping.sql
-- Drafted during Phase 5 step 1 (Reviews), applied now at the Guides step
-- since Guides is the first content type that actually needs image upload.
-- Re-verified live via pg_policies immediately before writing this file —
-- unchanged since the draft: role-only checks, zero path restriction.
--
-- reviews has no image column, so it is deliberately excluded from the path
-- allowlist below — there is nothing for it to upload.
--
-- INSERT is fully scoped: the path's top folder must be one of the three
-- entity types that actually have an image column (products, articles,
-- guides), and the id segment must reference a real existing row in that
-- table. This is what stops an agency user from writing to an arbitrary
-- unrelated path — role membership alone (the previous policy) was not
-- sufficient, since it let any agency_admin/content_editor write literally
-- any object key in the bucket.
--
-- UPDATE/DELETE intentionally check only the folder prefix, not row
-- existence: the app's deleteProductImage-style actions remove the DB row
-- first, then best-effort clean up the storage object — requiring the row
-- to still exist at that point would make the object permanently
-- undeletable and leak orphaned files.

drop policy product_images_bucket_write on storage.objects;
create policy product_images_bucket_write on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
    and (
      ((storage.foldername(name))[1] = 'products'
        and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2]))
      or ((storage.foldername(name))[1] = 'articles'
        and exists (select 1 from public.articles a where a.id::text = (storage.foldername(name))[2]))
      or ((storage.foldername(name))[1] = 'guides'
        and exists (select 1 from public.guides g where g.id::text = (storage.foldername(name))[2]))
    )
  );

drop policy product_images_bucket_update on storage.objects;
create policy product_images_bucket_update on storage.objects
  for update using (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
    and (storage.foldername(name))[1] in ('products','articles','guides')
  );

drop policy product_images_bucket_delete on storage.objects;
create policy product_images_bucket_delete on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
    and (storage.foldername(name))[1] in ('products','articles','guides')
  );

-- product_images_bucket_read is unchanged: the bucket stays fully public
-- read, any role, any path (including anon) — these are non-sensitive
-- editorial/marketing images, not affiliate URLs, and the public site
-- already renders product images by treating storage_path as a direct,
-- unauthenticated URL. A draft guide/article's image is therefore still
-- fetchable by anyone who has or guesses its exact object path even though
-- the guide/article page itself 404s — the same accepted trade-off already
-- shipped for paused products in Phase 4, not a new exposure introduced
-- here. Making the bucket private isn't warranted: verified deliberately,
-- not an oversight.
