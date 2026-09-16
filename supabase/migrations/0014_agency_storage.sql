-- 0014_agency_storage.sql
-- Phase 4: a Storage bucket for product marketing images, added by the
-- Agency CMS's image upload feature. No bucket existed before this
-- migration (verified via storage.listBuckets() against the dev project).
--
-- Public: these are ordinary product photos meant to be visible on the
-- public site, with none of the secrecy requirements that apply to
-- affiliate_links — a public bucket (read = anyone, no signed URLs needed)
-- keeps this consistent with how the public product page already renders
-- product_images.storage_path directly as an <img src>. Only INSERT/UPDATE/
-- DELETE are restricted, mirroring the same owner/agency split already
-- enforced by RLS on the product_images table itself.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy product_images_bucket_read on storage.objects
  for select using (bucket_id = 'product-images');

create policy product_images_bucket_write on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
  );

create policy product_images_bucket_update on storage.objects
  for update using (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
  );

create policy product_images_bucket_delete on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and (public.is_owner() or public.has_any_role(array['agency_admin','content_editor']::public.user_role[]))
  );
