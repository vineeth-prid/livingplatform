-- Collapse country codes in login usernames to the 10-digit mobile number.
--
-- The username IS the mobile number. Normalisation previously stripped only
-- punctuation, so a country code survived and "+91 98765 43210" provisioned a
-- DIFFERENT account from "9876543210" — two logins for one person. The code now
-- keeps the last 10 digits; this brings already-provisioned accounts in line so
-- they keep signing in.
--
-- Accounts are only renamed when the 10-digit form is FREE. Where both spellings
-- already exist they are genuinely two accounts for one person, and picking a
-- winner here could delete the one being used or orphan a resident's history.
-- Those are left untouched for a human to merge; the runbook has the query.

-- 1. Usernames: country-coded → 10-digit, where nothing already holds it.
UPDATE "users" u
SET "username" = RIGHT(u."username", 10)
WHERE u."username" ~ '^[0-9]{11,}$'
  AND NOT EXISTS (
    SELECT 1 FROM "users" other
    WHERE other."username" = RIGHT(u."username", 10)
      AND other."id" <> u."id"
  );

-- 2. The synthetic <number>@living.local email is derived from the same number,
--    so it moves with it. A real address is left alone.
UPDATE "users" u
SET "email" = u."username" || '@living.local'
WHERE u."username" ~ '^[0-9]{10}$'
  AND u."email" ~ '^[0-9]{11,}@living\.local$'
  AND NOT EXISTS (
    SELECT 1 FROM "users" other
    WHERE other."email" = u."username" || '@living.local'
      AND other."id" <> u."id"
  );
