-- 0026_product_landing_pages.sql
-- A+ product landing pages: structured content, per-product theme, sources,
-- and a database-enforced editorial approval workflow.
--
-- WHY EXTEND product_content (and not a new table)
-- product_content is already the 1:1 editorial row for a product, and it is
-- already the publication gate: /products/[slug] and the sitemap require
-- product_content.status = 'published'. Extending it reuses that gate, the
-- existing RLS policies (agency write, owner all, public read when
-- published), the audit trigger, set_updated_at and the cache tags. No new
-- policy is added, and there is no second source of truth for "is this page
-- live".
--
-- PUBLIC VISIBILITY OF EVERY COLUMN
-- product_content_public_select exposes every column of a PUBLISHED row to
-- anonymous visitors. Every column added here is therefore intended to be
-- public once the page is live (it is page content, or a harmless review
-- timestamp). Nothing private (internal notes, reviewer identities,
-- affiliate data) may ever be added to this table. Who approved what is
-- already recorded, privately, by the audit trigger (audit_logs.actor_id).
--
-- WORKFLOW
--   Not Started  : no product_content row exists yet (implicit)
--   Draft        : editorial_status = 'draft'
--   Needs Review : editorial_status = 'needs_review'
--   Approved     : editorial_status = 'approved'
--   Published    : editorial_status = 'approved' AND status = 'published'
-- 'not_started' exists in the enum for reporting; rows are created as 'draft'.
--
-- ROLES (the existing model)
--   Approvers: owner, agency_admin (and trusted database roles: postgres,
--              supabase_admin, service_role, which are never editor requests).
--   Authors:   content_editor (drafts, submits for review; cannot approve).
--   seo_editor has no product_content write policy at all (unchanged).
--
-- ENFORCEMENT, product_content_editorial_guard (BEFORE INSERT OR UPDATE):
--   1. Only an approver can move a row INTO 'approved'.
--   2. A row can be status = 'published' only while editorial_status =
--      'approved'. When an APPROVER publishes, that act is their approval
--      (the row is marked approved and timestamped). A non-approver's publish
--      of unapproved content is rejected, however the request is crafted,
--      because the check runs in the database rather than the UI.
--   3. A non-approver may not change the content of a PUBLISHED row (that
--      would put unreviewed text live). On an approved but unpublished row,
--      their edit sends it back to 'draft' for re-review.
--   4. Timestamps: submitted_at on entering review, approved_at on approval,
--      last_reviewed_at whenever an approver approves or edits.
-- Rules 2 and 3 also cover the benefit, ingredient and FAQ lists, whose text
-- renders on the same page (product_content_child_guard).

create type public.editorial_status as enum ('not_started', 'draft', 'needs_review', 'approved');

-- Validation functions (IMMUTABLE, used by CHECK constraints) ---------------

