-- Tenant isolation defense-in-depth (A1): Postgres Row-Level Security.
--
-- Policies are DEFINED and RLS is ENABLED here, but this migration is INERT and
-- safe to deploy: Prisma's DB role owns these tables, and table owners are exempt
-- from RLS until FORCE ROW LEVEL SECURITY is set. Enforcement is a deliberate,
-- staged step performed AFTER validating on staging — see prisma/rls/ACTIVATE.sql.
--
-- Convention (set per-request by the API as transaction-local GUCs when
-- DB_RLS_ENABLED=true):
--   app.tenant_id   → the caller's tenant id
--   app.bypass_rls  → 'on' for platform admins / background workers / seeds
--
-- A policy allows a row when the caller bypasses, or the row's tenant matches.
-- Tables link to the tenant either directly (tenant_id) or via their community.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'communities','vendors','catalog_options','asset_categories','assets',
    'maintenance_plans','amc_contracts','visitors','amenity_bookings','announcements'
  ];
  community_tables text[] := ARRAY[
    'phases','blocks','floors','units','amenities','community_settings',
    'community_documents','residents','staff','tickets','service_requests','work_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (
        coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
        OR tenant_id = current_setting('app.tenant_id', true)
      )
      WITH CHECK (
        coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
        OR tenant_id = current_setting('app.tenant_id', true)
      )
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY community_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (
        coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
        OR community_id IN (
          SELECT id FROM communities WHERE tenant_id = current_setting('app.tenant_id', true)
        )
      )
      WITH CHECK (
        coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
        OR community_id IN (
          SELECT id FROM communities WHERE tenant_id = current_setting('app.tenant_id', true)
        )
      )
    $f$, t);
  END LOOP;
END $$;
