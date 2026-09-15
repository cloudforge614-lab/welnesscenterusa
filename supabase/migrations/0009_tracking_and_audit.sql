-- 0009_tracking_and_audit.sql

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);

alter table public.audit_logs enable row level security;
-- No insert/update/delete policy is defined for any client role: rows are
-- written exclusively by the SECURITY DEFINER write_audit_log() trigger
-- function, so audit history cannot be forged or erased from the client.

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text,
  landing_page text,
  cta_location text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  device_type public.device_type not null default 'unknown',
  ip_hash text
);

create index affiliate_clicks_product_id_clicked_at_idx
  on public.affiliate_clicks(product_id, clicked_at desc);

alter table public.affiliate_clicks enable row level security;
-- No client insert policy: rows are written exclusively via the
-- record_affiliate_click() SECURITY DEFINER function (0010), invoked from
-- the /go/[slug] server route, so the browser can never forge click rows
-- or read another product's click data directly.
