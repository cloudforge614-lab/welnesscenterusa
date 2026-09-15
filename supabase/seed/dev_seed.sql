-- ============================================================================
-- DEVELOPMENT / TESTING SEED DATA ONLY.
--
-- DO NOT run this against a production Supabase project. It creates fake
-- auth users, fake profiles with every role, and a handful of fake products
-- purely so you can click through the owner/agency dashboards locally and
-- run the RLS test script in supabase/tests/rls_tests.sql.
--
-- Usage: `supabase db reset` (applies migrations then this file, if wired
-- into supabase/config.toml `seed.sql` path), or run manually in the SQL
-- editor of a scratch/dev Supabase project only.
--
-- SAFETY GUARD: this script refuses to run at all unless you explicitly
-- opt in for the current session first, so a careless copy-paste into the
-- wrong project's SQL Editor does nothing instead of creating fake owner/
-- agency accounts with known dev passwords. Run this one line first, in the
-- SAME editor session/run, before the rest of the file:
--   SET app.confirm_dev_seed = 'yes-i-am-sure';
-- ============================================================================

do $$
begin
  if current_setting('app.confirm_dev_seed', true) is distinct from 'yes-i-am-sure' then
    raise exception 'Refusing to run dev_seed.sql: run SET app.confirm_dev_seed = ''yes-i-am-sure''; first (see file header). This exists so this file can never be applied to a project by accident.';
  end if;
end;
$$;

-- Fake auth users (bypassing normal signup) for local testing. The dev
-- passwords below are real: the admin app signs in with them.
--
-- Supabase Auth reads the token columns as non-null strings, so they must be
-- set to "" rather than left NULL, and each user needs an "email" identity;
-- without both, password sign-in fails with "Database error querying schema".
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'owner.dev@example.test', crypt('dev-password-owner', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dev Owner"}', 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'agency-admin.dev@example.test', crypt('dev-password-agency', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dev Agency Admin"}', 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'seo-editor.dev@example.test', crypt('dev-password-seo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dev SEO Editor"}', 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'content-editor.dev@example.test', crypt('dev-password-content', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dev Content Editor"}', 'authenticated', 'authenticated', '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users u
where u.id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
               '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004')
on conflict (provider_id, provider) do nothing;

-- The handle_new_auth_user() trigger already created pending (role = null)
-- profiles rows for the inserts above; assign roles now.
update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set role = 'agency_admin' where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set role = 'seo_editor' where id = '00000000-0000-0000-0000-000000000003';
update public.profiles set role = 'content_editor' where id = '00000000-0000-0000-0000-000000000004';

-- A couple of sample categories.
insert into public.categories (name, slug, description)
values
  ('Sleep', 'sleep', 'Products supporting sleep quality'),
  ('Gut Health', 'gut-health', 'Digestive and gut health products')
on conflict (slug) do nothing;

-- Two sample products, created the same way the owner's "Add Product" form
-- would (name + affiliate URL only). Run as the dev owner.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select public.create_product('Prodentim', 'https://example-merchant.test/prodentim?aff=owner123');
select public.create_product('YuSleep', 'https://example-merchant.test/yusleep?aff=owner123');

reset request.jwt.claims;
