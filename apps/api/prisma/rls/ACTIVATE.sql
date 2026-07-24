-- ============================================================================
-- RLS ACTIVATION — run MANUALLY on a validated staging DB, then production.
-- Do NOT put this in a Prisma migration: forcing RLS while the API cannot set
-- the tenant GUC would block every tenant-table query. Activate in this order.
-- ============================================================================

-- 0) PREREQUISITE (already shipped): migration 20260727000000_tenant_rls created
--    the policies and ENABLEd RLS. They are currently inert because Prisma's DB
--    role owns the tables (owners bypass RLS until FORCEd).

-- 1) Turn on GUC propagation in the API:
--       DB_RLS_ENABLED=true
--    With the flag on, PrismaService wraps every model operation in a
--    transaction that sets app.tenant_id / app.bypass_rls from the request's
--    AsyncLocalStorage tenant context (see src/common/context/tenant-als.ts and
--    the TenantContextInterceptor). Platform admins and background/worker/seed
--    contexts run with app.bypass_rls = 'on'.

-- 2) FORCE RLS so even the table owner is subject to policies (belt-and-braces;
--    complements, and removes reliance on, running the API as a non-owner role):
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'communities','vendors','catalog_options','asset_categories','assets',
    'maintenance_plans','amc_contracts','visitors','amenity_bookings','announcements',
    'phases','blocks','floors','units','amenities','community_settings',
    'community_documents','residents','staff','tickets','service_requests','work_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 3) (Recommended) also run the API as a dedicated NON-owner role so a missing
--    FORCE on a future table still can't leak:
--       CREATE ROLE living_app LOGIN PASSWORD '...';
--       GRANT USAGE ON SCHEMA public TO living_app;
--       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO living_app;
--       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO living_app;
--       ALTER DEFAULT PRIVILEGES IN SCHEMA public
--         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO living_app;
--       -- then point the API's DATABASE_URL at living_app (keep migrations on the owner).

-- ============================================================================
-- VALIDATION (must pass before trusting enforcement):
--   • As an association admin of tenant A, GET/PUT a row that belongs to tenant B
--     by id → must 404 (was the pre-A1 IDOR risk).
--   • As the same admin, normal in-tenant reads/writes still work.
--   • As a platform admin, cross-tenant reads still work (bypass).
--   • Background jobs (notification worker) and `prisma db seed` still run.
-- ROLLBACK (if needed): set DB_RLS_ENABLED=false and, per table,
--   ALTER TABLE <t> NO FORCE ROW LEVEL SECURITY;  (policies stay, become inert)
-- ============================================================================
