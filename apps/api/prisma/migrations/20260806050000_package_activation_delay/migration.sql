-- Sprint G — a package's first visit becomes bookable a couple of days after
-- payment, and the window is tracked from that point rather than from purchase.
--
-- Defaults to 2 days, which is the requested behaviour. Set 0 on a package to
-- make it bookable immediately.
--
-- Existing ACTIVE purchases are untouched: their validFrom is already in the
-- past, so they stay redeemable exactly as they are today.
ALTER TABLE "service_packages"
  ADD COLUMN "activationDelayDays" INTEGER NOT NULL DEFAULT 2;
