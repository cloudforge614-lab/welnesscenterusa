-- 0002_helper_functions.sql
-- Bootstrap-safe utility functions: none of these statically reference a
-- table created by a later migration, so they are safe to create against a
-- completely empty database.
--
-- The role-check functions (current_user_role/is_owner/is_agency/
-- has_any_role) deliberately do NOT live in this file even though they are
-- conceptually "helper functions" — they are declared LANGUAGE SQL, and
-- Postgres parses and resolves a SQL-language function's body immediately
-- at CREATE FUNCTION time (needed to build dependency records and check
-- inlining eligibility), unlike a plpgsql body, which is stored as opaque
-- text and only validated on first invocation. Since those four functions
-- reference public.profiles, they must be created after 0003_profiles.sql
-- creates that table — see the bottom of that file. Every function that
-- stays in THIS file is either LANGUAGE SQL with no table reference
-- (slugify), LANGUAGE PLPGSQL (next_unique_slug, set_updated_at,
-- write_audit_log — table references inside these are never checked until
-- the function actually runs, long after all migrations have applied), so
-- none of them care what order they run in relative to table creation.

-- Basic slugify: lowercase, non-alphanumerics to hyphens, trim/collapse hyphens.
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- Returns a slug guaranteed unique within p_table (must have a `slug` column),
-- appending -2, -3, ... on collision. p_table is whitelisted, never taken
-- from unsanitized input, so dynamic SQL here is not an injection vector.
--
-- Concurrency: two transactions generating a slug for the same base name at
-- nearly the same instant would otherwise both see "candidate free" before
-- either commits (a classic check-then-insert race). We close that with a
-- transaction-scoped advisory lock keyed on (table, base) so the second
-- caller blocks until the first commits or rolls back, then re-checks under
-- a fresh snapshot. The `slug` UNIQUE constraint on every target table is
-- still the ultimate guarantee even if this lock were ever bypassed — this
-- lock only turns "insert fails with a unique_violation the caller must
-- retry" into "the second caller transparently gets base-2 instead."
create or replace function public.next_unique_slug(
  p_base text,
  p_table text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := nullif(public.slugify(p_base), '');
  v_candidate text;
  v_suffix int := 1;
  v_exists boolean;
begin
  if p_table not in (
    'products', 'categories', 'reviews', 'comparisons', 'articles', 'guides'
  ) then
    raise exception 'next_unique_slug: table % is not allowed', p_table;
  end if;

  if v_base is null then
    v_base := 'item';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_table || ':' || v_base, 0));

  v_candidate := v_base;

  loop
    execute format(
      'select exists(select 1 from public.%I where slug = $1 and ($2::uuid is null or id <> $2))',
      p_table
    ) into v_exists using v_candidate, p_exclude_id;

    exit when not v_exists;

    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Generic audit trigger: records who did what to which row. Runs as
-- SECURITY DEFINER so clients never need direct INSERT rights on audit_logs.
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_diff jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_diff := jsonb_build_object('before', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_diff := jsonb_build_object('after', to_jsonb(new));
  else
    v_entity_id := new.id;
    v_diff := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, diff)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_entity_id, v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
