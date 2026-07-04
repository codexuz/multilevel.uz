-- ============================================================================
-- Table privileges for the PostgREST API roles.
-- Run this if you already applied 0001 before it included grants.
-- RLS still restricts which rows each user can see — these GRANTs only give the
-- roles table-level access so the API stops returning "permission denied".
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;

-- Client roles (RLS enforced)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.tests, public.sections, public.parts to anon;

-- Server role used by the Nuxt API endpoints (bypasses RLS, but still needs grants)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;

-- Future tables/functions inherit the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
