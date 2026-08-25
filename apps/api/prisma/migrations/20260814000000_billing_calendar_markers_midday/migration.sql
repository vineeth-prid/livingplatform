-- Billing calendar markers move to midday UTC.
--
-- `period_start`, `period_end` and `due_date` are calendar markers — "the 1st",
-- "the 31st", "due on the 10th" — stored as instants and rendered in the
-- reader's timezone. Stamped at midnight / 23:59:59.999 UTC they crossed into
-- the neighbouring calendar day for any timezone offset from UTC: in IST an
-- August invoice read "1 Aug - 1 Sep" and a bill due the 10th read as due the
-- 11th, which is where the wrong maintenance day counts came from.
--
-- Midday lands on the intended day everywhere from UTC-11 to UTC+11. Only the
-- time-of-day component changes; no invoice moves to a different date.
UPDATE "maintenance_invoices"
SET "periodStart" = date_trunc('day', "periodStart") + interval '12 hours',
    "periodEnd"   = date_trunc('day', "periodEnd")   + interval '12 hours',
    "dueDate"     = date_trunc('day', "dueDate")     + interval '12 hours';
