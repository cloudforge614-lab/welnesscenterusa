-- 0008_seo_and_redirects.sql
-- Polymorphic SEO metadata: one row per (entity_type, entity_id), shared
-- across products/categories/reviews/comparisons/articles/guides so the
-- agency has a single consistent editor UI for SEO fields regardless of
-- content type.

create table public.seo_metadata (
  id uuid primary key default gen_random_uuid(),
  entity_type public.seo_entity_type not null,
  entity_id uuid not null,
  title text,
  meta_description text,
  canonical_url text,
  og_title text,
  og_description text,
  og_image_path text,
  robots_index boolean not null default true,
  robots_follow boolean not null default true,
  schema_jsonld jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index seo_metadata_entity_idx on public.seo_metadata(entity_type, entity_id);

create trigger seo_metadata_set_updated_at
  before update on public.seo_metadata
  for each row execute function public.set_updated_at();

create trigger seo_metadata_audit
  after insert or update or delete on public.seo_metadata
  for each row execute function public.write_audit_log();

alter table public.seo_metadata enable row level security;

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  destination_path text not null,
  redirect_type public.redirect_type not null default '301',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index redirects_source_path_idx on public.redirects(source_path) where is_active;

create trigger redirects_audit
  after insert or update or delete on public.redirects
  for each row execute function public.write_audit_log();

alter table public.redirects enable row level security;
