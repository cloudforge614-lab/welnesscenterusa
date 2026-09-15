-- 0005_products.sql
-- Core product record. Owner-writable only. Affiliate destinations live in
-- affiliate_links (append-only history, one active row per product) rather
-- than as a column here, so a URL change never loses the prior destination
-- and /go/[slug] always resolves through a single well-defined lookup.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique,
  status public.product_status not null default 'new',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index products_slug_idx on public.products(slug);
create index products_status_idx on public.products(status) where deleted_at is null;
create index products_created_at_idx on public.products(created_at desc);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.products_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.next_unique_slug(new.name, 'products', new.id);
  end if;
  return new;
end;
$$;

create trigger products_before_insert_slug
  before insert on public.products
  for each row execute function public.products_set_slug();

create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function public.write_audit_log();

alter table public.products enable row level security;

-- Affiliate destination URLs. Kept separate from `products` so history is
-- preserved and so agency roles (who can read `products`) never gain read
-- access to affiliate destinations via a join.
create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  destination_url text not null check (destination_url ~* '^https?://[^\s]+$'),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index affiliate_links_product_id_idx on public.affiliate_links(product_id);
-- Only one active link per product at a time.
create unique index affiliate_links_one_active_per_product
  on public.affiliate_links(product_id)
  where is_active;

create trigger affiliate_links_audit
  after insert or update or delete on public.affiliate_links
  for each row execute function public.write_audit_log();

alter table public.affiliate_links enable row level security;

-- Many-to-many product <-> category.
create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index product_categories_category_id_idx on public.product_categories(category_id);

alter table public.product_categories enable row level security;
