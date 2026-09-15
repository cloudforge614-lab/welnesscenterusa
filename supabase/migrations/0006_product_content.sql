-- 0006_product_content.sql
-- Agency-owned content. product_content.status is the single source of
-- truth for "is this product's content ready to show publicly" — the child
-- tables (images/faqs/benefits/ingredients) inherit that via RLS subquery
-- rather than tracking their own status, keeping publish state in one place.

create table public.product_content (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  overview text,
  how_it_works text,
  usage text,
  who_its_for text,
  considerations text,
  status public.content_status not null default 'draft',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index product_content_product_id_idx on public.product_content(product_id);
create index product_content_status_idx on public.product_content(status);

create trigger product_content_set_updated_at
  before update on public.product_content
  for each row execute function public.set_updated_at();

create trigger product_content_audit
  after insert or update or delete on public.product_content
  for each row execute function public.write_audit_log();

alter table public.product_content enable row level security;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  position int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images(product_id, position);

alter table public.product_images enable row level security;

create table public.product_faqs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  question text not null,
  answer text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index product_faqs_product_id_idx on public.product_faqs(product_id, position);

alter table public.product_faqs enable row level security;

create table public.product_benefits (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index product_benefits_product_id_idx on public.product_benefits(product_id, position);

alter table public.product_benefits enable row level security;

create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index product_ingredients_product_id_idx on public.product_ingredients(product_id, position);

alter table public.product_ingredients enable row level security;
