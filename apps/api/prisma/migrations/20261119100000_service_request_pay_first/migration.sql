-- Pay-first service bookings: a priced resident request is held unassigned until paid.
ALTER TABLE "service_requests" ADD COLUMN "paymentRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "service_requests" ADD COLUMN "paidAt" TIMESTAMP(3);
