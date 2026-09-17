-- 0020_storage_and_seo_metadata_hardening.sql
-- Phase 7.11. Two hardening items from the Phase 7 inspection. Neither adds a
-- table, a bucket, or a feature: both narrow an existing surface that was
-- wider than the application actually needs.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. STORAGE BUCKET HARDENING
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THREAT
-- `product-images` has file_size_limit = NULL and allowed_mime_types = NULL,
-- so the bucket itself accepts anything of any size. The application does
-- validate (src/app/agency/actions.ts: 5 MB cap, image/jpeg|png|webp only),
-- but that validation runs in a Server Action — it is not the boundary. Any
-- owner/agency_admin/content_editor holds a real Supabase session, and that
-- session can call the Storage API directly with curl, bypassing the action
-- entirely. Today that permits a 2 GB upload, or an SVG.
--
-- SVG is the sharper of the two. The bucket is public, so an SVG would be
-- served from the Supabase origin with image/svg+xml, and SVG can carry
-- <script>. That is stored XSS on the storage origin, reachable by anyone
-- given the URL. There is no requirement for SVG anywhere in this project:
-- the upload action only ever writes .jpg, .png or .webp, chosen from the
-- validated MIME type. So it is excluded.
--
-- WHY THESE VALUES
-- The MIME list is exactly ALLOWED_IMAGE_TYPES from the upload action, so the
-- bucket and the application agree rather than the bucket being a second,
-- looser opinion. jpg and jpeg are both image/jpeg, so three entries cover
-- all four formats the site supports.
--
-- 5 MiB is MAX_IMAGE_BYTES from that same action. Matching it exactly is
-- deliberate: a larger bucket limit would leave a band where a direct API
-- upload succeeds but the application would have rejected the same file, and
-- a smaller one would reject files the UI says are fine. The value itself is
-- generous for the actual need — these are product photos rendered into an
-- aspect-square card and an aspect-video hero, where a 5 MB source is already
-- far beyond what those dimensions can show.
--
-- WHAT IS NOT CHANGED
-- The four policies from 0014, and the path-scoping INSERT rule from 0016,
-- are untouched. Bucket-level limits and RLS policies are independent
-- mechanisms: this constrains WHAT may be stored, the policies constrain WHO
-- may store it and WHERE. Both still apply, and a direct API upload must now
-- satisfy all of them.
update storage.buckets
set
  file_size_limit = 5242880, -- 5 MiB, = MAX_IMAGE_BYTES
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'product-images';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SEO_METADATA PUBLIC READ HARDENING
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THREAT
-- seo_metadata_public_select was `using (true)`: anon could read every row in
-- the table, including rows belonging to content that is not published. The
-- public site never renders those — it looks metadata up by the id of an
-- entity it has already resolved through the eligibility gates — but the
-- table is reachable directly over PostgREST with the anon key, which ships
-- in the browser bundle. So `select * from seo_metadata` as anon returned the
-- working titles, meta descriptions and OG copy for unreleased products and
-- unpublished articles: a preview of unannounced content and of the editorial
-- pipeline, straight out of the API.
--
-- The rows are not credentials, which is presumably why this was originally
-- judged "non-sensitive page metadata". But for an affiliate site, which
-- products are being prepared is commercially interesting, and draft copy is
-- not something an editor expects to be publishing by writing it.
--
-- DESIGN
-- Public read is narrowed, not removed — live pages still need this data, and
-- removing it would break every canonical, title and OG tag on the site.
--
-- seo_metadata is polymorphic on (entity_type, entity_id), so the rule is a
-- CASE over entity_type whose branches mirror each entity's own public SELECT
-- policy from 0011 exactly:
--   product     two-gate: active AND not soft-deleted AND content published
--   review/guide/article/comparison   status = 'published'
--   category    always public — categories_public_select is `using (true)`,
--               because a category is a taxonomy entity with no draft state.
--               Its SEO metadata is no more sensitive than the category row.
-- A CASE with no ELSE yields NULL for an unmatched value, and NULL in a USING
-- clause denies. So if a seventh entity type is ever added to the enum, its
-- metadata is private until a branch is written for it — the failure mode is
-- "invisible", not "exposed".
--
-- Every column reference is schema-qualified (seo_metadata.entity_id, not a
-- bare entity_id) because of the bug fixed in 0016: an unqualified name in a
-- correlated subquery binds to the inner table's column if one matches, and
-- that silently produced a policy that never matched. None of the five joined
-- tables has an entity_id column today, so this is defensive rather than a
-- present bug — which is exactly when it is cheap to get right.
--
-- STAFF READS
-- Note that `using (true)` was the ONLY select policy on this table, so it
-- was also how owner and agency users read it. Narrowing it alone would have
-- broken the agency SEO editor's ability to see the metadata it is editing.
-- seo_metadata_staff_select restores that explicitly for owner and all three
-- agency roles (is_agency() = agency_admin, seo_editor, content_editor), and
-- being a separate permissive policy it is OR'd with the public one.
--
-- Write access is deliberately untouched: insert/update/delete remain
-- owner + agency_admin + seo_editor, and anon still has no write path.
drop policy seo_metadata_public_select on public.seo_metadata;

create policy seo_metadata_staff_select on public.seo_metadata
  for select using (public.is_owner() or public.is_agency());

create policy seo_metadata_public_select on public.seo_metadata
  for select using (
    case seo_metadata.entity_type
      when 'category' then true

      when 'product' then exists (
        select 1 from public.products p
        where p.id = seo_metadata.entity_id
          and p.status = 'active'
          and p.deleted_at is null
          and exists (
            select 1 from public.product_content pc
            where pc.product_id = p.id and pc.status = 'published'
          )
      )

      when 'review' then exists (
        select 1 from public.reviews r
        where r.id = seo_metadata.entity_id and r.status = 'published'
      )

      when 'guide' then exists (
        select 1 from public.guides g
        where g.id = seo_metadata.entity_id and g.status = 'published'
      )

      when 'article' then exists (
        select 1 from public.articles a
        where a.id = seo_metadata.entity_id and a.status = 'published'
      )

      when 'comparison' then exists (
        select 1 from public.comparisons c
        where c.id = seo_metadata.entity_id and c.status = 'published'
      )
    end
  );
