# Supabase foundation — Phase 1

## Layout

```
supabase/
  config.toml               Supabase CLI project config (local dev)
  migrations/                001-0013, applied in filename order
  seed/dev_seed.sql          DEV/TEST ONLY — never run against production
  tests/rls_tests.sql        Runnable RLS/behavior test suite (not a migration)
```

## Applying to a real Supabase project

1. Install the Supabase CLI, `supabase login`, `supabase link --project-ref <ref>`.
2. `supabase db push` — applies every file in `migrations/` in order.
   (Or paste each file into the SQL Editor in order, if you're not using the CLI.)
3. Do **not** run `supabase/seed/dev_seed.sql` against production. It creates
   fake `auth.users` rows and fake products. Only ever run it against a local
   (`supabase start` / `supabase db reset`) or disposable dev project. As a
   safety net the script itself refuses to run unless you first execute, in
   the same session:
   ```sql
   SET app.confirm_dev_seed = 'yes-i-am-sure';
   ```
4. To make yourself the first real owner: sign up normally through Supabase
   Auth (creates a `profiles` row with `role = NULL`), then in the SQL editor,
   as the project's postgres user:
   ```sql
   update public.profiles set role = 'owner' where id = '<your auth.users id>';
   ```
   This one-time bootstrap step is the only time a role is ever assigned
   outside of the owner's own dashboard — RLS blocks anyone from doing this
   themselves afterward (see `guard_profile_role_change` in `0003_profiles.sql`).

## Running the RLS test suite

After migrations + `dev_seed.sql` are applied to a **local or dev** project:

1. Open the SQL Editor (or `psql`) against that project.
2. Paste the entire contents of `supabase/tests/rls_tests.sql` and run it in
   one go (one "Run" = one transaction, which the impersonation helpers rely on).
3. A clean pass prints only `NOTICE: TEST N PASSED: ...` lines. Any test
   failure raises an unhandled exception and aborts — read the error to see
   which test failed and why.

## Key design points worth knowing before Phase 2

- **Owner's "Add Product" form calls exactly one RPC**: `public.create_product(name, affiliate_url)`.
  It validates both inputs, generates a collision-safe slug, inserts the
  `products` row and the linked `affiliate_links` row, and returns the new
  product — all in one call, one transaction.
- **Affiliate URLs are never stored on `products`.** They live in
  `affiliate_links`, which only the owner can read or write directly. The
  public `/go/[slug]` redirect route must call `get_active_affiliate_link()`
  / `record_affiliate_click()` (both `SECURITY DEFINER`, both narrowly
  scoped) rather than querying `affiliate_links` directly.
- **Product visibility on the public site requires two independent gates**:
  `products.status = 'active'` (owner-controlled) AND a `product_content`
  row with `status = 'published'` (agency-controlled). Either one flips off
  → the product disappears from public queries immediately.
- **`audit_logs` and `affiliate_clicks` have no client-facing write policy
  at all.** Rows only ever get written by `SECURITY DEFINER` trigger/RPC
  functions, so nothing — not even the owner — can insert a forged row
  through the API.
- Every `slug` column self-populates via a `BEFORE INSERT` trigger
  (`public.next_unique_slug`) if left blank, and disambiguates collisions
  with `-2`, `-3`, etc. Concurrent creation of two products with the same
  name is serialized with a transaction-scoped advisory lock so the second
  caller transparently gets `-2` instead of racing the first.
- `products` has no DELETE policy at all — Postgres RLS enforces DELETE via
  `USING` only (no `WITH CHECK`), so an attempted delete doesn't error, it
  just matches zero rows. `deleted_at` (soft delete) is the only supported
  removal path; a true hard delete is a deliberate out-of-band DB operation.
- The two RPCs behind `/go/[slug]` (`get_active_affiliate_link`,
  `record_affiliate_click`) require BOTH `products.status = 'active'` AND a
  published `product_content` row — the same two-gate rule that governs
  public visibility — so a product that isn't on the public site yet can't
  have its affiliate URL resolved or clicks recorded by someone who guesses
  its slug.

## Phase 1 verification audit (2026-09-15)

A full static re-review against the architecture found and fixed 5 real
issues before anything was deployed (none of this had shipped yet — this
sandbox has no Supabase CLI/Docker/psql, so nothing here has been executed
against a live Postgres):

1. Dynamic RLS-policy generator produced invalid SQL (`"table"_suffix`
   instead of a single quoted identifier) for 8 of the 21 tables' policies.
2. `get_active_affiliate_link()` / `record_affiliate_click()` only checked
   `products.status = 'active'`, not the content-published gate — a product
   not yet publicly visible could still leak its real affiliate URL via
   direct RPC call if someone knew/guessed its slug.
3. `guard_profile_role_change()` called `is_owner()`, which needs
   `auth.uid()` — always NULL outside a real PostgREST request. This made
   the documented owner-bootstrap step (and `dev_seed.sql`'s role
   assignment) impossible: the very first owner could never have been
   created.
4. `products` granted the owner a `for all` policy, silently including hard
   DELETE despite the dedicated `deleted_at` soft-delete column and heavy
   cascading (would have destroyed click/content history on any accidental
   delete). Narrowed to select/insert/update only.
5. Slug generation had a theoretical check-then-insert race under
   concurrent identical-name product creation. Closed with a transaction-
   scoped advisory lock in `next_unique_slug()`.

The RLS test script was also hardened: several exception-handling blocks
used a blanket `when others` that would have reported a false PASS for any
error, not just the intended one — tightened to check the specific
SQLSTATE (`insufficient_privilege` for RLS violations) or exact message.
One test (hard-delete-blocked) was logically wrong: Postgres RLS DELETE
without a WITH CHECK doesn't raise on denial, it just affects zero rows —
the test asserted the row still exists instead of expecting an exception.

See the audit report delivered in-conversation for the full item-by-item
breakdown and the exact commands to run these migrations and tests
yourself, since nothing here has been executed in this environment.

## Migration-order fix (2026-09-15, after a real `supabase db push` failure)

`0002_helper_functions.sql` originally defined `current_user_role()`,
`is_owner()`, `is_agency()`, and `has_any_role()` as `LANGUAGE SQL`
functions querying `public.profiles` — but `profiles` isn't created until
`0003_profiles.sql`. Postgres resolves a SQL-language function's body
immediately at `CREATE FUNCTION` time (unlike a `plpgsql` body, which is
opaque text validated only on first call), so this failed on a fresh
database with `relation "public.profiles" does not exist` (42P01).

Fix: those four functions now live in `0003_profiles.sql`, immediately
after the `profiles` table and index, before anything that needs them.
Every other function in `0002` (`slugify`, `next_unique_slug`,
`set_updated_at`, `write_audit_log`) either references no table or is
`plpgsql` (deferred validation), so none of them needed to move. No files
were renumbered; only content moved between the existing `0002` and `0003`.

## Dev seed auth fix (2026-09-15, found while testing the Phase 2 owner login)

The original `dev_seed.sql` inserted the four dev users into `auth.users`
with Supabase Auth's token columns left NULL and no `auth.identities` rows.
Supabase Auth reads those columns as non-null strings, so every password
sign-in for those accounts failed with `500: Database error querying schema`.
The RLS test suite never noticed because it never signs in through Auth.

- `dev_seed.sql` now sets those columns to `''` and creates an `email`
  identity per user, so fresh dev databases are correct.
- `dev_seed_auth_repair.sql` repairs a dev database that was already seeded
  with the old version. It only touches the four fixed dev UUIDs, needs the
  same `SET app.confirm_dev_seed = 'yes-i-am-sure';` opt-in, and is safe to
  rerun. Dev only — never production.
