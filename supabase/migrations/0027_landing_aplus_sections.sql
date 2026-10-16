-- 0027_landing_aplus_sections.sql
-- A+ landing sections: allow the new section kinds in product_content.sections.
--
-- Forward-only, additive: the validator only gains kinds, so every row that
-- was valid under 0026 stays valid. The CHECK constraint on
-- product_content.sections calls this function by name, so replacing the
-- function body is enough (no constraint or column change).
--
-- New kinds (shape validated again, more strictly, by the application in
-- src/lib/landing/content.ts):
--   stats      headline numbers (hero trust strip or full-width band)
--   cards      icon cards with an optional, source-cited pull quote
--   contrast   side-by-side status cards (e.g. a flat pillow vs the product)
--   features   numbered feature rows with a fact chip
--   reviews    customer reviews; the application renders only reviews that
--              cite where they were published
--   guarantee  return/guarantee terms as stated by the seller

create or replace function public.is_valid_landing_sections(sections jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(sections) = 'array'
    and jsonb_array_length(sections) <= 30
    and not exists (
      select 1 from jsonb_array_elements(sections) s
      where jsonb_typeof(s) <> 'object'
         or coalesce(s ->> 'kind', '') not in (
              'prose', 'checklist', 'steps', 'comparison', 'specs', 'callout',
              'stats', 'cards', 'contrast', 'features', 'reviews', 'guarantee')
         or jsonb_typeof(s -> 'heading') is distinct from 'string'
         or length(s ->> 'heading') not between 1 and 160
         or length(coalesce(s ->> 'body', '')) > 12000
         or length(s::text) > 30000
    );
$$;
