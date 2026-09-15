-- 0013_additional_audit_triggers.sql
-- Role assignment is the most security-sensitive action in this schema and
-- must be logged; categories are lower-stakes but still admin-managed.

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.write_audit_log();

create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function public.write_audit_log();
