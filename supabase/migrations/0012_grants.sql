-- 0012_grants.sql
-- Explicit schema/table privilege grants so this project is reproducible in
-- a brand-new Supabase project regardless of that project's default
-- privilege configuration. RLS policies (0011) are what actually restrict
-- row access — these GRANTs are the coarse on/off switch RLS operates
-- beneath, per Postgres privilege rules.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- Anon must not be able to write anywhere directly; all anon-facing writes
-- (click tracking) go through the SECURITY DEFINER RPCs granted in 0010.
revoke insert, update, delete on all tables in schema public from anon;

-- Keep future tables covered automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;

grant usage, select on all sequences in schema public to authenticated;
