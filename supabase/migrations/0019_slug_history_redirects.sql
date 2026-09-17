-- 0019_slug_history_redirects.sql
-- Phase 7.9. Makes the redirects table from 0008 actually usable, and fills
-- it automatically when a slug changes. No new table: the existing
-- source_path/destination_path/redirect_type/is_active shape is exactly
-- what a historical-URL redirect needs.
--
-- Two parts: constraints that make an open redirect unstorable, and a
-- trigger that records slug history without the application having to
-- remember to.

-- ── 1. Internal-path-only, enforced by the database ────────────────────────
--
-- destination_path is plain text, so nothing previously stopped a row from
-- holding "https://evil.example" or "//evil.example" and turning this site
-- into an open redirector for whoever could write one. These constraints
-- make that unstorable rather than merely unwritten — the application
-- validates too, but a CHECK is the boundary that holds even if a future
-- code path forgets, and it applies equally to a direct dashboard edit.
--
-- The pattern requires a leading "/" followed by an alphanumeric, which
-- rejects every dangerous shape on its own:
--   https://evil.example  — does not start with "/"
--   //evil.example        — second character is "/", not alphanumeric
--   javascript:...        — does not start with "/" (and ":" is not in the
--   data:...                character class either)
--   /..%2f..              — "%" is not in the character class
-- The explicit "//" and ".." rejections also cover those sequences appearing
-- later in the path, not just at the start.
--
-- The table is empty at the time this migration runs (verified against the
-- dev project: 0 rows), so no existing row can fail validation.
alter table public.redirects
  add constraint redirects_source_path_internal check (
    source_path ~ '^/[A-Za-z0-9][-A-Za-z0-9._~/]*$'
    and source_path !~ '//'
    and source_path !~ '\.\.'
  ),
  add constraint redirects_destination_path_internal check (
    destination_path ~ '^/[A-Za-z0-9][-A-Za-z0-9._~/]*$'
    and destination_path !~ '//'
    and destination_path !~ '\.\.'
  ),
  -- A row pointing at itself would be an immediate redirect loop.
  add constraint redirects_no_self_redirect check (source_path <> destination_path);

-- ── 2. Automatic slug history ──────────────────────────────────────────────
--
-- SECURITY DEFINER, and the justification is specific: redirects_write (0011)
-- allows owner, agency_admin and seo_editor, but the roles that can change
-- content are owner, agency_admin and content_editor. A content_editor
-- changing a slug could not write its own history row, so the history would
-- silently not be recorded for exactly the role most likely to cause it.
-- Running as definer closes that gap.
--
-- That is safe here in a way it would not be for a general-purpose function:
-- this one never accepts a destination from its caller. Both paths are
-- computed from the row's own old and new slug plus a fixed prefix supplied
-- at trigger-creation time, so there is no input through which someone could
-- steer a redirect somewhere of their choosing. The constraints above still
-- apply to what it writes.
--
-- The prefix is passed per-trigger because the public route does not always
-- match the table name — articles are served at /blog/[slug], not
-- /articles/[slug].
create or replace function public.record_slug_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := tg_argv[0];
  v_old_path text;
  v_new_path text;
begin
  -- Only a real change counts. "is not distinct from" rather than "=" so a
  -- NULL on either side behaves sensibly instead of yielding NULL.
  if new.slug is not distinct from old.slug then
    return new;
  end if;

  v_old_path := v_prefix || old.slug;
  v_new_path := v_prefix || new.slug;

  -- The new slug is a live URL again. If it was previously retired and left
  -- behind a historical row, that row has to go, or the live page would
  -- redirect away from itself.
  delete from public.redirects where source_path = v_new_path;

  -- Flatten chains at write time instead of following them at read time:
  -- anything that pointed at the old path now points at the new one, so a
  -- lookup is always a single hop. Without this, a slug changed twice would
  -- leave a -> b -> c and cost an extra round trip (and an extra redirect
  -- for the visitor) on every request to the oldest URL.
  update public.redirects
    set destination_path = v_new_path
    where destination_path = v_old_path;

  -- 301 (permanent) is the default and the right semantic for a slug move.
  -- on conflict: the old path may already be a historical source from an
  -- earlier move, in which case this move supersedes it.
  insert into public.redirects (source_path, destination_path, redirect_type, is_active, created_by)
  values (v_old_path, v_new_path, '301', true, auth.uid())
  on conflict (source_path) do update
    set destination_path = excluded.destination_path,
        redirect_type = excluded.redirect_type,
        is_active = true;

  return new;
end;
$$;

-- Trigger functions cannot be invoked over PostgREST (it does not expose
-- functions returning `trigger`), but the grant is tightened anyway to match
-- how every other privileged function in this project is handled — and
-- explicitly from anon as well as public, since revoking from PUBLIC alone
-- does not remove anon's own platform-level default grant.
revoke all on function public.record_slug_change() from public, anon;

-- `after update of slug` means the trigger is not even considered unless the
-- statement touches the slug column; the guard inside then confirms the value
-- actually changed.
create trigger products_slug_history
  after update of slug on public.products
  for each row execute function public.record_slug_change('/products/');

create trigger categories_slug_history
  after update of slug on public.categories
  for each row execute function public.record_slug_change('/categories/');

create trigger reviews_slug_history
  after update of slug on public.reviews
  for each row execute function public.record_slug_change('/reviews/');

create trigger guides_slug_history
  after update of slug on public.guides
  for each row execute function public.record_slug_change('/guides/');

-- /blog/, not /articles/ — the public route name differs from the table name.
create trigger articles_slug_history
  after update of slug on public.articles
  for each row execute function public.record_slug_change('/blog/');

create trigger comparisons_slug_history
  after update of slug on public.comparisons
  for each row execute function public.record_slug_change('/comparisons/');
