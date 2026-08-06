-- A tenant's own view of a SYSTEM ticket category.
--
-- Additive: no existing row changes, and a community with no override keeps
-- seeing every system category exactly as before.
CREATE TABLE "tenant_category_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "tenant_category_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_category_settings_tenantId_categoryId_key"
    ON "tenant_category_settings"("tenantId", "categoryId");
CREATE INDEX "tenant_category_settings_tenantId_idx"
    ON "tenant_category_settings"("tenantId");

ALTER TABLE "tenant_category_settings"
    ADD CONSTRAINT "tenant_category_settings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_category_settings"
    ADD CONSTRAINT "tenant_category_settings_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