-- Theme: an object whose keys are a fixed set of design tokens and whose
-- values are 6-digit hex colours. Anything else is rejected, so no stored
-- value can carry CSS syntax into a page.
create or replace function public.is_valid_product_theme(theme jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(theme) = 'object'
    and not exists (
      select 1 from jsonb_each(theme) e
      where e.key not in ('primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted', 'cta', 'ctaText')
         or jsonb_typeof(e.value) <> 'string'
         or (e.value #>> '{}') !~ '^#[0-9A-Fa-f]{6}$'
    );
$$;

-- Sections: an ordered array (max 30) of objects with a known kind, a heading
-- and a body of bounded size. Deeper structure (list items, table cells) is
-- validated again by the application before rendering.
create or replace function public.is_valid_landing_sections(sections jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(sections) = 'array'
    and jsonb_array_length(sections) <= 30
    and not exists (
      select 1 from jsonb_array_elements(sections) s
      where jsonb_typeof(s) <> 'object'
         or coalesce(s ->> 'kind', '') not in ('prose', 'checklist', 'steps', 'comparison', 'specs', 'callout')
         or jsonb_typeof(s -> 'heading') is distinct from 'string'
         or length(s ->> 'heading') not between 1 and 160
         or length(coalesce(s ->> 'body', '')) > 12000
         or length(s::text) > 30000
    );
$$;

-- Sources: an array (max 40) of {label, url, kind}; https URLs only.
create or replace function public.is_valid_landing_sources(sources jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(sources) = 'array'
    and jsonb_array_length(sources) <= 40
    and not exists (
      select 1 from jsonb_array_elements(sources) s
      where jsonb_typeof(s) <> 'object'
         or length(coalesce(s ->> 'label', '')) not between 1 and 200
         -- Length is checked separately: PostgreSQL caps regex repetition
         -- counts at 255, so {4,2040} is not expressible in the pattern.
         or coalesce(s ->> 'url', '') !~ '^https://[^[:space:]]+$'
         or length(s ->> 'url') not between 12 and 2048
         or coalesce(s ->> 'kind', '') not in ('manufacturer', 'independent', 'regulatory', 'retailer', 'other')
    );
$$;

-- New columns (all additive; existing data untouched) ------------------------

alter table public.product_content
  add column announcement text check (announcement is null or length(announcement) <= 200),
  add column hero_headline text check (hero_headline is null or length(hero_headline) <= 140),
  add column hero_subtitle text check (hero_subtitle is null or length(hero_subtitle) <= 400),
  add column sections jsonb not null default '[]'::jsonb check (public.is_valid_landing_sections(sections)),
  add column theme jsonb not null default '{}'::jsonb check (public.is_valid_product_theme(theme)),
  add column brand text check (brand is null or length(brand) <= 120),
  add column manufacturer text check (manufacturer is null or length(manufacturer) <= 160),
  add column sources jsonb not null default '[]'::jsonb check (public.is_valid_landing_sources(sources)),
  add column editorial_status public.editorial_status not null default 'draft',
  add column submitted_at timestamptz,
  add column approved_at timestamptz,
  add column last_reviewed_at timestamptz;

-- Existing rows keep their exact public behaviour. Anything already published
-- was, by definition, accepted for publication, so it is recorded as approved
-- and the new publish rule cannot take a live page offline. This runs before
-- the guard trigger exists, so it is not subject to it.
update public.product_content
set editorial_status = case when status = 'published' then 'approved'::public.editorial_status else 'draft'::public.editorial_status end,
    approved_at = case when status = 'published' then updated_at end,
    last_reviewed_at = case when status = 'published' then updated_at end;

-- Guard: product_content ------------------------------------------------------

create or replace function public.product_content_editorial_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Trusted database roles (migrations, the dashboard SQL editor, the
  -- service role) are not editor requests and are treated as approvers.
  is_approver boolean := public.is_owner()
    or public.has_any_role(array['agency_admin']::public.user_role[])
    or current_user in ('postgres', 'supabase_admin', 'service_role');
  content_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    content_changed :=
         new.overview         is distinct from old.overview
      or new.how_it_works     is distinct from old.how_it_works
      or new.usage            is distinct from old.usage
      or new.who_its_for      is distinct from old.who_its_for
      or new.considerations   is distinct from old.considerations
      or new.announcement     is distinct from old.announcement
      or new.hero_headline    is distinct from old.hero_headline
      or new.hero_subtitle    is distinct from old.hero_subtitle
      or new.sections         is distinct from old.sections
      or new.theme            is distinct from old.theme
      or new.brand            is distinct from old.brand
      or new.manufacturer     is distinct from old.manufacturer
      or new.sources          is distinct from old.sources;

    -- Rule 3: live content changes only through an approver.
    if content_changed and not is_approver then
      if old.status = 'published' then
        raise exception 'Published content can only be changed by an approver (owner or agency admin). Unpublish it first, or ask an approver.'
          using errcode = '42501';
      end if;
      if old.editorial_status = 'approved' and new.editorial_status = 'approved' then
        new.editorial_status := 'draft';
      end if;
    end if;
  end if;

  -- Rule 2 (approver path): an approver publishing is an approval.
  if new.status = 'published' and new.editorial_status <> 'approved' and is_approver then
    new.editorial_status := 'approved';
  end if;

  -- Rule 1: only approvers may set 'approved'.
  if new.editorial_status = 'approved'
     and (tg_op = 'INSERT' or old.editorial_status is distinct from 'approved')
     and not is_approver then
    raise exception 'Only an approver (owner or agency admin) can approve content.'
      using errcode = '42501';
  end if;

  -- Rule 2 (everyone): nothing unapproved is ever published.
  if new.status = 'published' and new.editorial_status <> 'approved' then
    raise exception 'Content must be approved before it can be published.'
      using errcode = '42501';
  end if;

  -- Rule 4: timestamps.
  if new.editorial_status = 'needs_review'
     and (tg_op = 'INSERT' or old.editorial_status is distinct from 'needs_review') then
    new.submitted_at := now();
  end if;
  if new.editorial_status = 'approved'
     and (tg_op = 'INSERT' or old.editorial_status is distinct from 'approved') then
    new.approved_at := now();
    new.last_reviewed_at := now();
  elsif is_approver and content_changed then
    new.last_reviewed_at := now();
  end if;

  return new;
end;
$$;

create trigger product_content_editorial_guard
  before insert or update on public.product_content
  for each row execute function public.product_content_editorial_guard();

-- Guard: benefit, ingredient and FAQ lists (same page, same rules) ----------

create or replace function public.product_content_child_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Trusted database roles (migrations, the dashboard SQL editor, the
  -- service role) are not editor requests and are treated as approvers.
  is_approver boolean := public.is_owner()
    or public.has_any_role(array['agency_admin']::public.user_role[])
    or current_user in ('postgres', 'supabase_admin', 'service_role');
  target_product uuid;
  parent_status public.content_status;
  parent_editorial public.editorial_status;
begin
  if is_approver then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    target_product := old.product_id;
  else
    target_product := new.product_id;
  end if;

  select status, editorial_status into parent_status, parent_editorial
  from public.product_content where product_id = target_product;

  if found then
    if parent_status = 'published' then
      raise exception 'Published content can only be changed by an approver (owner or agency admin). Unpublish it first, or ask an approver.'
        using errcode = '42501';
    end if;
    if parent_editorial = 'approved' then
      update public.product_content set editorial_status = 'draft' where product_id = target_product;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger product_benefits_editorial_guard
  before insert or update or delete on public.product_benefits
  for each row execute function public.product_content_child_guard();
create trigger product_ingredients_editorial_guard
  before insert or update or delete on public.product_ingredients
  for each row execute function public.product_content_child_guard();
create trigger product_faqs_editorial_guard
  before insert or update or delete on public.product_faqs
  for each row execute function public.product_content_child_guard();
