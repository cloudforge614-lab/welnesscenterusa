-- 0007_editorial.sql

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  slug text not null unique,
  content text,
  pros jsonb not null default '[]'::jsonb,
  considerations jsonb not null default '[]'::jsonb,
  author_id uuid references public.profiles(id),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index reviews_slug_idx on public.reviews(slug);
create index reviews_product_id_idx on public.reviews(product_id);
create index reviews_status_idx on public.reviews(status);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create or replace function public.reviews_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.next_unique_slug(new.title, 'reviews', new.id);
  end if;
  return new;
end;
$$;

create trigger reviews_before_insert_slug
  before insert on public.reviews
  for each row execute function public.reviews_set_slug();

create trigger reviews_audit
  after insert or update or delete on public.reviews
  for each row execute function public.write_audit_log();

alter table public.reviews enable row level security;

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index comparisons_slug_idx on public.comparisons(slug);
create index comparisons_status_idx on public.comparisons(status);

create trigger comparisons_set_updated_at
  before update on public.comparisons
  for each row execute function public.set_updated_at();

create or replace function public.comparisons_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.next_unique_slug(new.title, 'comparisons', new.id);
  end if;
  return new;
end;
$$;

create trigger comparisons_before_insert_slug
  before insert on public.comparisons
  for each row execute function public.comparisons_set_slug();

create trigger comparisons_audit
  after insert or update or delete on public.comparisons
  for each row execute function public.write_audit_log();

alter table public.comparisons enable row level security;

create table public.comparison_products (
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position int not null default 0,
  primary key (comparison_id, product_id)
);

create index comparison_products_product_id_idx on public.comparison_products(product_id);

alter table public.comparison_products enable row level security;

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text,
  featured_image_path text,
  category_id uuid references public.categories(id) on delete set null,
  author_id uuid references public.profiles(id),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index articles_slug_idx on public.articles(slug);
create index articles_status_idx on public.articles(status);
create index articles_category_id_idx on public.articles(category_id);

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

create or replace function public.articles_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.next_unique_slug(new.title, 'articles', new.id);
  end if;
  return new;
end;
$$;

create trigger articles_before_insert_slug
  before insert on public.articles
  for each row execute function public.articles_set_slug();

create trigger articles_audit
  after insert or update or delete on public.articles
  for each row execute function public.write_audit_log();

alter table public.articles enable row level security;

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text,
  featured_image_path text,
  category_id uuid references public.categories(id) on delete set null,
  author_id uuid references public.profiles(id),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index guides_slug_idx on public.guides(slug);
create index guides_status_idx on public.guides(status);
create index guides_category_id_idx on public.guides(category_id);

create trigger guides_set_updated_at
  before update on public.guides
  for each row execute function public.set_updated_at();

create or replace function public.guides_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.next_unique_slug(new.title, 'guides', new.id);
  end if;
  return new;
end;
$$;

create trigger guides_before_insert_slug
  before insert on public.guides
  for each row execute function public.guides_set_slug();

create trigger guides_audit
  after insert or update or delete on public.guides
  for each row execute function public.write_audit_log();

alter table public.guides enable row level security;

create table public.article_related_products (
  article_id uuid not null references public.articles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (article_id, product_id)
);

alter table public.article_related_products enable row level security;

create table public.guide_related_products (
  guide_id uuid not null references public.guides(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (guide_id, product_id)
);

alter table public.guide_related_products enable row level security;
