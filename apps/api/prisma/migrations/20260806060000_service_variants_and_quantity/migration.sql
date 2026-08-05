-- Sprint G — priced options within a service, and requesting more than one.
--
-- "Car type should be able to add, based on which price should be added" and
-- "resident should be able to add kitchen cleaning 2 for two bathrooms".
--
-- A VARIANT is a priced option inside one service (Hatchback / Sedan / SUV on a
-- car wash). Deliberately not separate services: they share a name, a
-- description and a catalogue entry, and the resident picks between them at
-- request time.
--
-- Purely additive. A service with no variants prices from `services.basePrice`
-- exactly as it does today, and every existing request defaults to quantity 1
-- with null pricing — unchanged behaviour until a community adds a variant.

CREATE TABLE "service_variants" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_variants_serviceId_name_key"
  ON "service_variants"("serviceId", "name");
CREATE INDEX "service_variants_serviceId_idx" ON "service_variants"("serviceId");

ALTER TABLE "service_variants"
  ADD CONSTRAINT "service_variants_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Request-side: which option, how many, and the price FROZEN at request time so
-- a later catalogue edit never rewrites what a resident was quoted.
ALTER TABLE "service_requests" ADD COLUMN "variantId" TEXT;
ALTER TABLE "service_requests" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "service_requests" ADD COLUMN "unitPrice" DECIMAL(14,2);
ALTER TABLE "service_requests" ADD COLUMN "totalPrice" DECIMAL(14,2);

ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "service_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "service_requests_variantId_idx" ON "service_requests"("variantId");
