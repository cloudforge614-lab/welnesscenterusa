-- 0001_extensions_and_enums.sql
-- Extensions and enum types shared across the schema.

create extension if not exists "pgcrypto";   -- gen_random_uuid(), crypt() for dev seed users

create type public.user_role as enum (
  'owner',
  'agency_admin',
  'seo_editor',
  'content_editor'
);

-- Owner-controlled publication gate. Content readiness is tracked separately
-- on product_content.status so the two concerns never collide.
create type public.product_status as enum (
  'new',
  'active',
  'paused',
  'archived'
);

create type public.content_status as enum (
  'draft',
  'published'
);

create type public.seo_entity_type as enum (
  'product',
  'category',
  'review',
  'comparison',
  'article',
  'guide'
);

create type public.redirect_type as enum (
  '301',
  '302'
);

create type public.device_type as enum (
  'mobile',
  'tablet',
  'desktop',
  'unknown'
);
