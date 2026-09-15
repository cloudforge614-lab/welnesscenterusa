-- 0004_categories.sql

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_slug_idx on public.categories(slug);
create index categories_parent_id_idx on public.categories(parent_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create or replace function public.categories_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.next_unique_slug(new.name, 'categories', new.id);
  end if;
  return new;
end;
$$;

create trigger categories_before_insert_slug
  before insert on public.categories
  for each row execute function public.categories_set_slug();

alter table public.categories enable row level security;
