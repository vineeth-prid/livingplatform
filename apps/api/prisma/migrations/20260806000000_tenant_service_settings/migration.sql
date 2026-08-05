-- Sprint A — per-tenant availability for PLATFORM services.
--
-- A system service (services.tenantId IS NULL) is one row shared by every
-- tenant, so a community admin must never edit or delete it. Until now that
-- also meant they could not WITHDRAW it, which is why every community showed an
-- identical service list with no way to curate it.
--
-- This table is that override. Absent = fall back to the service's own
-- isActive; present = this tenant's decision wins. Purely additive: with no
-- rows, every catalog behaves exactly as it does today.

CREATE TABLE "tenant_service_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "tenant_service_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_service_settings_tenantId_serviceId_key"
  ON "tenant_service_settings"("tenantId", "serviceId");
CREATE INDEX "tenant_service_settings_tenantId_idx"
  ON "tenant_service_settings"("tenantId");

ALTER TABLE "tenant_service_settings"
  ADD CONSTRAINT "tenant_service_settings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_service_settings"
  ADD CONSTRAINT "tenant_service_settings_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS backstop, same inert-until-FORCEd posture as 20260727000000_tenant_rls.
ALTER TABLE "tenant_service_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_service_settings"
  USING (
    coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );
