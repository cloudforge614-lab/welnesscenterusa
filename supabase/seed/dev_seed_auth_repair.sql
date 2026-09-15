-- ============================================================================
-- DEVELOPMENT ONLY — repairs the four fake dev accounts created by an earlier
-- version of dev_seed.sql so they can sign in through Supabase Auth.
--
-- Problem: that seed inserted rows straight into auth.users but left Auth's
-- token columns NULL and created no auth.identities rows. Supabase Auth
-- (GoTrue) reads those columns as non-null strings, so every password
-- sign-in for those users failed with "500: Database error querying schema".
--
-- This touches ONLY the four fixed dev UUIDs below. It changes no schema, no
-- RLS policy, no role, and no application data. Safe to run more than once.
--
-- Run in the DEV project's SQL Editor. Never run against production.
-- ============================================================================

do $$
begin
  if current_setting('app.confirm_dev_seed', true) is distinct from 'yes-i-am-sure' then
    raise exception 'Refusing to run: first run SET app.confirm_dev_seed = ''yes-i-am-sure''; in the same session (DEV project only).';
  end if;
end;
$$;

update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change               = coalesce(email_change, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(), now(), now()
from auth.users u
where u.id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
)
on conflict (provider_id, provider) do nothing;

select u.email, p.role,
       exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email') as has_email_identity,
       u.confirmation_token is not null as tokens_repaired
from auth.users u
join public.profiles p on p.id = u.id
where u.id::text like '00000000-0000-0000-0000-00000000000_'
order by u.email;
