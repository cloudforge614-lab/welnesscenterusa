-- ============================================================================
-- Manual RLS / behavior test script.
--
-- Run this in the Supabase SQL Editor (or `psql`) against a project that has
-- had the migrations (supabase/migrations/*.sql) AND supabase/seed/dev_seed.sql
-- applied. It is NOT part of the migration chain and must never run against
-- production.
--
-- HOW IDENTITY SWITCHING WORKS (read this before editing):
--
-- The SQL Editor connects as `postgres`, which owns every table in this
-- schema and therefore bypasses RLS entirely. Setting request.jwt.claims on
-- its own does NOT change that — it only changes what auth.uid() /
-- is_owner() / is_agency() return IF a policy is evaluated, and for the
-- table owner no policy is ever evaluated. So every identity switch below
-- does two things, as plain visible top-level statements:
--
--   reset role;                     -- back to postgres, the only role that
--                                   -- may SET ROLE to either target
--   set local role authenticated;   -- (or anon) actually makes RLS apply
--   select set_config('request.jwt.claims', '{...}', true);
--                                   -- tells auth.uid() WHICH user this is
--
-- owner / agency_admin / seo_editor / content_editor all share the
-- `authenticated` Postgres role (as they do for real PostgREST requests);
-- only the JWT `sub` claim distinguishes them. Unauthenticated visitors use
-- the `anon` Postgres role.
--
-- TEST 0 verifies the switch genuinely took effect for every identity
-- before any real test runs, and aborts with HARNESS FAILED otherwise.
--
-- The whole file runs inside one explicit transaction that is ROLLED BACK
-- at the end: SET LOCAL requires a transaction block, and rolling back means
-- no test data persists, so the suite can be rerun any number of times.
-- A clean run ends with a single result row reading
-- "RLS TEST SUITE PASSED ..."; any failure stops execution at the first
-- raised error, and nothing after it runs.
-- ============================================================================

-- Dev seed user ids (from supabase/seed/dev_seed.sql):
--   owner:           00000000-0000-0000-0000-000000000001
--   agency_admin:    00000000-0000-0000-0000-000000000002
--   seo_editor:      00000000-0000-0000-0000-000000000003
--   content_editor:  00000000-0000-0000-0000-000000000004

begin;

-- ============================================================================
-- TEST 0: Harness preflight. Proves each identity genuinely runs as a
-- non-privileged role that is subject to RLS, and that auth.uid() /
-- current_user_role() resolve to the expected seeded user.
-- ============================================================================

-- owner
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  if current_user <> 'authenticated' then
    raise exception 'HARNESS FAILED: expected current_user = authenticated, got % (SET LOCAL ROLE did not take effect)', current_user;
  end if;
  if exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'HARNESS FAILED: role % is superuser or has BYPASSRLS', current_user;
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tableowner = current_user) then
    raise exception 'HARNESS FAILED: role % owns public tables and would bypass RLS on them', current_user;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.affiliate_links'::regclass) then
    raise exception 'HARNESS FAILED: RLS is not enabled on public.affiliate_links';
  end if;
  if auth.uid() is distinct from '00000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'HARNESS FAILED: auth.uid() = %, expected the owner id', auth.uid();
  end if;
  if public.current_user_role() is distinct from 'owner' then
    raise exception 'HARNESS FAILED: current_user_role() = %, expected owner (was dev_seed.sql applied?)', public.current_user_role();
  end if;
  raise notice 'HARNESS OK: owner runs as %, auth.uid()=%, role=%', current_user, auth.uid(), public.current_user_role();
end;
$$;

-- agency_admin
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if current_user <> 'authenticated' then
    raise exception 'HARNESS FAILED: expected current_user = authenticated, got %', current_user;
  end if;
  if public.current_user_role() is distinct from 'agency_admin' then
    raise exception 'HARNESS FAILED: current_user_role() = %, expected agency_admin', public.current_user_role();
  end if;
  raise notice 'HARNESS OK: agency_admin runs as %, auth.uid()=%', current_user, auth.uid();
end;
$$;

-- seo_editor
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

do $$
begin
  if current_user <> 'authenticated' then
    raise exception 'HARNESS FAILED: expected current_user = authenticated, got %', current_user;
  end if;
  if public.current_user_role() is distinct from 'seo_editor' then
    raise exception 'HARNESS FAILED: current_user_role() = %, expected seo_editor', public.current_user_role();
  end if;
  raise notice 'HARNESS OK: seo_editor runs as %, auth.uid()=%', current_user, auth.uid();
end;
$$;

-- content_editor
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

do $$
begin
  if current_user <> 'authenticated' then
    raise exception 'HARNESS FAILED: expected current_user = authenticated, got %', current_user;
  end if;
  if public.current_user_role() is distinct from 'content_editor' then
    raise exception 'HARNESS FAILED: current_user_role() = %, expected content_editor', public.current_user_role();
  end if;
  raise notice 'HARNESS OK: content_editor runs as %, auth.uid()=%', current_user, auth.uid();
end;
$$;

-- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if current_user <> 'anon' then
    raise exception 'HARNESS FAILED: expected current_user = anon, got %', current_user;
  end if;
  if exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'HARNESS FAILED: role % is superuser or has BYPASSRLS', current_user;
  end if;
  if auth.uid() is not null then
    raise exception 'HARNESS FAILED: auth.uid() should be null for anon, got %', auth.uid();
  end if;
  if public.current_user_role() is not null then
    raise exception 'HARNESS FAILED: current_user_role() should be null for anon, got %', public.current_user_role();
  end if;
  raise notice 'HARNESS OK: anon runs as %, auth.uid() is null', current_user;
end;
$$;

-- ============================================================================
-- TEST 1: Owner can create a product with ONLY name + affiliate URL.
-- create_product() is SECURITY INVOKER, so its inserts into products and
-- affiliate_links are genuinely checked against the owner RLS policies.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  v_product public.products;
  v_link public.affiliate_links;
begin
  v_product := public.create_product('Test Product Alpha', 'https://merchant.test/alpha?aff=1');

  if v_product.slug <> 'test-product-alpha' then
    raise exception 'TEST 1 FAILED: expected slug test-product-alpha, got %', v_product.slug;
  end if;

  if v_product.status <> 'new' then
    raise exception 'TEST 1 FAILED: expected status new, got %', v_product.status;
  end if;

  select * into v_link from public.affiliate_links where product_id = v_product.id and is_active;
  if v_link.destination_url is distinct from 'https://merchant.test/alpha?aff=1' then
    raise exception 'TEST 1 FAILED: affiliate link not stored correctly (got %)', v_link.destination_url;
  end if;

  raise notice 'TEST 1 PASSED: owner created product % with slug % and linked affiliate URL', v_product.name, v_product.slug;
end;
$$;

-- ============================================================================
-- TEST 2: Duplicate product names get a unique, collision-safe slug.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  v_first public.products;
  v_second public.products;
begin
  v_first := public.create_product('Duplicate Name', 'https://merchant.test/dup1');
  v_second := public.create_product('Duplicate Name', 'https://merchant.test/dup2');

  if v_first.slug = v_second.slug then
    raise exception 'TEST 2 FAILED: duplicate slugs were not disambiguated (% = %)', v_first.slug, v_second.slug;
  end if;

  if v_second.slug <> v_first.slug || '-2' then
    raise exception 'TEST 2 FAILED: expected second slug to be %-2, got %', v_first.slug, v_second.slug;
  end if;

  raise notice 'TEST 2 PASSED: % vs % are distinct', v_first.slug, v_second.slug;
end;
$$;

-- ============================================================================
-- TEST 3: Invalid affiliate URLs are rejected.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.create_product('Bad URL Product', 'javascript:alert(1)');
    raise exception 'TEST 3 FAILED: invalid affiliate URL was accepted';
  exception
    when others then
      if sqlerrm like '%Affiliate URL must be a valid%' then
        raise notice 'TEST 3 PASSED: invalid URL rejected with: %', sqlerrm;
      else
        raise; -- unexpected error (or our own FAILED sentinel) — surface it as a real failure
      end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.create_product('Empty Name Product', '');
    raise exception 'TEST 3b FAILED: empty affiliate URL was accepted';
  exception
    when others then
      if sqlerrm like '%Affiliate URL must be a valid%' then
        raise notice 'TEST 3b PASSED: empty URL rejected with: %', sqlerrm;
      else
        raise;
      end if;
  end;
end;
$$;

-- ============================================================================
-- TEST 4: Agency (any sub-role) CANNOT create products or touch affiliate
-- links — owner-only surface.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true); -- agency_admin

do $$
begin
  begin
    perform public.create_product('Should Not Exist', 'https://merchant.test/blocked');
    raise exception 'TEST 4 FAILED: agency_admin was able to create a product';
  exception
    when others then
      if sqlerrm like '%Only the owner can create products%' then
        raise notice 'TEST 4 PASSED: agency_admin blocked from create_product with: %', sqlerrm;
      else
        raise;
      end if;
  end;
end;
$$;

-- ============================================================================
-- TEST 4b: agency_admin CANNOT insert directly into affiliate_links.
--
-- Setup uses a dedicated, freshly-created product with its auto-created
-- active link temporarily deactivated, so the attempted INSERT below has no
-- active row to collide with at the affiliate_links_one_active_per_product
-- partial unique index. This isolates the assertion to authorization/RLS
-- alone (a 23505 unique_violation would prove nothing about RLS).
-- app.rls_probe_* GUCs pass the ids across identity switches, since
-- separate DO blocks don't share plpgsql variables and GUCs survive
-- SET ROLE.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
declare
  v_product public.products;
  v_link_id uuid;
  v_rows int;
begin
  v_product := public.create_product('RLS Probe Product', 'https://merchant.test/rls-probe');

  select id into v_link_id from public.affiliate_links
    where product_id = v_product.id and is_active;
  if v_link_id is null then
    raise exception 'TEST 4b SETUP FAILED: owner cannot see the probe product''s active link';
  end if;

  update public.affiliate_links set is_active = false where id = v_link_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 4b SETUP FAILED: owner update of affiliate_links affected % rows, expected 1', v_rows;
  end if;

  perform set_config('app.rls_probe_product_id', v_product.id::text, true);
  perform set_config('app.rls_probe_link_id', v_link_id::text, true);
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true); -- agency_admin

do $$
declare
  v_product_id uuid := current_setting('app.rls_probe_product_id', true)::uuid;
begin
  if current_user <> 'authenticated' then
    raise exception 'TEST 4b HARNESS FAILED: running as %, not authenticated', current_user;
  end if;

  begin
    insert into public.affiliate_links (product_id, destination_url)
    values (v_product_id, 'https://merchant.test/hijack');
    raise exception 'TEST 4b FAILED: agency_admin inserted directly into affiliate_links';
  exception
    when insufficient_privilege then
      if sqlerrm like '%violates row-level security policy%' then
        raise notice 'TEST 4b PASSED: direct affiliate_links insert blocked by RLS with: %', sqlerrm;
      else
        raise; -- 42501 but not an RLS violation (e.g. a missing grant) — not what this test proves
      end if;
  end;
end;
$$;

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.affiliate_links; -- should be visible-zero under RLS
  if v_count <> 0 then
    raise exception 'TEST 4c FAILED: agency_admin can SELECT affiliate_links (got % rows)', v_count;
  end if;
  raise notice 'TEST 4c PASSED: agency_admin sees 0 affiliate_links rows under RLS';
end;
$$;

-- Restore the probe product's link state as owner and confirm nothing
-- slipped through.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
declare
  v_product_id uuid := current_setting('app.rls_probe_product_id', true)::uuid;
  v_link_id uuid := current_setting('app.rls_probe_link_id', true)::uuid;
  v_stray_count int;
begin
  update public.affiliate_links set is_active = true where id = v_link_id;

  select count(*) into v_stray_count
    from public.affiliate_links
    where product_id = v_product_id and destination_url = 'https://merchant.test/hijack';
  if v_stray_count <> 0 then
    raise exception 'TEST 4b FAILED (post-check): a hijack row exists for the probe product';
  end if;

  raise notice 'TEST 4b/4c cleanup: probe product link restored, no stray row present';
end;
$$;

-- ============================================================================
-- TEST 5: Agency_admin/content_editor CAN write product_content; seo_editor
-- cannot write product_content but CAN write seo_metadata.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true); -- agency_admin

do $$
declare
  v_product_id uuid;
begin
  select id into v_product_id from public.products where slug = 'test-product-alpha';
  if v_product_id is null then
    raise exception 'TEST 5 SETUP FAILED: agency_admin cannot see test-product-alpha';
  end if;

  insert into public.product_content (product_id, overview, status)
  values (v_product_id, 'A great product overview.', 'draft');

  raise notice 'TEST 5 PASSED: agency_admin created product_content';
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true); -- seo_editor

do $$
declare
  v_product_id uuid;
begin
  select id into v_product_id from public.products where slug = 'duplicate-name-2';
  if v_product_id is null then
    raise exception 'TEST 5b SETUP FAILED: seo_editor cannot see duplicate-name-2';
  end if;

  begin
    insert into public.product_content (product_id, overview, status)
    values (v_product_id, 'seo editor should not be able to do this', 'draft');
    raise exception 'TEST 5b FAILED: seo_editor wrote product_content';
  exception
    when insufficient_privilege then
      if sqlerrm like '%violates row-level security policy%' then
        raise notice 'TEST 5b PASSED: seo_editor blocked from product_content by RLS with: %', sqlerrm;
      else
        raise;
      end if;
  end;

  insert into public.seo_metadata (entity_type, entity_id, title)
  values ('product', v_product_id, 'SEO Title');

  raise notice 'TEST 5c PASSED: seo_editor created seo_metadata';
end;
$$;

-- ============================================================================
-- TEST 6: Two-gate public visibility — content gate.
-- Owner activates test-product-alpha first, so its status gate is open and
-- the ONLY thing hiding it from anon is its still-draft content. (TEST 10
-- separately covers the status gate.)
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
declare
  v_rows int;
begin
  update public.products set status = 'active' where slug = 'test-product-alpha';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 6 SETUP FAILED: owner activation affected % rows, expected 1', v_rows;
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.products where slug = 'test-product-alpha';
  if v_count <> 0 then
    raise exception 'TEST 6 FAILED: anon can see an active product whose content is still draft';
  end if;
  raise notice 'TEST 6 PASSED: anon cannot see active product with unpublished content';
end;
$$;

-- Publish the content as agency_admin, then re-check as anon.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true); -- agency_admin

do $$
declare
  v_rows int;
begin
  update public.product_content set status = 'published'
    where product_id = (select id from public.products where slug = 'test-product-alpha');
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 6b SETUP FAILED: agency_admin publish affected % rows, expected 1', v_rows;
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.products where slug = 'test-product-alpha';
  if v_count <> 1 then
    raise exception 'TEST 6b FAILED: anon cannot see active product after content published (got % rows)', v_count;
  end if;
  raise notice 'TEST 6b PASSED: anon sees product once it is active AND content is published';
end;
$$;

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.affiliate_links;
  if v_count <> 0 then
    raise exception 'TEST 6c FAILED: anon can read affiliate_links directly (got % rows)', v_count;
  end if;
  raise notice 'TEST 6c PASSED: anon has zero direct access to affiliate_links';
end;
$$;

-- ============================================================================
-- TEST 7: /go/[slug] resolution works for anon via the RPC without exposing
-- the affiliate_links table. (test-product-alpha is already active with
-- published content from TEST 6/6b; still running as anon.)
-- ============================================================================
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_url text;
  v_click_id uuid;
begin
  select destination_url into v_url from public.get_active_affiliate_link('test-product-alpha');
  if v_url is null or v_url <> 'https://merchant.test/alpha?aff=1' then
    raise exception 'TEST 7 FAILED: get_active_affiliate_link returned % instead of the expected URL', v_url;
  end if;
  raise notice 'TEST 7 PASSED: anon resolved affiliate URL via RPC: %', v_url;

  v_click_id := public.record_affiliate_click('test-product-alpha', 'https://google.com', '/products/test-product-alpha', 'primary-cta');
  if v_click_id is null then
    raise exception 'TEST 7b FAILED: record_affiliate_click did not return an id';
  end if;
  raise notice 'TEST 7b PASSED: anon recorded a click as % (cannot read it back, tested next)', v_click_id;

  perform 1 from public.affiliate_clicks where id = v_click_id;
  if found then
    raise exception 'TEST 7c FAILED: anon can read back affiliate_clicks rows';
  end if;
  raise notice 'TEST 7c PASSED: anon cannot read affiliate_clicks (0 rows visible)';
end;
$$;

-- ============================================================================
-- TEST 7d: an active product whose content is STILL DRAFT (not yet
-- published by the agency) must not resolve or record clicks via the /go/
-- RPCs, even though products.status = 'active' on its own.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
declare
  v_product public.products;
  v_rows int;
begin
  v_product := public.create_product('Not Yet Published Product', 'https://merchant.test/not-yet-published');
  update public.products set status = 'active' where id = v_product.id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 7d SETUP FAILED: owner activation affected % rows, expected 1', v_rows;
  end if;
  -- deliberately no product_content row inserted / published for this product
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_url text;
begin
  select destination_url into v_url from public.get_active_affiliate_link('not-yet-published-product');
  if v_url is not null then
    raise exception 'TEST 7d FAILED: get_active_affiliate_link resolved a URL for unpublished-content product (%)', v_url;
  end if;
  raise notice 'TEST 7d PASSED: get_active_affiliate_link returns nothing for active-but-unpublished product';

  begin
    perform public.record_affiliate_click('not-yet-published-product');
    raise exception 'TEST 7e FAILED: record_affiliate_click succeeded for unpublished-content product';
  exception
    when others then
      if sqlerrm like '%Unknown or inactive product slug%' then
        raise notice 'TEST 7e PASSED: record_affiliate_click rejected unpublished-content product with: %', sqlerrm;
      else
        raise;
      end if;
  end;
end;
$$;

-- ============================================================================
-- TEST 8: Non-owner cannot escalate their own role.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true); -- content_editor

do $$
begin
  begin
    update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-000000000004';
    raise exception 'TEST 8 FAILED: content_editor escalated themself to owner (or the update silently matched no rows)';
  exception
    when others then
      if sqlerrm like '%Only the owner can change a user role%' then
        raise notice 'TEST 8 PASSED: self role-escalation blocked with: %', sqlerrm;
      else
        raise;
      end if;
  end;
end;
$$;

-- ============================================================================
-- TEST 9: audit_logs cannot be written or tampered with directly by anyone,
-- including the owner; only the trigger writes them.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
begin
  begin
    insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values ('00000000-0000-0000-0000-000000000001', 'fake.action', 'products', gen_random_uuid());
    raise exception 'TEST 9 FAILED: owner was able to insert a forged audit_logs row directly';
  exception
    when insufficient_privilege then
      if sqlerrm like '%violates row-level security policy%' then
        raise notice 'TEST 9 PASSED: direct audit_logs insert blocked by RLS even for owner with: %', sqlerrm;
      else
        raise;
      end if;
  end;

  perform 1 from public.audit_logs where action = 'products.insert' limit 1;
  if not found then
    raise exception 'TEST 9b FAILED: owner cannot see any automatically written products.insert audit row';
  end if;
  raise notice 'TEST 9b PASSED: audit_logs were written automatically by the trigger and are owner-readable';
end;
$$;

-- ============================================================================
-- TEST 10: Two-gate public visibility — status gate. Owner pauses a product
-- whose content stays published; it must disappear from anon immediately.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
declare
  v_rows int;
begin
  update public.products set status = 'paused' where slug = 'test-product-alpha';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 10 SETUP FAILED: owner pause affected % rows, expected 1', v_rows;
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.products where slug = 'test-product-alpha';
  if v_count <> 0 then
    raise exception 'TEST 10 FAILED: anon can still see a paused product';
  end if;
  raise notice 'TEST 10 PASSED: pausing a product hides it from anon immediately';
end;
$$;

-- ============================================================================
-- TEST 11: The owner cannot hard-delete a product through the API — only
-- deactivate it via status/deleted_at. `products` has no DELETE RLS policy
-- (0011) because affiliate_clicks, product content, reviews and relations
-- all cascade from it.
--
-- Postgres RLS enforces DELETE via USING only (no WITH CHECK), so with zero
-- DELETE policies the DELETE matches zero rows and returns success — it
-- does NOT raise. The only reliable check is that the row still exists.
-- ============================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true); -- owner

do $$
declare
  v_rows int;
  v_still_exists boolean;
begin
  delete from public.products where slug = 'test-product-alpha';
  get diagnostics v_rows = row_count;

  select exists(select 1 from public.products where slug = 'test-product-alpha') into v_still_exists;
  if v_rows <> 0 or not v_still_exists then
    raise exception 'TEST 11 FAILED: owner hard-deleted a product (rows deleted: %, still exists: %)', v_rows, v_still_exists;
  end if;

  raise notice 'TEST 11 PASSED: DELETE matched zero rows (no DELETE policy on products) — row still present';
end;
$$;

-- ============================================================================
-- Done: restore identity, then roll back so no test data persists.
-- ============================================================================
reset role;
reset request.jwt.claims;

rollback;

select 'RLS TEST SUITE PASSED: all assertions ran under genuine authenticated/anon roles; transaction rolled back, no test data persisted' as result;
