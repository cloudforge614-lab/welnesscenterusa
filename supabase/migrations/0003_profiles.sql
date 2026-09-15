-- 0003_profiles.sql
-- One row per auth.users, carrying the role used by every RLS policy.
-- role starts NULL ("pending") on signup; only the owner can assign a role,
-- enforced by the trigger below rather than by RLS alone (defense in depth).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- Role-check functions live here, immediately after the table they read,
-- rather than in 0002_helper_functions.sql with the rest of the "helper"
-- functions. They are LANGUAGE SQL, and Postgres resolves a SQL-language
-- function body's table/column references immediately at CREATE FUNCTION
-- time (unlike plpgsql, whose body is opaque text validated only on first
-- call) — so `public.profiles` must already exist, which is only
-- guaranteed once this file has reached this point. Everything downstream
-- that needs them (RLS policies in 0011, guard_profile_role_change() a few
-- lines below, CREATE POLICY and CREATE TRIGGER both also resolve their
-- referenced functions immediately) runs later than this file, so this is
-- the earliest — and only — correct place for them.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'owner';
$$;

create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('agency_admin', 'seo_editor', 'content_editor');
$$;

create or replace function public.has_any_role(roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = any(roles);
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a pending profile row whenever a new auth user signs up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, null, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Prevent anyone other than the owner from changing their own or another
-- profile's role, even if an RLS policy were ever misconfigured.
--
-- auth.uid() is NULL when there is no authenticated PostgREST request
-- context at all — i.e. direct database access: migrations, seed scripts,
-- or the Supabase SQL Editor / psql connected as the project's postgres
-- user. That level of access is already equivalent to full DB control (it
-- can disable this very trigger), so gating on auth.uid() IS NULL would add
-- no real security and would instead make the first owner unbootstrappable
-- (there is no owner yet to satisfy is_owner()) and break dev_seed.sql,
-- which assigns all four dev roles the same way. The guard therefore only
-- needs to, and only does, stop an authenticated non-owner API caller from
-- granting themselves or anyone else a role.
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.role is distinct from old.role
     and not public.is_owner()
  then
    raise exception 'Only the owner can change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

alter table public.profiles enable row level security;
